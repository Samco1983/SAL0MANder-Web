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


if __name__ == "__main__":
    unittest.main()
