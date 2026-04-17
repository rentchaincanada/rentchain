#!/usr/bin/env python3
"""
Conversation Engine v1

Purpose
- Turn ChatGPT into planner/reviewer and Codex into implementer.
- Run a disciplined loop for branch-per-mission development.
- Keep a full local audit trail under .conversation_engine/.

What it does
1) Accepts a mission brief.
2) Asks ChatGPT to produce an implementation plan.
3) Sends the plan to Codex CLI for code changes.
4) Runs tests/build commands.
5) Captures git diff.
6) Asks ChatGPT to review the diff + test results.
7) Repeats until approved or max rounds reached.

Requirements
- Python 3.11+
- OPENAI_API_KEY set in environment
- Codex CLI installed and available on PATH
- Run inside a git repository

Example
    python conversation_engine.py \
      --mission-file docs/missions/mission-20.md \
      --branch feat/tenant-applicant-feedback-loop-v1 \
      --test-cmd "npm test -- --runInBand" \
      --build-cmd "npm run build"

Notes
- This script is intentionally conservative.
- It does not auto-commit unless you pass --auto-commit.
- It stores every prompt, reply, diff, and test log.
"""

from __future__ import annotations

import argparse
import dataclasses
import datetime as dt
import json
import os
import pathlib
import shutil
import subprocess
import sys
import textwrap
import time
import urllib.error
import urllib.request
from typing import Any


ENGINE_DIR = ".conversation_engine"
DEFAULT_PLANNER_MODEL = "gpt-5"
DEFAULT_REVIEWER_MODEL = "gpt-5"
DEFAULT_MAX_ROUNDS = 3
DEFAULT_TIMEOUT_SECONDS = 60 * 20


class EngineError(RuntimeError):
    pass


@dataclasses.dataclass
class CommandResult:
    command: str
    returncode: int
    stdout: str
    stderr: str

    @property
    def ok(self) -> bool:
        return self.returncode == 0


@dataclasses.dataclass
class EngineConfig:
    mission_text: str
    branch: str | None
    planner_model: str = DEFAULT_PLANNER_MODEL
    reviewer_model: str = DEFAULT_REVIEWER_MODEL
    test_cmd: str | None = None
    build_cmd: str | None = None
    setup_cmd: str | None = None
    max_rounds: int = DEFAULT_MAX_ROUNDS
    codex_cmd: str = "codex"
    auto_commit: bool = False
    timeout_seconds: int = DEFAULT_TIMEOUT_SECONDS
    repo_name: str = ""
    repo_root: str = ""


@dataclasses.dataclass
class RoundArtifacts:
    round_index: int
    planner_prompt_path: str
    planner_response_path: str
    codex_prompt_path: str
    codex_output_path: str
    diff_path: str
    test_log_path: str | None
    build_log_path: str | None
    reviewer_prompt_path: str
    reviewer_response_path: str


class Logger:
    def __init__(self, run_dir: pathlib.Path) -> None:
        self.run_dir = run_dir
        self.run_dir.mkdir(parents=True, exist_ok=True)

    def write_text(self, relative_path: str, content: str) -> pathlib.Path:
        path = self.run_dir / relative_path
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")
        return path

    def write_json(self, relative_path: str, payload: Any) -> pathlib.Path:
        return self.write_text(relative_path, json.dumps(payload, indent=2, ensure_ascii=False))


class Shell:
    @staticmethod
    def run(command: str, cwd: str, timeout_seconds: int) -> CommandResult:
        process = subprocess.run(
            command,
            cwd=cwd,
            shell=True,
            text=True,
            capture_output=True,
            timeout=timeout_seconds,
        )
        return CommandResult(
            command=command,
            returncode=process.returncode,
            stdout=process.stdout,
            stderr=process.stderr,
        )


class Git:
    def __init__(self, repo_root: str, timeout_seconds: int) -> None:
        self.repo_root = repo_root
        self.timeout_seconds = timeout_seconds

    def ensure_repo(self) -> None:
        result = Shell.run("git rev-parse --is-inside-work-tree", self.repo_root, self.timeout_seconds)
        if not result.ok or result.stdout.strip() != "true":
            raise EngineError("Current directory is not a git repository.")

    def current_branch(self) -> str:
        result = Shell.run("git branch --show-current", self.repo_root, self.timeout_seconds)
        if not result.ok:
            raise EngineError(result.stderr or "Unable to determine current branch.")
        return result.stdout.strip()

    def status_porcelain(self) -> str:
        result = Shell.run("git status --porcelain", self.repo_root, self.timeout_seconds)
        if not result.ok:
            raise EngineError(result.stderr or "Unable to read git status.")
        return result.stdout

    def diff(self) -> str:
        result = Shell.run("git diff -- . ':(exclude).conversation_engine'", self.repo_root, self.timeout_seconds)
        if not result.ok:
            raise EngineError(result.stderr or "Unable to read git diff.")
        return result.stdout

    def add_all(self) -> None:
        result = Shell.run("git add -A", self.repo_root, self.timeout_seconds)
        if not result.ok:
            raise EngineError(result.stderr or "git add failed.")

    def commit(self, message: str) -> None:
        safe_message = message.replace('"', "'")
        result = Shell.run(f'git commit -m "{safe_message}"', self.repo_root, self.timeout_seconds)
        if not result.ok:
            raise EngineError(result.stderr or "git commit failed.")


class OpenAIResponsesClient:
    def __init__(self, api_key: str) -> None:
        self.api_key = api_key
        self.url = "https://api.openai.com/v1/responses"

    def generate(self, model: str, instructions: str, user_input: str) -> str:
        payload = {
            "model": model,
            "instructions": instructions,
            "input": user_input,
        }
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            self.url,
            data=data,
            method="POST",
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.api_key}",
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=120) as response:
                raw = response.read().decode("utf-8")
        except urllib.error.HTTPError as exc:
            body = exc.read().decode("utf-8", errors="replace")
            raise EngineError(f"OpenAI API error: {exc.code} {body}") from exc
        except urllib.error.URLError as exc:
            raise EngineError(f"OpenAI API connection error: {exc}") from exc

        parsed = json.loads(raw)
        output_text = parsed.get("output_text", "").strip()
        if output_text:
            return output_text

        texts: list[str] = []
        for item in parsed.get("output", []):
            for content in item.get("content", []):
                if content.get("type") == "output_text":
                    texts.append(content.get("text", ""))
        joined = "\n".join(part for part in texts if part).strip()
        if not joined:
            raise EngineError("OpenAI response did not include output text.")
        return joined


class CodexRunner:
    def __init__(self, codex_cmd: str, repo_root: str, timeout_seconds: int) -> None:
        self.codex_cmd = codex_cmd
        self.repo_root = repo_root
        self.timeout_seconds = timeout_seconds

    def run(self, prompt: str) -> CommandResult:
        quoted_prompt = prompt.replace('"', '\\"')
        command = f'{self.codex_cmd} exec "{quoted_prompt}"'
        return Shell.run(command, self.repo_root, self.timeout_seconds)


class ConversationEngine:
    def __init__(self, config: EngineConfig) -> None:
        api_key = os.getenv("OPENAI_API_KEY", "").strip()
        if not api_key:
            raise EngineError("OPENAI_API_KEY is not set.")

        self.config = config
        self.client = OpenAIResponsesClient(api_key=api_key)
        self.git = Git(config.repo_root, config.timeout_seconds)
        self.codex = CodexRunner(config.codex_cmd, config.repo_root, config.timeout_seconds)

        timestamp = dt.datetime.now().strftime("%Y%m%d-%H%M%S")
        self.run_dir = pathlib.Path(config.repo_root) / ENGINE_DIR / timestamp
        self.logger = Logger(self.run_dir)

    def preflight(self) -> None:
        self.git.ensure_repo()
        current_branch = self.git.current_branch()
        if self.config.branch and current_branch != self.config.branch:
            raise EngineError(
                f"Current branch is '{current_branch}', expected '{self.config.branch}'. "
                "Checkout the target branch first."
            )

        codex_path = shutil.which(self.config.codex_cmd)
        if not codex_path:
            raise EngineError(f"Codex CLI not found on PATH: {self.config.codex_cmd}")

        dirty = self.git.status_porcelain().strip()
        if dirty:
            raise EngineError(
                "Working tree is not clean. Commit or stash changes before running the engine."
            )

        if self.config.setup_cmd:
            setup_result = Shell.run(
                self.config.setup_cmd,
                self.config.repo_root,
                self.config.timeout_seconds,
            )
            self.logger.write_text(
                "preflight/setup.log",
                self._format_command_result(setup_result),
            )
            if not setup_result.ok:
                raise EngineError("Setup command failed. See .conversation_engine preflight logs.")

    def run(self) -> None:
        self.preflight()
        self.logger.write_json("run/config.json", dataclasses.asdict(self.config))

        reviewer_feedback = ""
        approved = False
        round_artifacts: list[RoundArtifacts] = []

        for round_index in range(1, self.config.max_rounds + 1):
            plan = self._planner_step(round_index, reviewer_feedback)
            codex_result = self._codex_step(round_index, plan, reviewer_feedback)
            diff_text = self.git.diff()
            test_result = self._optional_command(self.config.test_cmd)
            build_result = self._optional_command(self.config.build_cmd)
            review = self._reviewer_step(
                round_index=round_index,
                mission_text=self.config.mission_text,
                plan=plan,
                codex_output=self._format_command_result(codex_result),
                diff_text=diff_text,
                test_result=test_result,
                build_result=build_result,
            )

            artifacts = self._save_round(
                round_index=round_index,
                plan=plan,
                codex_prompt=self._codex_prompt(plan, reviewer_feedback),
                codex_output=self._format_command_result(codex_result),
                diff_text=diff_text,
                test_result=test_result,
                build_result=build_result,
                review=review,
            )
            round_artifacts.append(artifacts)

            if self._is_approved(review):
                approved = True
                break

            reviewer_feedback = review

        summary = self._final_summary(approved, round_artifacts)
        self.logger.write_text("run/summary.md", summary)
        print(summary)

        if approved and self.config.auto_commit:
            self.git.add_all()
            self.git.commit("feat: conversation engine approved implementation")
            print("\nAuto-commit complete.")

    def _planner_step(self, round_index: int, reviewer_feedback: str) -> str:
        instructions = textwrap.dedent(
            """
            You are the software planner.
            Produce a concise implementation plan for Codex.
            Requirements:
            - Keep scope tightly limited to the mission.
            - Prefer minimum high-confidence changes.
            - Name likely files to touch.
            - Include test intent.
            - Do not include marketing fluff.
            - Output sections exactly:
              1. Objective
              2. Constraints
              3. Files Likely Affected
              4. Implementation Plan
              5. Test Plan
            """
        ).strip()

        user_input = textwrap.dedent(
            f"""
            Repository: {self.config.repo_name}
            Round: {round_index}

            Mission:
            {self.config.mission_text}

            Prior reviewer feedback:
            {reviewer_feedback or 'None'}
            """
        ).strip()

        response = self.client.generate(
            model=self.config.planner_model,
            instructions=instructions,
            user_input=user_input,
        )
        return response.strip()

    def _codex_prompt(self, plan: str, reviewer_feedback: str) -> str:
        return textwrap.dedent(
            f"""
            Follow this mission plan exactly and keep scope disciplined.

            Mission:
            {self.config.mission_text}

            Plan:
            {plan}

            Reviewer feedback from previous round:
            {reviewer_feedback or 'None'}

            Rules:
            - Make the smallest correct set of changes.
            - Preserve existing conventions.
            - Do not add unrelated refactors.
            - Prefer deterministic tests.
            - Stop when the mission is complete.
            - Summarize exactly what you changed.
            """
        ).strip()

    def _codex_step(self, round_index: int, plan: str, reviewer_feedback: str) -> CommandResult:
        prompt = self._codex_prompt(plan, reviewer_feedback)
        self.logger.write_text(f"rounds/{round_index:02d}/codex_prompt.txt", prompt)
        result = self.codex.run(prompt)
        self.logger.write_text(
            f"rounds/{round_index:02d}/codex_output.txt",
            self._format_command_result(result),
        )
        return result

    def _reviewer_step(
        self,
        round_index: int,
        mission_text: str,
        plan: str,
        codex_output: str,
        diff_text: str,
        test_result: CommandResult | None,
        build_result: CommandResult | None,
    ) -> str:
        instructions = textwrap.dedent(
            """
            You are the code reviewer and release gate.
            Review whether the diff satisfies the mission.
            You must be strict, practical, and concise.
            Output sections exactly:
            1. Verdict: APPROVED or REVISE
            2. Scope Check
            3. Correctness Risks
            4. Test Assessment
            5. Required Fixes
            6. Final Notes
            Approve only if the mission appears complete and no material issues remain.
            """
        ).strip()

        test_block = self._format_command_result(test_result) if test_result else "No test command configured."
        build_block = self._format_command_result(build_result) if build_result else "No build command configured."

        user_input = textwrap.dedent(
            f"""
            Repository: {self.config.repo_name}
            Round: {round_index}

            Mission:
            {mission_text}

            Planner output:
            {plan}

            Codex execution summary:
            {codex_output}

            Git diff:
            {diff_text or 'No diff produced.'}

            Test result:
            {test_block}

            Build result:
            {build_block}
            """
        ).strip()

        review = self.client.generate(
            model=self.config.reviewer_model,
            instructions=instructions,
            user_input=user_input,
        )
        return review.strip()

    def _optional_command(self, command: str | None) -> CommandResult | None:
        if not command:
            return None
        result = Shell.run(command, self.config.repo_root, self.config.timeout_seconds)
        return result

    def _save_round(
        self,
        round_index: int,
        plan: str,
        codex_prompt: str,
        codex_output: str,
        diff_text: str,
        test_result: CommandResult | None,
        build_result: CommandResult | None,
        review: str,
    ) -> RoundArtifacts:
        base = f"rounds/{round_index:02d}"
        planner_prompt_path = str(self.logger.write_text(
            f"{base}/planner_prompt.txt",
            self._planner_prompt_snapshot(round_index),
        ))
        planner_response_path = str(self.logger.write_text(f"{base}/planner_response.txt", plan))
        codex_prompt_path = str(self.logger.write_text(f"{base}/codex_prompt.txt", codex_prompt))
        codex_output_path = str(self.logger.write_text(f"{base}/codex_output.txt", codex_output))
        diff_path = str(self.logger.write_text(f"{base}/git.diff", diff_text))
        test_log_path = None
        build_log_path = None
        if test_result:
            test_log_path = str(self.logger.write_text(f"{base}/test.log", self._format_command_result(test_result)))
        if build_result:
            build_log_path = str(self.logger.write_text(f"{base}/build.log", self._format_command_result(build_result)))
        reviewer_prompt_path = str(self.logger.write_text(
            f"{base}/reviewer_prompt.txt",
            self._reviewer_prompt_snapshot(round_index),
        ))
        reviewer_response_path = str(self.logger.write_text(f"{base}/reviewer_response.txt", review))

        return RoundArtifacts(
            round_index=round_index,
            planner_prompt_path=planner_prompt_path,
            planner_response_path=planner_response_path,
            codex_prompt_path=codex_prompt_path,
            codex_output_path=codex_output_path,
            diff_path=diff_path,
            test_log_path=test_log_path,
            build_log_path=build_log_path,
            reviewer_prompt_path=reviewer_prompt_path,
            reviewer_response_path=reviewer_response_path,
        )

    def _planner_prompt_snapshot(self, round_index: int) -> str:
        return textwrap.dedent(
            f"""
            Planner snapshot
            Round: {round_index}
            Model: {self.config.planner_model}
            Mission:
            {self.config.mission_text}
            """
        ).strip()

    def _reviewer_prompt_snapshot(self, round_index: int) -> str:
        return textwrap.dedent(
            f"""
            Reviewer snapshot
            Round: {round_index}
            Model: {self.config.reviewer_model}
            Mission:
            {self.config.mission_text}
            """
        ).strip()

    @staticmethod
    def _is_approved(review: str) -> bool:
        return "Verdict: APPROVED" in review

    @staticmethod
    def _format_command_result(result: CommandResult | None) -> str:
        if result is None:
            return ""
        return textwrap.dedent(
            f"""
            Command: {result.command}
            Exit code: {result.returncode}

            STDOUT:
            {result.stdout.strip() or '[empty]'}

            STDERR:
            {result.stderr.strip() or '[empty]'}
            """
        ).strip()

    def _final_summary(self, approved: bool, artifacts: list[RoundArtifacts]) -> str:
        status = "APPROVED" if approved else "MAX ROUNDS REACHED"
        rounds_text = "\n".join(
            f"- Round {a.round_index}: {pathlib.Path(a.reviewer_response_path).name}"
            for a in artifacts
        )
        return textwrap.dedent(
            f"""
            # Conversation Engine Summary

            Status: {status}
            Repository: {self.config.repo_name}
            Branch: {self.git.current_branch()}
            Run directory: {self.run_dir}
            Rounds executed: {len(artifacts)}

            Mission:
            {self.config.mission_text}

            Artifacts:
            {rounds_text or '- None'}
            """
        ).strip()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="ChatGPT ↔ Codex conversation engine")
    mission_group = parser.add_mutually_exclusive_group(required=True)
    mission_group.add_argument("--mission-file", help="Path to mission markdown/text file")
    mission_group.add_argument("--mission-text", help="Mission text inline")

    parser.add_argument("--branch", help="Expected git branch name")
    parser.add_argument("--planner-model", default=DEFAULT_PLANNER_MODEL)
    parser.add_argument("--reviewer-model", default=DEFAULT_REVIEWER_MODEL)
    parser.add_argument("--test-cmd", help="Command to run tests")
    parser.add_argument("--build-cmd", help="Command to run build")
    parser.add_argument("--setup-cmd", help="Optional setup command before loop")
    parser.add_argument("--codex-cmd", default="codex")
    parser.add_argument("--max-rounds", type=int, default=DEFAULT_MAX_ROUNDS)
    parser.add_argument("--timeout-seconds", type=int, default=DEFAULT_TIMEOUT_SECONDS)
    parser.add_argument("--auto-commit", action="store_true")
    return parser.parse_args()


def read_mission(args: argparse.Namespace) -> str:
    if args.mission_text:
        return args.mission_text.strip()
    path = pathlib.Path(args.mission_file)
    if not path.exists():
        raise EngineError(f"Mission file not found: {path}")
    return path.read_text(encoding="utf-8").strip()


def discover_repo_root(timeout_seconds: int) -> str:
    result = Shell.run("git rev-parse --show-toplevel", os.getcwd(), timeout_seconds)
    if not result.ok:
        raise EngineError("Unable to locate git repository root.")
    return result.stdout.strip()


def main() -> int:
    try:
        args = parse_args()
        mission_text = read_mission(args)
        repo_root = discover_repo_root(args.timeout_seconds)
        repo_name = pathlib.Path(repo_root).name

        config = EngineConfig(
            mission_text=mission_text,
            branch=args.branch,
            planner_model=args.planner_model,
            reviewer_model=args.reviewer_model,
            test_cmd=args.test_cmd,
            build_cmd=args.build_cmd,
            setup_cmd=args.setup_cmd,
            max_rounds=args.max_rounds,
            codex_cmd=args.codex_cmd,
            auto_commit=args.auto_commit,
            timeout_seconds=args.timeout_seconds,
            repo_name=repo_name,
            repo_root=repo_root,
        )

        engine = ConversationEngine(config)
        engine.run()
        return 0
    except subprocess.TimeoutExpired as exc:
        print(f"Timed out: {exc}", file=sys.stderr)
        return 2
    except EngineError as exc:
        print(f"Engine error: {exc}", file=sys.stderr)
        return 1
    except KeyboardInterrupt:
        print("Interrupted.", file=sys.stderr)
        return 130


if __name__ == "__main__":
    raise SystemExit(main())
