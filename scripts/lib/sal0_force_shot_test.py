import unittest
from unittest.mock import patch

import sal0_force_shot


MIX = {
    "product_changes": 1,
    "plumbing_changes": 9,
    "product_share": 0.1,
    "below_floor": True,
}


class ForceShotTest(unittest.TestCase):
    def test_queue_unreadable_falls_back_to_local_tracked_finding(self):
        local = {
            "number": None,
            "title": "[LOCAL] W-17 - known finding",
            "category": "PRODUCT",
            "success_check": "npm run verify exits 0",
            "size": "local tracked finding",
        }

        with (
            patch.object(sal0_force_shot, "measure_mix", return_value=MIX),
            patch.object(
                sal0_force_shot,
                "read_board",
                return_value={"board": [], "queue_error": "api.github.com unavailable"},
            ),
            patch.object(sal0_force_shot, "local_tracked_finding", return_value=local),
        ):
            result = sal0_force_shot.choose()

        self.assertEqual(result["action"], "TAKE_SHOT")
        self.assertEqual(result["shot"], local)
        self.assertIn("does not idle", result["reason"])
        self.assertIn("Do not create duplicate issues", result["reason"])

    def test_empty_board_re_reads_after_promoting_backlog(self):
        promoted_product = {
            "number": 42,
            "title": "[WEB] W-17 - promoted product finding",
            "category": "PRODUCT",
            "success_check": "a student or teacher can see the difference",
            "size": "fits a possession",
        }

        with (
            patch.object(sal0_force_shot, "measure_mix", return_value=MIX),
            patch.object(
                sal0_force_shot,
                "read_board",
                side_effect=[
                    {"board": [], "ready_count": 0, "queue_error": ""},
                    {"board": [promoted_product], "ready_count": 1, "queue_error": ""},
                ],
            ),
            patch.object(sal0_force_shot, "_promote_tracked_findings", return_value=1),
        ):
            result = sal0_force_shot.choose()

        self.assertEqual(result["action"], "TAKE_SHOT")
        self.assertEqual(result["shot"], promoted_product)
        self.assertIn("PROMOTED BACKLOG", result["reason"])

    def test_local_fallback_skips_cross_lane_findings(self):
        with patch("sal0_backlog_sync.parse_items") as parse_items:
            parse_items.return_value = [
                {
                    "key": "W-18",
                    "title": "bridge observability audit still needs one real Unity receiver pass",
                    "body": "Still needs Codex / Unity confirmation.",
                },
                {
                    "key": "W-17",
                    "title": "reveal is safe because of what calls it",
                    "body": "Touches src/components/layout/CompanionLayout.module.css.",
                },
            ]

            shot = sal0_force_shot.local_tracked_finding()

        self.assertIsNotNone(shot)
        self.assertEqual(shot["key"], "W-17")

    def test_ready_board_cross_lane_shot_does_not_idle_web_lane(self):
        blocked = {
            "number": 41,
            "title": "[WEB] W-18 - bridge observability audit still needs one real Unity receiver pass",
            "category": "PRODUCT",
            "success_check": "requires Codex / Unity confirmation",
            "size": "fits a possession",
        }
        generated = {
            "number": None,
            "title": "[LOCAL][PRODUCT] next visible web shot",
            "category": "PRODUCT",
            "success_check": "npm run verify exits 0",
            "size": "local generated product shot",
        }

        with (
            patch.object(sal0_force_shot, "measure_mix", return_value=MIX),
            patch.object(sal0_force_shot, "read_board", return_value={"board": [blocked]}),
            patch.object(sal0_force_shot, "local_generated_product_shot", return_value=generated),
        ):
            result = sal0_force_shot.choose()

        self.assertEqual(result["action"], "TAKE_SHOT")
        self.assertEqual(result["shot"], generated)
        self.assertIn("require another lane", result["reason"])

    def test_queue_unreadable_generates_concrete_product_shot_when_backlog_is_blocked(self):
        with (
            patch.object(sal0_force_shot, "measure_mix", return_value=MIX),
            patch.object(
                sal0_force_shot,
                "read_board",
                return_value={"board": [], "queue_error": "api.github.com unavailable"},
            ),
            patch.object(sal0_force_shot, "local_tracked_finding", return_value=None),
        ):
            result = sal0_force_shot.choose()

        self.assertEqual(result["action"], "TAKE_SHOT")
        self.assertEqual(result["shot"]["category"], "PRODUCT")
        self.assertTrue(result["shot"]["files"])
        self.assertIn("instead of waiting for owner input", result["reason"])

    def test_generated_product_shots_skip_completed_work(self):
        with patch.object(sal0_force_shot, "file_has") as file_has:
            file_has.side_effect = lambda path, _pattern: path == "src/routes/home/HomePage.tsx"

            shot = sal0_force_shot.local_generated_product_shot()

        self.assertEqual(shot["title"], "[LOCAL][PRODUCT] Give the Unity host a non-gameplay return path")
        self.assertIn("src/routes/unity/UnityHostPage.tsx", shot["files"])

    def test_generated_product_shots_keep_moving_after_profile_completes(self):
        completed = {
            "src/routes/home/HomePage.tsx",
            "src/routes/unity/UnityHostPage.tsx",
            "src/routes/profile/ProfilePage.tsx",
        }
        with patch.object(sal0_force_shot, "file_has") as file_has:
            file_has.side_effect = lambda path, _pattern: path in completed

            shot = sal0_force_shot.local_generated_product_shot()

        self.assertEqual(shot["title"], "[LOCAL][PRODUCT] Add a class-code recovery hint to Guest Play")
        self.assertIn("src/routes/guest-play/GuestPlayPage.tsx", shot["files"])


if __name__ == "__main__":
    unittest.main()
