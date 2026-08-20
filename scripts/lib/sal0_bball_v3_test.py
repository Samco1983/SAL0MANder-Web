import unittest
import sys
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parent))
import sal0_bball_v3
from sal0_bball_v3 import ProductCandidate, issue_body, rank_candidates


def candidate(title, files, value=70, risk=20):
    return ProductCandidate(
        title=title,
        files=tuple(files),
        success_check="npm run verify exits 0",
        body="Do a small user-visible thing.",
        value=value,
        risk=risk,
        reason="test candidate",
    )


class BballV3Test(unittest.TestCase):
    def test_prefers_high_value_low_collision_product_shot(self):
        ranked = rank_candidates(
            [
                candidate("[WEB][PRODUCT] Hot guest play", ["src/routes/guest-play/GuestPlayPage.tsx"], value=95, risk=20),
                candidate("[WEB][PRODUCT] Cooler home shot", ["src/routes/home/HomePage.tsx"], value=80, risk=20),
            ],
            touched={"src/routes/guest-play/GuestPlayPage.tsx"},
            existing_titles=set(),
        )

        self.assertEqual(ranked[0].title, "[WEB][PRODUCT] Cooler home shot")
        self.assertGreater(ranked[0].score, ranked[1].score)

    def test_drops_duplicate_open_issue_titles(self):
        ranked = rank_candidates(
            [
                candidate("[WEB][PRODUCT] Already filed", ["src/routes/home/HomePage.tsx"]),
                candidate("[WEB][PRODUCT] Fresh shot", ["src/routes/profile/ProfilePage.tsx"]),
            ],
            touched=set(),
            existing_titles={"[WEB][PRODUCT] Already filed"},
        )

        self.assertEqual([shot.title for shot in ranked], ["[WEB][PRODUCT] Fresh shot"])

    def test_issue_body_names_boundaries_and_success_check(self):
        shot = rank_candidates(
            [candidate("[WEB][PRODUCT] Fresh shot", ["src/routes/home/HomePage.tsx"])],
            touched=set(),
            existing_titles=set(),
        )[0]

        body = issue_body(shot)

        self.assertIn("WEB / PRODUCT", body)
        self.assertIn("npm run verify exits 0", body)
        self.assertIn("No Unity gameplay changes", body)
        self.assertIn("src/routes/home/HomePage.tsx", body)

    def test_v3_drops_completed_home_teacher_preview(self):
        shots = sal0_bball_v3.product_candidates()
        home = next(shot for shot in shots if "teacher preview path from Home" in shot.title)

        with patch.object(sal0_bball_v3, "file_contains", return_value=True):
            self.assertTrue(sal0_bball_v3.candidate_complete(home))


if __name__ == "__main__":
    unittest.main()
