import unittest
from pathlib import Path
from unittest.mock import patch
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
import sal0_collision as collision


def commit(sha: str, agent: str, timestamp: int, files=None):
    return {
        "sha": sha,
        "agent": agent,
        "ts": timestamp,
        "files": files or ["shared.py"],
        "subject": "test",
        "body": "",
    }


class DirtyOverlapTest(unittest.TestCase):
    def setUp(self):
        self.previous_mine = collision.MINE
        collision.MINE = "SAL0-04"

    def tearDown(self):
        collision.MINE = self.previous_mine

    def test_my_newer_refinement_resolves_the_collision(self):
        commits = [
            commit("mine-new", "SAL0-04", 100),
            commit("their-old", "SAL0-01", 99),
        ]

        self.assertEqual(collision.d_dirty_overlap(commits, ["shared.py"], 120), [])

    def test_their_newer_commit_blocks_even_with_equal_timestamps(self):
        commits = [
            commit("their-new", "SAL0-01", 100),
            commit("mine-old", "SAL0-04", 100),
        ]

        findings = collision.d_dirty_overlap(commits, ["shared.py"], 120)

        self.assertEqual(len(findings), 1)
        self.assertEqual(findings[0]["detector"], "DIRTY_OVERLAP")
        self.assertIn("their-new", findings[0]["detail"][0])


class SameSubjectTest(unittest.TestCase):
    def test_flags_different_agents_testing_same_subject_from_different_files(self):
        commits = [
            commit("mine", "SAL0-01", 101, ["src/components/share/SharePanel.test.tsx"]),
            commit("theirs", "SAL0-04", 100, ["src/components/share/qrFreshness.test.tsx"]),
        ]

        bodies = {
            "mine:src/components/share/SharePanel.test.tsx": "import { SharePanel } from './SharePanel'",
            "theirs:src/components/share/qrFreshness.test.tsx": "import { SharePanel } from './SharePanel'",
        }

        def fake_sh(cmd, timeout=15):
            self.assertEqual(cmd[:2], ["git", "show"])
            return 0, bodies[cmd[2]]

        with patch.object(collision, "sh", side_effect=fake_sh):
            findings = collision.d_same_subject(commits, [], 120)

        self.assertEqual(len(findings), 1)
        self.assertEqual(findings[0]["detector"], "SAME_SUBJECT")
        self.assertIn("SharePanel", findings[0]["detail"][0])

    def test_ignores_same_agent_iteration_on_same_subject(self):
        commits = [
            commit("new", "SAL0-01", 101, ["src/components/share/SharePanel.test.tsx"]),
            commit("old", "SAL0-01", 100, ["src/components/share/qrFreshness.test.tsx"]),
        ]

        with patch.object(collision, "sh", return_value=(0, "import { SharePanel } from './SharePanel'")):
            self.assertEqual(collision.d_same_subject(commits, [], 120), [])

    def test_ignores_alias_imports_as_harness_noise(self):
        commits = [
            commit("mine", "SAL0-01", 101, ["src/app/App.test.tsx"]),
            commit("theirs", "SAL0-04", 100, ["src/routes/guest-play/boot.test.tsx"]),
        ]

        with patch.object(collision, "sh", return_value=(0, "import { routes } from '@app/router'")):
            self.assertEqual(collision.d_same_subject(commits, [], 120), [])

    def test_ignores_mocked_dependencies(self):
        commits = [
            commit("mine", "SAL0-01", 101, ["src/routes/hostRecovery.test.tsx"]),
            commit("theirs", "SAL0-04", 100, ["src/config/buildConfig.test.ts"]),
        ]
        body = "import { buildConfig } from './buildConfig'\nvi.mock('./buildConfig')"

        with patch.object(collision, "sh", return_value=(0, body)):
            self.assertEqual(collision.d_same_subject(commits, [], 120), [])


if __name__ == "__main__":
    unittest.main()
