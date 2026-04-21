#!/usr/bin/env python3
"""
Conversation Engine v2

Mission-driven handoff engine for a human-supervised Codex <-> ChatGPT workflow.

Design goals
- Mission-file first workflow
- Explicit stage/state machine
- Strong branch discipline
- Artifact packaging for copy/paste handoffs
- No autonomous commit/push/PR actions
- Safe for iterative repo work

Typical flow
1. start
2. make-codex-audit-prompt
3. paste prompt into Codex
4. save Codex audit output to a file
5. apply-codex-audit
6. make-chatgpt-review-prompt
7. paste prompt into ChatGPT
8. save ChatGPT review response to a file
9. apply-chatgpt-review
10. make-codex-implementation-prompt
11. paste prompt into Codex
12. save Codex implementation summary to a file
13. apply-codex-implementation
14. make-chatgpt-implementation-review-prompt
15. repeat patch loop as needed
16. make-codex-commit-prompt when approved
17. finalize-summary

This tool packages the handoff points. It does not attempt to directly control
Codex or ChatGPT, because the current real-world workflow is still copy/paste
or file-based.
"""

from __future__ import annotations

import argparse
import dataclasses
import datetime as dt
import json
import os
import pathlib
import re
import subprocess
import sys
import textwrap
import uuid
from typing import Any, Literal


ENGINE_ROOT = ".conversation_engine/runs"
STATE_VERSION = 2


Stage = Literal[
    "started",
    "codex_audit_prompt_ready",
    "codex_audit_applied",
    "chatgpt_review_prompt_ready",
    "chatgpt_review_applied",
    "codex_implementation_prompt_ready",
    "codex_implementation_applied",
    "chatgpt_implementation_review_prompt_ready",
    "chatgpt_patch_applied",
    "codex_patch_prompt_ready",
    "approved_for_commit",
    "codex_commit_prompt_ready",
    "finalized",
]

ReviewDecision = Literal[
    "approve_to_implement",
    "needs_patch_before_implementation",
    "approve_to_commit",
    "needs_patch_after_implementation",
    "reject_scope",
    "unknown",
]


class EngineError(RuntimeError):
    pass


@dataclasses.dataclass
class RunState:
    state_version: int
    run_id: str
    created_at: str
    updated_at: str
    mission_file: str
    mission_title: str
    expected_branch: str
    current_stage: Stage
    repo_root: str
    mission_branch_verified: bool
    codex_audit_file: str | None = None
    chatgpt_review_file: str | None = None
    codex_implementation_file: str | None = None
    chatgpt_patch_file: str | None = None
    decision: ReviewDecision = "unknown"
    notes: list[str] = dataclasses.field(default_factory=list)
    changed_files: list[str] = dataclasses.field(default_factory=list)
    tests_summary: str | None = None
    risks_summary: str | None = None

    def to_json(self) -> dict[str, Any]:
        return dataclasses.asdict(self)

    @staticmethod
    def from_json(payload: dict[str, Any]) -> "RunState":
        return RunState(**payload)


class Repo:
    def __init__(self, cwd: str | None = None) -> None:
        self.cwd = cwd or os.getcwd()

    def _run_git(self, *args: str) -> str:
        result = subprocess.run(
            ["git", *args],
            cwd=self.cwd,
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            raise EngineError(result.stderr.strip() or f"git {' '.join(args)} failed")
        return result.stdout.strip()

    def repo_root(self) -> str:
        return self._run_git("rev-parse", "--show-toplevel")

    def current_branch(self) -> str:
        return self._run_git("branch", "--show-current")

    def is_clean(self) -> bool:
        status = self._run_git("status", "--porcelain")
        return status.strip() == ""


class RunStore:
    def __init__(self, repo_root: str) -> None:
        self.repo_root = pathlib.Path(repo_root)
        self.base = self.repo_root / ENGINE_ROOT
        self.base.mkdir(parents=True, exist_ok=True)

    def run_dir(self, run_id: str) -> pathlib.Path:
        return self.base / run_id

    def state_path(self, run_id: str) -> pathlib.Path:
        return self.run_dir(run_id) / "run.json"

    def save_state(self, state: RunState) -> None:
        state.updated_at = dt.datetime.now(dt.timezone.utc).isoformat()
        path = self.state_path(state.run_id)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(state.to_json(), indent=2), encoding="utf-8")

    def load_state(self, run_id: str) -> RunState:
        path = self.state_path(run_id)
        if not path.exists():
            raise EngineError(f"Run not found: {run_id}")
        return RunState.from_json(json.loads(path.read_text(encoding="utf-8")))

    def list_run_ids(self) -> list[str]:
        if not self.base.exists():
            return []
        return sorted(path.name for path in self.base.iterdir() if path.is_dir())

    def latest_run_id(self) -> str | None:
        run_ids = self.list_run_ids()
        return run_ids[-1] if run_ids else None

    def write_text(self, run_id: str, relative_path: str, content: str) -> pathlib.Path:
        path = self.run_dir(run_id) / relative_path
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")
        return path


def now_utc() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat()


def slugify(value: str) -> str:
    lowered = value.lower()
    lowered = re.sub(r"[^a-z0-9]+", "-", lowered)
    lowered = re.sub(r"-+", "-", lowered).strip("-")
    return lowered[:80] or "mission"


def read_text_file(path: str) -> str:
    file_path = pathlib.Path(path)
    if not file_path.exists():
        raise EngineError(f"File not found: {path}")
    return file_path.read_text(encoding="utf-8")


def extract_mission_title(mission_text: str, fallback_path: str) -> str:
    match = re.search(r"^MISSION:\s*(.+)$", mission_text, flags=re.MULTILINE)
    if match:
        return match.group(1).strip()
    return pathlib.Path(fallback_path).stem


def extract_branch(mission_text: str) -> str:
    match = re.search(r"^BRANCH:\s*\n?([A-Za-z0-9_./-]+)$", mission_text, flags=re.MULTILINE)
    if match:
        return match.group(1).strip()
    raise EngineError("Mission file does not contain a parseable BRANCH section.")


def ensure_branch(repo: Repo, expected_branch: str) -> bool:
    return repo.current_branch() == expected_branch


def normalize_response(text: str) -> str:
    return text.strip() + "\n"


def classify_review_decision(text: str) -> ReviewDecision:
    lowered = text.lower()
    if "approved to proceed with implementation" in lowered or "approved to implement" in lowered:
        return "approve_to_implement"
    if "approved to proceed to commit" in lowered or "approved to commit" in lowered:
        return "approve_to_commit"
    if "needs patch before implementation" in lowered or "revise before implementation" in lowered:
        return "needs_patch_before_implementation"
    if "needs patch" in lowered or "review pass required" in lowered or "revise" in lowered:
        return "needs_patch_after_implementation"
    if "reject" in lowered or "do not proceed" in lowered:
        return "reject_scope"
    return "unknown"


def extract_changed_files(text: str) -> list[str]:
    files: list[str] = []
    seen: set[str] = set()

    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line.startswith("- "):
            continue

        candidate: str | None = None

        # Pattern: - [path/to/file.ts](/absolute/path/or/url)
        markdown_link_match = re.match(r"- \[([^\]]+)\]\([^)]+\)", line)
        if markdown_link_match:
            candidate = markdown_link_match.group(1).strip()

        # Pattern: - `path/to/file.ts`
        if candidate is None:
            backtick_match = re.match(r"- `([^`]+)`", line)
            if backtick_match:
                candidate = backtick_match.group(1).strip()

        # Pattern: - path/to/file.ts
        if candidate is None:
            plain_match = re.match(r"- ([A-Za-z0-9_./-]+\.[A-Za-z0-9_]+)$", line)
            if plain_match:
                candidate = plain_match.group(1).strip()

        if candidate is None:
            continue

        # Ignore obvious command lines that are not files
        if candidate.startswith("npm "):
            continue
        if candidate.startswith("pnpm "):
            continue
        if candidate.startswith("yarn "):
            continue
        if candidate.startswith("node "):
            continue
        if " --run " in candidate:
            continue

        if candidate not in seen:
            seen.add(candidate)
            files.append(candidate)

    return files


def extract_section(text: str, heading_patterns: list[str]) -> str | None:
    lines = text.splitlines()

    normalized_patterns = [pattern.strip().lower() for pattern in heading_patterns]

    def is_heading(line: str) -> bool:
        stripped = line.strip()
        if not stripped:
            return False

        # Exact markdown heading forms like:
        # ## Risks
        # ### Test/build results
        if stripped.startswith("#"):
            heading_text = stripped.lstrip("#").strip().lower()
            return bool(heading_text)

        # Numbered heading forms like:
        # 1. Current system structure...
        # 5. Risks
        if re.match(r"^\d+\.\s+", stripped):
            return True

        # Colon headings like:
        # Risks:
        # Test/build results:
        if stripped.endswith(":"):
            return True

        return False

    def heading_matches(line: str) -> bool:
        stripped = line.strip()
        lower = stripped.lower()

        candidates = {lower}

        if stripped.startswith("#"):
            candidates.add(stripped.lstrip("#").strip().lower())

        numbered_match = re.match(r"^(\d+\.\s+)(.+)$", stripped)
        if numbered_match:
            candidates.add(numbered_match.group(2).strip().lower())

        if stripped.endswith(":"):
            candidates.add(stripped[:-1].strip().lower())

        return any(
            candidate == pattern or candidate.startswith(pattern)
            for candidate in candidates
            for pattern in normalized_patterns
        )

    start_idx: int | None = None
    for idx, line in enumerate(lines):
        if heading_matches(line):
            start_idx = idx
            break

    if start_idx is None:
        return None

    collected: list[str] = []
    for next_line in lines[start_idx + 1 :]:
        if is_heading(next_line):
            break
        collected.append(next_line)

    content = "\n".join(collected).strip()
    return content or None


def run_artifact_paths(store: RunStore, state: RunState) -> dict[str, pathlib.Path]:
    run_dir = store.run_dir(state.run_id)
    return {
        "mission": run_dir / "mission.md",
        "codex_audit_prompt": run_dir / "prompts" / "codex_audit_prompt.txt",
        "chatgpt_review_prompt": run_dir / "prompts" / "chatgpt_review_prompt.txt",
        "codex_implementation_prompt": run_dir / "prompts" / "codex_implementation_prompt.txt",
        "chatgpt_implementation_review_prompt": run_dir / "prompts" / "chatgpt_implementation_review_prompt.txt",
        "codex_commit_prompt": run_dir / "prompts" / "codex_commit_prompt.txt",
        "final_summary": run_dir / "final_summary.md",
        "latest_audit": pathlib.Path(state.repo_root) / ".conversation_engine" / "latest_audit.txt",
    }


def next_step_hint(state: RunState, *, wrapper_prefix: str = "python tools/conversation_engine/ce.py") -> str:
    run_id = state.run_id

    if state.current_stage == "started":
        return (
            "Generate the first Codex audit prompt with "
            f"`python tools/conversation_engine/v2.py make-codex-audit-prompt --run-id {run_id}` "
            "or use `python tools/conversation_engine/ce.py ce-start --mission-file <path>` for the wrapper flow."
        )

    if state.current_stage == "codex_audit_prompt_ready":
        return (
            "Paste the Codex audit prompt into Codex, save the response, then run "
            f"`{wrapper_prefix} ce-apply-codex-audit --run-id {run_id} --response-file <path>`."
        )

    if state.current_stage in {"codex_audit_applied", "chatgpt_review_prompt_ready"}:
        return (
            "Paste the ChatGPT review prompt into ChatGPT, save the response, then run "
            f"`{wrapper_prefix} ce-apply-chatgpt-review --run-id {run_id} --review-file <path>`."
        )

    if state.current_stage == "chatgpt_review_applied":
        if state.decision == "approve_to_implement":
            return (
                "Generate the Codex implementation prompt with "
                f"`python tools/conversation_engine/v2.py make-codex-implementation-prompt --run-id {run_id}`, "
                "then paste it into Codex."
            )
        if state.decision in {"needs_patch_before_implementation", "reject_scope"}:
            return "Follow the ChatGPT review instructions manually. The run is not yet approved for implementation."
        return "Review the ChatGPT response and confirm whether the mission is approved for implementation."

    if state.current_stage == "codex_implementation_prompt_ready":
        return (
            "Paste the Codex implementation prompt into Codex, save the summary, then run "
            f"`{wrapper_prefix} ce-apply-codex-implementation --run-id {run_id} --response-file <path>`."
        )

    if state.current_stage in {"codex_implementation_applied", "chatgpt_implementation_review_prompt_ready"}:
        return (
            "Paste the ChatGPT implementation review prompt into ChatGPT, save the response, then run "
            f"`python tools/conversation_engine/v2.py apply-chatgpt-patch --run-id {run_id} --review-file <path>`."
        )

    if state.current_stage in {"chatgpt_patch_applied"}:
        if state.decision == "approve_to_commit":
            return (
                "Generate the Codex commit prompt with "
                f"`python tools/conversation_engine/v2.py make-codex-commit-prompt --run-id {run_id}`."
            )
        if state.decision in {"needs_patch_after_implementation", "reject_scope"}:
            return "Follow the ChatGPT implementation review instructions manually before proceeding."
        return "Review the ChatGPT implementation review outcome before proceeding."

    if state.current_stage == "approved_for_commit":
        return (
            "Generate the Codex commit prompt with "
            f"`python tools/conversation_engine/v2.py make-codex-commit-prompt --run-id {run_id}`."
        )

    if state.current_stage == "codex_commit_prompt_ready":
        return (
            "Paste the Codex commit prompt into Codex. After commit/push are complete, run "
            f"`{wrapper_prefix} ce-finalize --run-id {run_id}`."
        )

    if state.current_stage == "finalized":
        return "Review `final_summary.md` and `.conversation_engine/latest_audit.txt` for the final recorded state."

    return "No next-step guidance is available for the current stage."


# Helper functions for writing latest audit
def build_latest_audit_text(
    repo: Repo,
    state: RunState,
    *,
    source_label: str,
    source_file: str,
    include_tests: bool = False,
) -> str:
    tests_block = ""
    if include_tests:
        tests_block = (
            "\n\n"
            "Test/build results:\n\n"
            f"{state.tests_summary or 'No tests summary captured.'}"
        )

    return textwrap.dedent(
        f"""
        Generated at: {now_utc()}
        Run ID: {state.run_id}

        1. Current system structure relevant to this mission

        Branch:
        - Current branch is `{repo.current_branch()}`.

        Current repo state:
        - The worktree is {'clean' if repo.is_clean() else 'not clean'}.
        - Current stage is `{state.current_stage}`.
        - Current decision is `{state.decision}`.
        - Expected branch is `{state.expected_branch}`.
        - Mission title is `{state.mission_title}`.

        2. Duplicated logic or drift locations

        Current drift / risk points:
        - {state.risks_summary or 'No risks summary captured.'}

        3. Canonical path to standardize around

        Canonical files currently touched:
        {chr(10).join(f'- `{f}`' for f in state.changed_files) if state.changed_files else '- None recorded'}

        4. Exact files to modify

        Mission-scoped files:
        {chr(10).join(f'- `{f}`' for f in state.changed_files) if state.changed_files else '- None recorded'}

        5. Risks

        {state.risks_summary or 'No risks summary captured.'}

        6. Implementation plan

        - Latest {source_label} captured in `{source_file}`
        - Review changed files, risks, and current branch before next mission step{tests_block}
        """
    ).strip() + "\n"


def write_latest_audit(repo: Repo, content: str) -> None:
    latest_audit_path = pathlib.Path(repo.repo_root()) / ".conversation_engine" / "latest_audit.txt"
    tmp_latest_audit_path = latest_audit_path.with_suffix(".tmp")
    try:
        latest_audit_path.parent.mkdir(parents=True, exist_ok=True)
        tmp_latest_audit_path.write_text(content, encoding="utf-8")
        tmp_latest_audit_path.replace(latest_audit_path)
    except OSError as exc:
        raise EngineError(f"Failed to update {latest_audit_path}: {exc}") from exc


class PromptBuilder:
    @staticmethod
    def codex_audit_prompt(state: RunState, mission_text: str) -> str:
        return textwrap.dedent(
            f"""
            Read this entire instruction set first before making any changes.

            EXPECTED BRANCH:
            {state.expected_branch}

            --------------------------------------------------

            BRANCH DISCIPLINE:

            - You MUST run this mission only on the expected branch.
            - If current branch is not `{state.expected_branch}`, STOP and report:
              "Incorrect branch. Expected {state.expected_branch}."
            - Do NOT create or switch branches automatically.
            - Do NOT write code yet.

            --------------------------------------------------

            PHASE:
            Pre-coding audit only.

            REQUIRED BEHAVIOR:
            - inspect mission file
            - inspect referenced source-of-truth files
            - identify risks and exact files to change
            - STOP after the audit

            --------------------------------------------------

            MISSION FILE CONTENT:

            {mission_text}

            --------------------------------------------------

            OUTPUT REQUIRED:

            Return:
            1. current system structure relevant to this mission
            2. duplicated logic or drift locations
            3. canonical path to standardize around
            4. exact files to modify
            5. risks
            6. implementation plan

            DO NOT WRITE CODE YET.
            """
        ).strip() + "\n"

    @staticmethod
    def chatgpt_review_prompt(state: RunState, mission_text: str, codex_audit: str) -> str:
        return textwrap.dedent(
            f"""
            Review this Codex pre-coding audit against the mission.

            Your job:
            - validate architectural direction
            - identify scope problems
            - approve, patch, or reject
            - if approving, provide the exact next Codex instruction block

            Mission file:
            {state.mission_file}

            Mission content:
            {mission_text}

            Codex audit output:
            {codex_audit}

            Respond in this structure:
            1. What Codex got right
            2. Risks or concerns
            3. Review decision
            4. Exact instruction block to send back to Codex
            """
        ).strip() + "\n"

    @staticmethod
    def codex_implementation_prompt(
        state: RunState,
        mission_text: str,
        codex_audit: str,
        chatgpt_review: str,
    ) -> str:
        return textwrap.dedent(
            f"""
            Read this entire instruction set first before making any changes.

            EXPECTED BRANCH:
            {state.expected_branch}

            This is the approved implementation phase for the mission below.
            Follow the mission and the review instructions exactly.

            --------------------------------------------------
            MISSION CONTENT:
            {mission_text}

            --------------------------------------------------
            CODEX AUDIT OUTPUT:
            {codex_audit}

            --------------------------------------------------
            CHATGPT REVIEW / APPROVAL:
            {chatgpt_review}

            --------------------------------------------------
            REQUIRED OUTPUT WHEN DONE:
            - exact files changed
            - summary of changes
            - test/build results
            - compatibility notes
            - known risks

            Then STOP.
            Do NOT commit, push, or open a PR.
            """
        ).strip() + "\n"

    @staticmethod
    def chatgpt_implementation_review_prompt(
        state: RunState,
        mission_text: str,
        codex_implementation: str,
    ) -> str:
        return textwrap.dedent(
            f"""
            Review this Codex implementation summary against the mission.

            Your job:
            - determine whether the mission is ready
            - approve to commit, request a patch pass, or reject scope
            - if patching is needed, provide the exact Codex patch instruction block
            - if approved, provide the exact Codex commit instruction block

            Mission file:
            {state.mission_file}

            Mission content:
            {mission_text}

            Codex implementation output:
            {codex_implementation}

            Respond in this structure:
            1. Review decision
            2. What looks good
            3. Remaining concerns
            4. Exact next Codex instruction block
            """
        ).strip() + "\n"

    @staticmethod
    def codex_commit_prompt(state: RunState, chatgpt_review: str) -> str:
        return textwrap.dedent(
            f"""
            Approved to proceed to commit and push.

            EXPECTED BRANCH:
            {state.expected_branch}

            Follow the approved commit instruction below exactly.

            --------------------------------------------------
            CHATGPT APPROVAL:
            {chatgpt_review}

            --------------------------------------------------
            REQUIRED OUTPUT WHEN DONE:
            - final files changed
            - commit hash
            - pushed branch name
            - short PR summary
            - short list of follow-up items intentionally left out of scope

            Then STOP.
            Do NOT open a PR unless explicitly instructed.
            """
        ).strip() + "\n"


def cmd_start(args: argparse.Namespace) -> int:
    repo = Repo()
    repo_root = repo.repo_root()
    mission_text = read_text_file(args.mission_file)
    mission_title = extract_mission_title(mission_text, args.mission_file)
    expected_branch = extract_branch(mission_text)
    run_id = f"{dt.datetime.now().strftime('%Y%m%d-%H%M%S')}-{slugify(mission_title)}-{uuid.uuid4().hex[:8]}"
    store = RunStore(repo_root)

    state = RunState(
        state_version=STATE_VERSION,
        run_id=run_id,
        created_at=now_utc(),
        updated_at=now_utc(),
        mission_file=args.mission_file,
        mission_title=mission_title,
        expected_branch=expected_branch,
        current_stage="started",
        repo_root=repo_root,
        mission_branch_verified=ensure_branch(repo, expected_branch),
    )

    store.write_text(run_id, "mission.md", mission_text)
    store.save_state(state)

    print(f"Run created: {run_id}")
    print(f"Mission: {mission_title}")
    print(f"Expected branch: {expected_branch}")
    print(f"Branch verified: {state.mission_branch_verified}")
    print(f"Run dir: {store.run_dir(run_id)}")
    return 0


def cmd_make_codex_audit_prompt(args: argparse.Namespace) -> int:
    repo = Repo()
    store = RunStore(repo.repo_root())
    state = store.load_state(args.run_id)
    mission_text = read_text_file(state.mission_file)
    prompt = PromptBuilder.codex_audit_prompt(state, mission_text)
    path = store.write_text(state.run_id, "prompts/codex_audit_prompt.txt", prompt)
    state.current_stage = "codex_audit_prompt_ready"
    state.mission_branch_verified = ensure_branch(repo, state.expected_branch)
    store.save_state(state)
    print(path)
    return 0


def cmd_apply_codex_audit(args: argparse.Namespace) -> int:
    repo = Repo()
    store = RunStore(repo.repo_root())
    state = store.load_state(args.run_id)
    text = normalize_response(read_text_file(args.response_file))
    path = store.write_text(state.run_id, "responses/codex_audit.txt", text)
    state.codex_audit_file = str(path.relative_to(store.run_dir(state.run_id)))
    state.current_stage = "codex_audit_applied"
    state.changed_files = extract_changed_files(text)
    state.risks_summary = extract_section(text, ["5. risks", "known risks", "risks"]) or state.risks_summary
    store.save_state(state)
    latest_audit = build_latest_audit_text(
        repo,
        state,
        source_label="Codex audit",
        source_file="responses/codex_audit.txt",
    )
    write_latest_audit(repo, latest_audit)
    print(f"Saved Codex audit: {path}")
    return 0


def cmd_make_chatgpt_review_prompt(args: argparse.Namespace) -> int:
    repo = Repo()
    store = RunStore(repo.repo_root())
    state = store.load_state(args.run_id)
    if not state.codex_audit_file:
        raise EngineError("No Codex audit applied yet.")
    mission_text = read_text_file(state.mission_file)
    codex_audit = read_text_file(str(store.run_dir(state.run_id) / state.codex_audit_file))
    prompt = PromptBuilder.chatgpt_review_prompt(state, mission_text, codex_audit)
    path = store.write_text(state.run_id, "prompts/chatgpt_review_prompt.txt", prompt)
    state.current_stage = "chatgpt_review_prompt_ready"
    store.save_state(state)
    print(path)
    return 0


def cmd_apply_chatgpt_review(args: argparse.Namespace) -> int:
    repo = Repo()
    store = RunStore(repo.repo_root())
    state = store.load_state(args.run_id)
    text = normalize_response(read_text_file(args.review_file))
    path = store.write_text(state.run_id, "responses/chatgpt_review.txt", text)
    state.chatgpt_review_file = str(path.relative_to(store.run_dir(state.run_id)))
    state.decision = classify_review_decision(text)
    state.current_stage = "chatgpt_review_applied"
    store.save_state(state)
    print(f"Saved ChatGPT review: {path}")
    print(f"Decision: {state.decision}")
    return 0


def cmd_make_codex_implementation_prompt(args: argparse.Namespace) -> int:
    repo = Repo()
    store = RunStore(repo.repo_root())
    state = store.load_state(args.run_id)
    if not state.codex_audit_file or not state.chatgpt_review_file:
        raise EngineError("Need both Codex audit and ChatGPT review before implementation prompt.")
    mission_text = read_text_file(state.mission_file)
    codex_audit = read_text_file(str(store.run_dir(state.run_id) / state.codex_audit_file))
    chatgpt_review = read_text_file(str(store.run_dir(state.run_id) / state.chatgpt_review_file))
    prompt = PromptBuilder.codex_implementation_prompt(state, mission_text, codex_audit, chatgpt_review)
    path = store.write_text(state.run_id, "prompts/codex_implementation_prompt.txt", prompt)
    state.current_stage = "codex_implementation_prompt_ready"
    store.save_state(state)
    print(path)
    return 0


def cmd_apply_codex_implementation(args: argparse.Namespace) -> int:
    repo = Repo()
    store = RunStore(repo.repo_root())
    state = store.load_state(args.run_id)
    text = normalize_response(read_text_file(args.response_file))
    path = store.write_text(state.run_id, "responses/codex_implementation.txt", text)
    state.codex_implementation_file = str(path.relative_to(store.run_dir(state.run_id)))
    state.current_stage = "codex_implementation_applied"
    files = extract_changed_files(text)
    if files:
        state.changed_files = files
    state.tests_summary = extract_section(text, ["test/build results", "updated test/build results"]) or state.tests_summary
    state.risks_summary = extract_section(text, ["known risks", "remaining risks", "risks"]) or state.risks_summary
    store.save_state(state)
    latest_audit = build_latest_audit_text(
        repo,
        state,
        source_label="Codex implementation",
        source_file="responses/codex_implementation.txt",
        include_tests=True,
    )
    write_latest_audit(repo, latest_audit)
    print(f"Saved Codex implementation: {path}")
    return 0


def cmd_make_chatgpt_implementation_review_prompt(args: argparse.Namespace) -> int:
    repo = Repo()
    store = RunStore(repo.repo_root())
    state = store.load_state(args.run_id)
    if not state.codex_implementation_file:
        raise EngineError("No Codex implementation response applied yet.")
    mission_text = read_text_file(state.mission_file)
    codex_impl = read_text_file(str(store.run_dir(state.run_id) / state.codex_implementation_file))
    prompt = PromptBuilder.chatgpt_implementation_review_prompt(state, mission_text, codex_impl)
    path = store.write_text(state.run_id, "prompts/chatgpt_implementation_review_prompt.txt", prompt)
    state.current_stage = "chatgpt_implementation_review_prompt_ready"
    store.save_state(state)
    print(path)
    return 0


def cmd_apply_chatgpt_patch(args: argparse.Namespace) -> int:
    repo = Repo()
    store = RunStore(repo.repo_root())
    state = store.load_state(args.run_id)
    text = normalize_response(read_text_file(args.review_file))
    path = store.write_text(state.run_id, "responses/chatgpt_patch_or_commit_review.txt", text)
    state.chatgpt_patch_file = str(path.relative_to(store.run_dir(state.run_id)))
    state.decision = classify_review_decision(text)
    state.current_stage = "chatgpt_patch_applied"
    if state.decision == "approve_to_commit":
        state.current_stage = "approved_for_commit"
    store.save_state(state)
    print(f"Saved ChatGPT implementation review: {path}")
    print(f"Decision: {state.decision}")
    return 0


def cmd_make_codex_commit_prompt(args: argparse.Namespace) -> int:
    repo = Repo()
    store = RunStore(repo.repo_root())
    state = store.load_state(args.run_id)
    if state.current_stage != "approved_for_commit" or not state.chatgpt_patch_file:
        raise EngineError("Run is not approved for commit yet.")
    review = read_text_file(str(store.run_dir(state.run_id) / state.chatgpt_patch_file))
    prompt = PromptBuilder.codex_commit_prompt(state, review)
    path = store.write_text(state.run_id, "prompts/codex_commit_prompt.txt", prompt)
    state.current_stage = "codex_commit_prompt_ready"
    store.save_state(state)
    print(path)
    return 0


def cmd_finalize_summary(args: argparse.Namespace) -> int:
    repo = Repo()
    store = RunStore(repo.repo_root())
    state = store.load_state(args.run_id)
    summary = textwrap.dedent(
        f"""
        # Conversation Engine v2 Summary

        - Run ID: {state.run_id}
        - Mission: {state.mission_title}
        - Mission file: {state.mission_file}
        - Expected branch: {state.expected_branch}
        - Branch verified at start: {state.mission_branch_verified}
        - Current stage: {state.current_stage}
        - Decision: {state.decision}

        ## Changed files
        {chr(10).join(f'- {f}' for f in state.changed_files) if state.changed_files else '- None recorded'}

        ## Tests summary
        {state.tests_summary or 'No tests summary captured.'}

        ## Risks summary
        {state.risks_summary or 'No risks summary captured.'}
        """
    ).strip() + "\n"
    path = store.write_text(state.run_id, "final_summary.md", summary)
    state.current_stage = "finalized"
    store.save_state(state)
    latest_audit = build_latest_audit_text(
        repo,
        state,
        source_label="final summary",
        source_file="final_summary.md",
        include_tests=True,
    )
    write_latest_audit(repo, latest_audit)
    print(path)
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Conversation Engine v2")
    sub = parser.add_subparsers(dest="command", required=True)

    start = sub.add_parser("start", help="Create a new mission run")
    start.add_argument("--mission-file", required=True)
    start.set_defaults(func=cmd_start)

    make_codex_audit = sub.add_parser("make-codex-audit-prompt", help="Generate Codex audit prompt")
    make_codex_audit.add_argument("--run-id", required=True)
    make_codex_audit.set_defaults(func=cmd_make_codex_audit_prompt)

    apply_codex_audit = sub.add_parser("apply-codex-audit", help="Store Codex audit response")
    apply_codex_audit.add_argument("--run-id", required=True)
    apply_codex_audit.add_argument("--response-file", required=True)
    apply_codex_audit.set_defaults(func=cmd_apply_codex_audit)

    make_chatgpt_review = sub.add_parser("make-chatgpt-review-prompt", help="Generate ChatGPT review prompt")
    make_chatgpt_review.add_argument("--run-id", required=True)
    make_chatgpt_review.set_defaults(func=cmd_make_chatgpt_review_prompt)

    apply_chatgpt_review = sub.add_parser("apply-chatgpt-review", help="Store ChatGPT review response")
    apply_chatgpt_review.add_argument("--run-id", required=True)
    apply_chatgpt_review.add_argument("--review-file", required=True)
    apply_chatgpt_review.set_defaults(func=cmd_apply_chatgpt_review)

    make_codex_impl = sub.add_parser("make-codex-implementation-prompt", help="Generate Codex implementation prompt")
    make_codex_impl.add_argument("--run-id", required=True)
    make_codex_impl.set_defaults(func=cmd_make_codex_implementation_prompt)

    apply_codex_impl = sub.add_parser("apply-codex-implementation", help="Store Codex implementation summary")
    apply_codex_impl.add_argument("--run-id", required=True)
    apply_codex_impl.add_argument("--response-file", required=True)
    apply_codex_impl.set_defaults(func=cmd_apply_codex_implementation)

    make_chatgpt_impl_review = sub.add_parser(
        "make-chatgpt-implementation-review-prompt",
        help="Generate ChatGPT implementation review prompt",
    )
    make_chatgpt_impl_review.add_argument("--run-id", required=True)
    make_chatgpt_impl_review.set_defaults(func=cmd_make_chatgpt_implementation_review_prompt)

    apply_chatgpt_patch = sub.add_parser(
        "apply-chatgpt-patch",
        help="Store ChatGPT patch/commit review response",
    )
    apply_chatgpt_patch.add_argument("--run-id", required=True)
    apply_chatgpt_patch.add_argument("--review-file", required=True)
    apply_chatgpt_patch.set_defaults(func=cmd_apply_chatgpt_patch)

    make_codex_commit = sub.add_parser("make-codex-commit-prompt", help="Generate Codex commit prompt")
    make_codex_commit.add_argument("--run-id", required=True)
    make_codex_commit.set_defaults(func=cmd_make_codex_commit_prompt)

    finalize = sub.add_parser("finalize-summary", help="Generate final summary")
    finalize.add_argument("--run-id", required=True)
    finalize.set_defaults(func=cmd_finalize_summary)

    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    try:
        return int(args.func(args))
    except EngineError as exc:
        print(f"Engine error: {exc}", file=sys.stderr)
        return 1
    except KeyboardInterrupt:
        print("Interrupted.", file=sys.stderr)
        return 130


if __name__ == "__main__":
    raise SystemExit(main())
