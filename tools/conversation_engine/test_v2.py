from __future__ import annotations

import argparse
import json
import os
import pathlib
import shutil
import subprocess
import tempfile
import unittest


TEST_DIR = pathlib.Path(__file__).resolve().parent
if str(TEST_DIR) not in os.sys.path:
    os.sys.path.insert(0, str(TEST_DIR))

import ce
import v2


class ConversationEngineWrapperTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.mkdtemp(prefix="ce-tests-")
        self.old_cwd = os.getcwd()
        os.chdir(self.temp_dir)
        subprocess.run(["git", "init"], check=True, capture_output=True, text=True)
        subprocess.run(["git", "checkout", "-b", "feat/test-mission"], check=True, capture_output=True, text=True)
        subprocess.run(["git", "config", "user.email", "ce@example.com"], check=True, capture_output=True, text=True)
        subprocess.run(["git", "config", "user.name", "Conversation Engine"], check=True, capture_output=True, text=True)
        pathlib.Path("README.md").write_text("test repo\n", encoding="utf-8")
        subprocess.run(["git", "add", "README.md"], check=True, capture_output=True, text=True)
        subprocess.run(["git", "commit", "-m", "init"], check=True, capture_output=True, text=True)

    def tearDown(self) -> None:
        os.chdir(self.old_cwd)
        shutil.rmtree(self.temp_dir)

    def write_file(self, path: str, content: str) -> pathlib.Path:
        file_path = pathlib.Path(path)
        file_path.parent.mkdir(parents=True, exist_ok=True)
        file_path.write_text(content, encoding="utf-8")
        return file_path

    def latest_run_id(self) -> str:
        store = v2.RunStore(self.temp_dir)
        run_id = store.latest_run_id()
        self.assertIsNotNone(run_id)
        return run_id or ""

    def load_state(self, run_id: str) -> v2.RunState:
        store = v2.RunStore(self.temp_dir)
        return store.load_state(run_id)

    def test_mission_template_is_parser_safe(self) -> None:
        content = ce.mission_template(
            "Conversation Engine Dashboard + Wrapper Commands v1",
            "feat/conversation-engine-dashboard-wrapper-commands-v1",
            "Improve workflow ergonomics without changing approval gates.",
        )
        self.assertEqual(v2.extract_mission_title(content, "ignored.md"), "Conversation Engine Dashboard + Wrapper Commands v1")
        self.assertEqual(v2.extract_branch(content), "feat/conversation-engine-dashboard-wrapper-commands-v1")

    def test_status_renders_run_summary_and_next_step(self) -> None:
        mission_file = self.write_file(
            "docs/missions/mission-test.md",
            ce.mission_template("Test Mission", "feat/test-mission", "Test objective"),
        )
        v2.cmd_start(argparse.Namespace(mission_file=str(mission_file)))
        run_id = self.latest_run_id()
        store = v2.RunStore(self.temp_dir)
        state = store.load_state(run_id)
        repo = v2.Repo()

        rendered = ce.render_status(repo, store, state)
        self.assertIn("Conversation Engine Status", rendered)
        self.assertIn("Run ID: ", rendered)
        self.assertIn("Current stage: started", rendered)
        self.assertIn("Next step:", rendered)
        self.assertIn("make-codex-audit-prompt", rendered)

    def test_next_step_is_advisory_for_commit_ready_stage(self) -> None:
        state = v2.RunState(
            state_version=2,
            run_id="run-1",
            created_at="2026-01-01T00:00:00+00:00",
            updated_at="2026-01-01T00:00:00+00:00",
            mission_file="docs/missions/mission-test.md",
            mission_title="Test Mission",
            expected_branch="feat/test-mission",
            current_stage="approved_for_commit",
            repo_root=self.temp_dir,
            mission_branch_verified=True,
            decision="approve_to_commit",
        )
        hint = v2.next_step_hint(state)
        self.assertIn("make-codex-commit-prompt", hint)
        self.assertNotIn("Saved", hint)

    def test_wrapper_flow_preserves_stage_semantics_and_latest_audit(self) -> None:
        mission_file = self.write_file(
            "docs/missions/mission-test.md",
            ce.mission_template("Test Mission", "feat/test-mission", "Test objective"),
        )

        ce.cmd_ce_start(argparse.Namespace(mission_file=str(mission_file)))
        run_id = self.latest_run_id()
        state = self.load_state(run_id)
        self.assertEqual(state.current_stage, "codex_audit_prompt_ready")

        audit_response = self.write_file(
            "responses/codex_audit.txt",
            "\n".join(
                [
                    "1. current system structure relevant to this mission",
                    "",
                    "4. exact files to modify",
                    "- `tools/conversation_engine/v2.py`",
                    "",
                    "5. risks",
                    "None.",
                    "",
                    "6. implementation plan",
                    "- Add wrapper commands.",
                ]
            ),
        )
        ce.cmd_ce_apply_codex_audit(argparse.Namespace(run_id=run_id, response_file=str(audit_response)))
        state = self.load_state(run_id)
        self.assertEqual(state.current_stage, "chatgpt_review_prompt_ready")
        latest_audit = pathlib.Path(".conversation_engine/latest_audit.txt")
        self.assertTrue(latest_audit.exists())
        self.assertIn(run_id, latest_audit.read_text(encoding="utf-8"))

        review_response = self.write_file(
            "responses/chatgpt_review.txt",
            "\n".join(
                [
                    "1. What Codex got right",
                    "- preserved the state machine",
                    "",
                    "2. Risks or concerns",
                    "- none",
                    "",
                    "3. Review decision",
                    "APPROVED TO PROCEED WITH IMPLEMENTATION",
                    "",
                    "4. Exact instruction block to send back to Codex",
                    "- proceed",
                ]
            ),
        )
        ce.cmd_ce_apply_chatgpt_review(argparse.Namespace(run_id=run_id, review_file=str(review_response)))
        state = self.load_state(run_id)
        self.assertEqual(state.current_stage, "codex_implementation_prompt_ready")
        self.assertEqual(state.decision, "approve_to_implement")

        implementation_response = self.write_file(
            "responses/codex_implementation.txt",
            "\n".join(
                [
                    "**Files Changed**",
                    "- `tools/conversation_engine/v2.py`",
                    "- `tools/conversation_engine/ce.py`",
                    "",
                    "**Test / Build Results**",
                    "- python3 -m unittest discover -s tools/conversation_engine -p 'test_*.py'",
                    "",
                    "**Known Risks**",
                    "- minimal",
                ]
            ),
        )
        ce.cmd_ce_apply_codex_implementation(
            argparse.Namespace(run_id=run_id, response_file=str(implementation_response))
        )
        state = self.load_state(run_id)
        self.assertEqual(state.current_stage, "chatgpt_implementation_review_prompt_ready")
        self.assertTrue((pathlib.Path(".conversation_engine/latest_audit.txt")).exists())

        ce.cmd_ce_finalize(argparse.Namespace(run_id=run_id))
        state = self.load_state(run_id)
        self.assertEqual(state.current_stage, "finalized")
        self.assertTrue((pathlib.Path(".conversation_engine/runs") / run_id / "final_summary.md").exists())


if __name__ == "__main__":
    unittest.main()
