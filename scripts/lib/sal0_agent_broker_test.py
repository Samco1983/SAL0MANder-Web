import argparse
import importlib.util
import sqlite3
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


SCRIPT = Path(__file__).resolve().parents[1] / "sal0-agent-broker.py"
SPEC = importlib.util.spec_from_file_location("sal0_agent_broker", SCRIPT)
broker = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
sys.modules[SPEC.name] = broker
SPEC.loader.exec_module(broker)


class AgentBrokerTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.db_path = Path(self.tmp.name) / "tasks.sqlite3"
        self.db = broker.connect(self.db_path)
        self.addCleanup(self.db.close)

    def args(self, **overrides):
        values = dict(
            id=None,
            role="codex-cli",
            lane="Coordination",
            workspace=str(broker.ROOT),
            prompt="Review the bounded coordination change.",
            prompt_file=None,
            success_check="python tests exit with code zero",
            timeout=120,
        )
        values.update(overrides)
        return argparse.Namespace(**values)

    def test_claim_is_atomic_and_only_happens_once(self):
        task = broker.enqueue(self.db, self.args())
        first = broker.claim_next(self.db, None)
        second = broker.claim_next(self.db, None)
        self.assertEqual(task["id"], first["id"])
        self.assertIsNone(second)
        self.assertEqual("RUNNING", first["status"])

    def test_agent_exit_zero_waits_for_independent_verification(self):
        task = broker.enqueue(self.db, self.args())
        claimed = broker.claim_next(self.db, None)
        result = broker.AgentResult(["fake"], 0, "{}", "", "session-1")
        finished = broker.finish_run(
            self.db, claimed, result, Path(self.tmp.name) / "runs", False
        )
        self.assertEqual("AWAITING_VERIFICATION", finished["status"])
        self.assertNotEqual("DONE", finished["status"])

    def test_verifier_can_score_after_evidence_exists(self):
        task = broker.enqueue(self.db, self.args())
        claimed = broker.claim_next(self.db, None)
        broker.finish_run(
            self.db,
            claimed,
            broker.AgentResult(["fake"], 0, "", "", None),
            Path(self.tmp.name) / "runs",
            False,
        )
        evidence = Path(self.tmp.name) / "verify.txt"
        evidence.write_text("exit 0\n", encoding="utf-8")
        scored = broker.verify(
            self.db,
            argparse.Namespace(id=task["id"], exit_code=0, evidence=str(evidence)),
        )
        self.assertEqual("DONE", scored["status"])
        self.assertEqual(str(evidence.resolve()), scored["evidence"])

    def test_claude_cannot_take_unity_lane(self):
        with self.assertRaisesRegex(ValueError, "not allowed"):
            broker.enqueue(self.db, self.args(role="claude", lane="Unity/Game"))

    def test_dry_run_returns_task_to_queue(self):
        broker.enqueue(self.db, self.args())
        claimed = broker.claim_next(self.db, None)
        output = broker.finish_run(
            self.db,
            claimed,
            broker.AgentResult(["codex", "exec"], 0, "", "", None),
            Path(self.tmp.name) / "runs",
            True,
        )
        row = self.db.execute("SELECT status, attempts FROM tasks").fetchone()
        self.assertEqual("DRY_RUN", output["status"])
        self.assertEqual("QUEUED", row["status"])
        self.assertEqual(0, row["attempts"])

    @patch.object(broker.subprocess, "run")
    def test_codex_adapter_uses_direct_argv_and_bounded_sandbox(self, run):
        run.return_value.returncode = 0
        run.return_value.stdout = '{"thread_id":"abc"}\n'
        run.return_value.stderr = ""
        task = broker.enqueue(self.db, self.args())
        result = broker.invoke(task)
        command = run.call_args.args[0]
        self.assertEqual("exec", command[1])
        self.assertIn("workspace-write", command)
        self.assertNotIn("danger-full-access", command)
        self.assertEqual("abc", result.session_id)


if __name__ == "__main__":
    unittest.main()
