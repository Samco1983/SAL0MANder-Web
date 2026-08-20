import json
import os
import tempfile
import unittest

import sal0_bball_assistant as bball


class ParseRunTest(unittest.TestCase):
    def make_run(self, log_text: str, worker: dict | None = None):
        temp = tempfile.TemporaryDirectory()
        path = os.path.join(temp.name, "work-loop-20260820T051706Z.log")
        with open(path, "w") as handle:
            handle.write(log_text)
        if worker is not None:
            with open(path.removesuffix(".log") + ".json", "w") as handle:
                json.dump(worker, handle)
        return temp, path

    def parse(self, path: str, now: float):
        with open(path) as handle:
            return bball.parse_run(path, handle.read(), now=now)

    def test_worker_error_is_a_bad_turnover(self):
        temp, path = self.make_run(
            "=== SAL0MANder work loop 20260820T051706Z ===\nworker clock: 1800s\n",
            {"is_error": True, "terminal_reason": "aborted_streaming"},
        )
        self.addCleanup(temp.cleanup)

        run = self.parse(path, os.path.getmtime(path))

        self.assertEqual(run.cause, "WORKER_ABORTED")
        self.assertEqual(bball.classify([run]), "BAD TURNOVER")

    def test_three_missed_heartbeats_marks_stalled_run(self):
        temp, path = self.make_run(
            "=== SAL0MANder work loop 20260820T051706Z ===\nworker clock: 1800s\n"
        )
        self.addCleanup(temp.cleanup)

        run = self.parse(path, os.path.getmtime(path) + bball.STALE_RUN_SECONDS)

        self.assertEqual(run.cause, "STALLED_RUN")
        self.assertEqual(bball.classify([run]), "BAD TURNOVER")

    def test_completed_run_is_not_stalled(self):
        temp, path = self.make_run(
            "=== SAL0MANder work loop 20260820T051706Z ===\n"
            "ONE THING THAT CHANGED: COMMITTED abc12345\n"
            "=== end 20260820T051706Z (exit 0) ===\n"
        )
        self.addCleanup(temp.cleanup)

        run = self.parse(path, os.path.getmtime(path) + bball.STALE_RUN_SECONDS * 10)

        self.assertEqual(run.cause, "")
        self.assertEqual(bball.classify([run]), "SCORING")

    def test_latest_turnover_overrides_an_older_score(self):
        scored = bball.Run(
            stamp="20260820T041704Z",
            path="scored.log",
            verdict="COMMITTED abc12345",
        )
        aborted = bball.Run(
            stamp="20260820T051706Z",
            path="aborted.log",
            cause="WORKER_ABORTED",
        )

        self.assertEqual(bball.classify([scored, aborted]), "BAD TURNOVER")


if __name__ == "__main__":
    unittest.main()
