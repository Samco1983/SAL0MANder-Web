import unittest
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
from sal0_verify_points import commit_named_in


class VerifyPointsCommitParserTest(unittest.TestCase):
    def test_accepts_closed_by_commit(self):
        self.assertEqual(commit_named_in("Closed by `9f568b6`."), "9f568b6")

    def test_accepts_completed_in_commit(self):
        self.assertEqual(commit_named_in("Completed in 9f568b6."), "9f568b6")

    def test_accepts_fixed_in_full_commit(self):
        sha = "9f568b6eda71d65fd50ffecb72429d0f0fe3e905"
        self.assertEqual(commit_named_in(f"Fixed in {sha}."), sha)

    def test_does_not_treat_generic_hex_as_a_close_commit(self):
        self.assertIsNone(commit_named_in("Run id abc1234 had logs."))


if __name__ == "__main__":
    unittest.main()
