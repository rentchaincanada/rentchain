#!/usr/bin/env python3
from __future__ import annotations

import argparse
import pathlib
import re
import subprocess
import sys
import textwrap


THIS_DIR = pathlib.Path(__file__).resolve().parent
if str(THIS_DIR) not in sys.path:
    sys.path.insert(0, str(THIS_DIR))

import v2


def resolve_run_id(store: v2.RunStore, explicit_run_id: str | None) -> str:
    if explicit_run_id:
        return explicit_run_id
    latest = store.latest_run_id()
    if not latest:
        raise v2.EngineError("No conversation_engine runs exist yet.")
    return latest


def sanitize_name(value: str) -> str:
    value = value.strip().lower().replace(" ", "_").replace("-", "_")
    value = re.sub(r"[^a-z0-9_]+", "_", value)
    value = re.sub(r"_+", "_", value).strip("_")
    return value


def normalize_paste_kind(value: str) -> str:
    normalized = sanitize_name(value)
    aliases = {
        "codex_audit": "codex_audit",
        "audit": "codex_audit",
        "chatgpt_review": "chatgpt_review",
        "review": "chatgpt_review",
        "implementation": "implementation",
        "codex_implementation": "implementation",
        "chatgpt_patch": "chatgpt_patch",
        "patch": "chatgpt_patch",
        "commit": "commit",
        "codex_commit": "commit",
    }
    return aliases.get(normalized, normalized)


def render_status(repo: v2.Repo, store: v2.RunStore, state: v2.RunState) -> str:
    artifacts = v2.run_artifact_paths(store, state)
    artifact_lines = [
        f"- mission: {'yes' if artifacts['mission'].exists() else 'no'}",
        f"- codex audit prompt: {'yes' if artifacts['codex_audit_prompt'].exists() else 'no'}",
        f"- chatgpt review prompt: {'yes' if artifacts['chatgpt_review_prompt'].exists() else 'no'}",
        f"- codex implementation prompt: {'yes' if artifacts['codex_implementation_prompt'].exists() else 'no'}",
        f"- chatgpt implementation review prompt: {'yes' if artifacts['chatgpt_implementation_review_prompt'].exists() else 'no'}",
        f"- codex commit prompt: {'yes' if artifacts['codex_commit_prompt'].exists() else 'no'}",
        f"- final summary: {'yes' if artifacts['final_summary'].exists() else 'no'}",
    ]

    return textwrap.dedent(
        f"""
        Conversation Engine Status

        - Run ID: {state.run_id}
        - Mission: {state.mission_title}
        - Mission file: {state.mission_file}
        - Current branch: {repo.current_branch()}
        - Expected branch: {state.expected_branch}
        - Branch verified: {state.mission_branch_verified}
        - Current stage: {state.current_stage}
        - Decision: {state.decision}
        - Worktree clean: {'yes' if repo.is_clean() else 'no'}
        - Latest audit: {artifacts['latest_audit']}

        Artifact presence:
        {chr(10).join(artifact_lines)}

        Next step:
        - {v2.next_step_hint(state)}
        """
    ).strip() + "\n"


def mission_template(mission_title: str, branch: str, objective: str | None) -> str:
    objective_text = objective.strip() if objective else "<One-paragraph summary of the intended workflow improvement>"
    return textwrap.dedent(
        f"""
        MISSION: {mission_title}

        BRANCH:
        {branch}

        ## Objective
        {objective_text}

        ## Required read order
        1. AGENTS.md
        2. PROCESS.md
        3. codex.md
        4. docs/execution/CURRENT_MISSION.md if present
        5. Relevant mission examples in docs/missions/
        6. Then inspect the code directly relevant to this mission

        ## Context
        - <List the existing system this mission extends>

        ## In scope
        - <scoped item>
        - <scoped item>
        - additive implementation only

        ## Out of scope
        - <out-of-scope item>
        - <out-of-scope item>
        - removing approval gates

        ## Acceptance criteria
        - implementation exists
        - workflow remains explicit and review-gated
        - tests/builds pass
        """
    ).strip() + "\n"


def cmd_ce_new(args: argparse.Namespace) -> int:
    repo = v2.Repo()
    repo_root = pathlib.Path(repo.repo_root())
    output = pathlib.Path(args.output) if args.output else repo_root / "docs" / "missions" / f"mission-{v2.slugify(args.mission_title)}.md"
    if output.exists() and not args.force:
        raise v2.EngineError(f"Mission file already exists: {output}")

    content = mission_template(args.mission_title, args.branch, args.objective)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(content, encoding="utf-8")

    print(output)
    print(f"Next step: python tools/conversation_engine/ce.py ce-start --mission-file {output}")
    return 0


def cmd_ce_start(args: argparse.Namespace) -> int:
    repo = v2.Repo()
    store = v2.RunStore(repo.repo_root())
    before = store.latest_run_id()
    v2.cmd_start(argparse.Namespace(mission_file=args.mission_file))
    after = store.latest_run_id()
    run_id = after
    if run_id is None or run_id == before and before is None:
        raise v2.EngineError("Unable to determine newly created run id.")

    v2.cmd_make_codex_audit_prompt(argparse.Namespace(run_id=run_id))
    state = store.load_state(run_id)
    prompt_path = store.run_dir(run_id) / "prompts" / "codex_audit_prompt.txt"

    print(f"Run ID: {run_id}")
    print(f"Codex audit prompt: {prompt_path}")
    print(f"Next step: {v2.next_step_hint(state)}")
    return 0


def cmd_ce_paste(args: argparse.Namespace) -> int:
    repo = v2.Repo()
    store = v2.RunStore(repo.repo_root())
    run_id = resolve_run_id(store, args.run_id)
    suffix = normalize_paste_kind(args.name)
    output_path = pathlib.Path(f"/tmp/{run_id}_{suffix}.txt")

    try:
        content = subprocess.check_output(["pbpaste"], text=True)
    except Exception as exc:  # pragma: no cover - platform/clipboard dependent
        raise v2.EngineError(f"Unable to read clipboard with pbpaste: {exc}") from exc

    output_path.write_text(content, encoding="utf-8")
    print(output_path)
    return 0


def cmd_ce_status(args: argparse.Namespace) -> int:
    repo = v2.Repo()
    store = v2.RunStore(repo.repo_root())
    run_id = resolve_run_id(store, args.run_id)
    state = store.load_state(run_id)
    print(render_status(repo, store, state), end="")
    return 0


def cmd_ce_next(args: argparse.Namespace) -> int:
    repo = v2.Repo()
    store = v2.RunStore(repo.repo_root())
    run_id = resolve_run_id(store, args.run_id)
    state = store.load_state(run_id)
    print(v2.next_step_hint(state))
    return 0


def cmd_ce_apply_codex_audit(args: argparse.Namespace) -> int:
    repo = v2.Repo()
    store = v2.RunStore(repo.repo_root())
    run_id = resolve_run_id(store, args.run_id)
    v2.cmd_apply_codex_audit(argparse.Namespace(run_id=run_id, response_file=args.response_file))
    v2.cmd_make_chatgpt_review_prompt(argparse.Namespace(run_id=run_id))
    state = store.load_state(run_id)
    prompt_path = store.run_dir(run_id) / "prompts" / "chatgpt_review_prompt.txt"

    print(f"ChatGPT review prompt: {prompt_path}")
    print(f"Next step: {v2.next_step_hint(state)}")
    print("Fast mode: ce-paste chatgpt-review && ce-apply-chatgpt-review --review-file <paste-output>")
    return 0


def cmd_ce_apply_chatgpt_review(args: argparse.Namespace) -> int:
    repo = v2.Repo()
    store = v2.RunStore(repo.repo_root())
    run_id = resolve_run_id(store, args.run_id)
    v2.cmd_apply_chatgpt_review(argparse.Namespace(run_id=run_id, review_file=args.review_file))
    state = store.load_state(run_id)

    if state.decision == "approve_to_implement":
        v2.cmd_make_codex_implementation_prompt(argparse.Namespace(run_id=run_id))
        state = store.load_state(run_id)
        prompt_path = store.run_dir(run_id) / "prompts" / "codex_implementation_prompt.txt"
        print(f"Codex implementation prompt: {prompt_path}")
    else:
        print(f"Decision: {state.decision}")

    print(f"Next step: {v2.next_step_hint(state)}")
    if state.decision == "approve_to_implement":
        print("Fast mode: ce-paste implementation && ce-apply-codex-implementation --response-file <paste-output>")
    return 0


def cmd_ce_apply_codex_implementation(args: argparse.Namespace) -> int:
    repo = v2.Repo()
    store = v2.RunStore(repo.repo_root())
    run_id = resolve_run_id(store, args.run_id)
    v2.cmd_apply_codex_implementation(argparse.Namespace(run_id=run_id, response_file=args.response_file))
    v2.cmd_make_chatgpt_implementation_review_prompt(argparse.Namespace(run_id=run_id))
    state = store.load_state(run_id)
    prompt_path = store.run_dir(run_id) / "prompts" / "chatgpt_implementation_review_prompt.txt"

    print(f"ChatGPT implementation review prompt: {prompt_path}")
    print(f"Next step: {v2.next_step_hint(state)}")
    print("Fast mode: ce-paste chatgpt-patch && ce-apply-chatgpt-patch --review-file <paste-output>")
    return 0


# New function: cmd_ce_apply_chatgpt_patch
def cmd_ce_apply_chatgpt_patch(args: argparse.Namespace) -> int:
    repo = v2.Repo()
    store = v2.RunStore(repo.repo_root())
    run_id = resolve_run_id(store, args.run_id)
    v2.cmd_apply_chatgpt_patch(argparse.Namespace(run_id=run_id, review_file=args.review_file))
    state = store.load_state(run_id)

    print(f"Decision: {state.decision}")
    print(f"Next step: {v2.next_step_hint(state)}")
    if state.current_stage == "approved_for_commit":
        print("Fast mode: ce-paste commit && ce-make-codex-commit-prompt")
    return 0


# Wrapper for generating the Codex commit prompt
def cmd_ce_make_codex_commit_prompt(args: argparse.Namespace) -> int:
    repo = v2.Repo()
    store = v2.RunStore(repo.repo_root())
    run_id = resolve_run_id(store, args.run_id)
    v2.cmd_make_codex_commit_prompt(argparse.Namespace(run_id=run_id))
    state = store.load_state(run_id)
    prompt_path = store.run_dir(run_id) / "prompts" / "codex_commit_prompt.txt"

    print(f"Codex commit prompt: {prompt_path}")
    print(f"Next step: {v2.next_step_hint(state)}")
    print("Fast mode: ce-paste commit && ce-apply-codex-commit --response-file <paste-output> && ce-finalize")
    return 0


# Wrapper for saving/applying the final Codex commit response before finalization
def cmd_ce_apply_codex_commit(args: argparse.Namespace) -> int:
    repo = v2.Repo()
    store = v2.RunStore(repo.repo_root())
    run_id = resolve_run_id(store, args.run_id)
    v2.cmd_apply_codex_implementation(argparse.Namespace(run_id=run_id, response_file=args.response_file))
    state = store.load_state(run_id)
    artifacts = v2.run_artifact_paths(store, state)

    print(f"Saved final Codex response to: {artifacts['codex_implementation_response']}")
    print(f"Decision: {state.decision}")
    print("Next step: ce-finalize --run-id \"<current-run>\"")
    print("Fast mode: ce-finalize")
    return 0


def cmd_ce_finalize(args: argparse.Namespace) -> int:
    repo = v2.Repo()
    store = v2.RunStore(repo.repo_root())
    run_id = resolve_run_id(store, args.run_id)
    v2.cmd_finalize_summary(argparse.Namespace(run_id=run_id))
    state = store.load_state(run_id)
    artifacts = v2.run_artifact_paths(store, state)

    print(f"Final summary: {artifacts['final_summary']}")
    print(f"Latest audit: {artifacts['latest_audit']}")
    print(f"Persisted final Codex response: {artifacts['codex_implementation_response']}")
    print(f"Next step: {v2.next_step_hint(state)}")
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Conversation Engine wrapper CLI")
    sub = parser.add_subparsers(dest="command", required=True)

    ce_new = sub.add_parser("ce-new", help="Create a parser-safe mission file")
    ce_new.add_argument("--mission-title", required=True)
    ce_new.add_argument("--branch", required=True)
    ce_new.add_argument("--objective")
    ce_new.add_argument("--output")
    ce_new.add_argument("--force", action="store_true")
    ce_new.set_defaults(func=cmd_ce_new)

    ce_start = sub.add_parser("ce-start", help="Create a run and generate the first Codex audit prompt")
    ce_start.add_argument("--mission-file", required=True)
    ce_start.set_defaults(func=cmd_ce_start)

    ce_paste = sub.add_parser(
        "ce-paste",
        help="Save clipboard contents to a run-scoped /tmp file without needing a manual RUN_ID",
    )
    ce_paste.add_argument(
        "name",
        help="File kind or base name, e.g. codex-audit, chatgpt-review, implementation, chatgpt-patch",
    )
    ce_paste.add_argument("--run-id")
    ce_paste.set_defaults(func=cmd_ce_paste)

    ce_status = sub.add_parser("ce-status", help="Show dashboard-style run status")
    ce_status.add_argument("--run-id")
    ce_status.set_defaults(func=cmd_ce_status)

    ce_next = sub.add_parser("ce-next", help="Print the next safe advisory step")
    ce_next.add_argument("--run-id")
    ce_next.set_defaults(func=cmd_ce_next)

    ce_apply_codex_audit = sub.add_parser("ce-apply-codex-audit", help="Apply Codex audit and generate ChatGPT review prompt")
    ce_apply_codex_audit.add_argument("--run-id")
    ce_apply_codex_audit.add_argument("--response-file", required=True)
    ce_apply_codex_audit.set_defaults(func=cmd_ce_apply_codex_audit)

    ce_apply_chatgpt_review = sub.add_parser(
        "ce-apply-chatgpt-review",
        help="Apply ChatGPT review and generate Codex implementation prompt when approved",
    )
    ce_apply_chatgpt_review.add_argument("--run-id")
    ce_apply_chatgpt_review.add_argument("--review-file", required=True)
    ce_apply_chatgpt_review.set_defaults(func=cmd_ce_apply_chatgpt_review)

    ce_apply_codex_implementation = sub.add_parser(
        "ce-apply-codex-implementation",
        help="Apply Codex implementation and generate ChatGPT implementation review prompt",
    )
    ce_apply_codex_implementation.add_argument("--run-id")
    ce_apply_codex_implementation.add_argument("--response-file", required=True)
    ce_apply_codex_implementation.set_defaults(func=cmd_ce_apply_codex_implementation)


    ce_apply_chatgpt_patch = sub.add_parser(
        "ce-apply-chatgpt-patch",
        help="Apply ChatGPT implementation review without requiring a manual RUN_ID",
    )
    ce_apply_chatgpt_patch.add_argument("--run-id")
    ce_apply_chatgpt_patch.add_argument("--review-file", required=True)
    ce_apply_chatgpt_patch.set_defaults(func=cmd_ce_apply_chatgpt_patch)

    ce_make_codex_commit_prompt = sub.add_parser(
        "ce-make-codex-commit-prompt",
        help="Generate the Codex commit prompt without requiring a manual RUN_ID",
    )
    ce_make_codex_commit_prompt.add_argument("--run-id")
    ce_make_codex_commit_prompt.set_defaults(func=cmd_ce_make_codex_commit_prompt)

    ce_apply_codex_commit = sub.add_parser(
        "ce-apply-codex-commit",
        help="Persist the final Codex commit response before finalization without requiring a manual RUN_ID",
    )
    ce_apply_codex_commit.add_argument("--run-id")
    ce_apply_codex_commit.add_argument("--response-file", required=True)
    ce_apply_codex_commit.set_defaults(func=cmd_ce_apply_codex_commit)

    ce_finalize = sub.add_parser("ce-finalize", help="Finalize the run and print summary paths")
    ce_finalize.add_argument("--run-id")
    ce_finalize.set_defaults(func=cmd_ce_finalize)

    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args_list = list(argv if argv is not None else sys.argv[1:])

    if not args_list:
        invoked_as = pathlib.Path(sys.argv[0]).name
        if invoked_as.startswith("ce-"):
            args_list = [invoked_as]

    args = parser.parse_args(args_list)
    try:
        return int(args.func(args))
    except v2.EngineError as exc:
        print(f"Engine error: {exc}", file=sys.stderr)
        return 1
    except KeyboardInterrupt:
        print("Interrupted.", file=sys.stderr)
        return 130


if __name__ == "__main__":
    raise SystemExit(main())
