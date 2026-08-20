import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import sal0_asset_scout as scout


class AssetScoutTest(unittest.TestCase):
    def test_all_seed_packs_have_six_assets(self):
        self.assertGreaterEqual(len(scout.PACKS), 6)
        for name in scout.PACKS:
            manifest = scout.manifest_for(name)
            self.assertEqual(manifest["pack"], name)
            self.assertGreaterEqual(len(manifest["assets"]), 6)

    def test_manifest_prompts_are_rights_clean_and_need_unity_approval(self):
        manifest = scout.manifest_for("pet-classroom")

        for asset in manifest["assets"]:
            prompt = asset["prompt"].lower()
            self.assertIn("no copyrighted characters", prompt)
            self.assertIn("no logos", prompt)
            self.assertIn("no realistic child faces", prompt)
            self.assertIn("no photoreal school children", prompt)
            self.assertEqual(asset["rights"], "generated-clean")
            self.assertIs(asset["needsUnityApproval"], True)

    def test_validate_manifest_rejects_missing_fields(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / "bad.manifest.json"
            path.write_text(json.dumps({"pack": "bad", "assets": [{}]}))

            problems = scout.validate_manifest(path)

        self.assertTrue(any("missing top-level lane" in p for p in problems))
        self.assertTrue(any("expected at least 6 assets" in p for p in problems))
        self.assertTrue(any("asset 0 missing prompt" in p for p in problems))

    def test_gemini_packet_is_text_only_and_boundary_explicit(self):
        packet = scout.gemini_packet(["space-lab"])

        self.assertIn("Do not edit Unity gameplay", packet)
        self.assertIn("Do not generate or commit image files", packet)
        self.assertIn("SCOUT_UNREACHABLE", packet)
        self.assertIn("space-lab", packet)

    def test_gemini_probe_classifies_exact_alive(self):
        wake = scout.classify_gemini_output(0, "ALIVE\n", "", False)

        self.assertEqual(wake["status"], "AWAKE")

    def test_gemini_probe_classifies_timeout_as_stalled(self):
        wake = scout.classify_gemini_output(None, "", "", True)

        self.assertEqual(wake["status"], "STARTED_BUT_STALLED")
        self.assertIn("did not return", wake["reason"])

    def test_gemini_probe_timeout_bytes_are_json_safe(self):
        wake = scout.classify_gemini_output(None, b"", b"partial warning", True)

        json.dumps(wake)
        self.assertEqual(wake["stderrPreview"], "partial warning")

    def test_gemini_probe_classifies_auth_and_quota(self):
        auth = scout.classify_gemini_output(1, "", "API key invalid", False)
        quota = scout.classify_gemini_output(1, "", "429 quota exhausted", False)

        self.assertEqual(auth["status"], "AUTH_BLOCKED")
        self.assertEqual(quota["status"], "QUOTA_BLOCKED")

    def test_nudge_packet_has_fallback_and_production_mix(self):
        packet = scout.nudge_packet(["pet-classroom"], wake={"status": "STARTED_BUT_STALLED"})

        self.assertEqual(packet["target"], "SAL0-06/SAL0-07 Gemini asset scout")
        self.assertIn("SCOUT_UNREACHABLE", packet["ifNotAwake"])
        self.assertEqual(packet["packs"], ["pet-classroom"])
        self.assertTrue(packet["productionMix"])


if __name__ == "__main__":
    unittest.main()
