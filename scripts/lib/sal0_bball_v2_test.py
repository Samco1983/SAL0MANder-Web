import unittest
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from sal0_bball_v2 import decide


def packet(**overrides):
    base = {
        "repo": {
            "branch": "council/2026-08-18",
            "head": "abc1234",
            "dirty": False,
            "dirtyFiles": [],
        },
        "points": {
            "verified": 8,
            "claimed": 8,
            "unverified": 0,
        },
        "collisions": {
            "findings": [],
        },
        "next": {
            "action": "TAKE_SHOT",
            "shot": {
                "number": 6,
                "title": "[PRODUCT] Build website home navigation",
                "category": "PRODUCT",
                "size": "M",
            },
        },
    }
    for key, value in overrides.items():
        if isinstance(value, dict) and isinstance(base.get(key), dict):
            base[key] = {**base[key], **value}
        else:
            base[key] = value
    return base


class BballV2DecisionTest(unittest.TestCase):
    def test_dirty_court_must_be_cleared_before_new_shot(self):
        decision = decide(packet(repo={"dirty": True, "dirtyFiles": ["M package.json"]}))

        self.assertEqual(decision.court, "REBOUNDABLE_MISS")
        self.assertEqual(decision.action, "CLEAR_COURT")
        self.assertFalse(decision.ownerNeeded)
        self.assertLessEqual(decision.timeboxMinutes, 10)

    def test_unverified_closes_are_repaired_before_more_scoring(self):
        decision = decide(packet(points={"verified": 8, "claimed": 10, "unverified": 2}))

        self.assertEqual(decision.court, "REBOUNDABLE_MISS")
        self.assertEqual(decision.action, "VERIFY_SCOREBOARD")
        self.assertIn("fake score", decision.reason)

    def test_queue_failure_is_a_bounded_agent_action(self):
        decision = decide(packet(next={"action": "FIX_QUEUE_ACCESS", "shot": None}))

        self.assertEqual(decision.court, "BLOCKED")
        self.assertEqual(decision.action, "FIX_QUEUE_ACCESS")
        self.assertTrue(decision.agentCanAct)
        self.assertFalse(decision.ownerNeeded)

    def test_three_bad_turnovers_trigger_review_not_more_shots(self):
        findings = [
            {"severity": "high", "detector": "DUPLICATE_SHOT"},
            {"severity": "critical", "detector": "FALSE_SCORE"},
            {"severity": "high", "detector": "DIRTY_OVERLAP"},
        ]
        decision = decide(packet(collisions={"findings": findings}))

        self.assertEqual(decision.court, "BAD_TURNOVER")
        self.assertEqual(decision.action, "TURNOVER_REVIEW")
        self.assertLessEqual(decision.timeboxMinutes, 15)

    def test_clean_product_shot_gets_the_ball(self):
        decision = decide(packet())

        self.assertEqual(decision.court, "SCORING")
        self.assertEqual(decision.action, "TAKE_SHOT")
        self.assertEqual(decision.timeboxMinutes, 30)

    def test_big_docs_backlog_deflects_to_fresh_product_shot(self):
        decision = decide(packet(next={
            "action": "TAKE_SHOT",
            "shot": {
                "number": 13,
                "title": "[DOCS] Overnight basketball audit",
                "category": "DOCS",
                "size": "BIG",
            },
        }))

        self.assertEqual(decision.court, "REBOUNDABLE_MISS")
        self.assertEqual(decision.action, "CREATE_FRESH_PRODUCT_SHOT")
        self.assertLessEqual(decision.timeboxMinutes, 10)


if __name__ == "__main__":
    unittest.main()
