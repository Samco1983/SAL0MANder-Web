import unittest

import sal0_collision as collision


def commit(sha: str, agent: str, timestamp: int):
    return {
        "sha": sha,
        "agent": agent,
        "ts": timestamp,
        "files": ["shared.py"],
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


if __name__ == "__main__":
    unittest.main()
