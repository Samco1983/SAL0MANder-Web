import tempfile
import unittest
from pathlib import Path

from sal0_worker_deploy import render_config, validated_values


VALID_ENV = {
    "CLOUDFLARE_ACCOUNT_ID": "a" * 32,
    "TEAM_DOMAIN": "https://samco.cloudflareaccess.com",
    "POLICY_AUD": "audience_0123456789abcdef",
    "OWNER_EMAILS": "samuel@example.com, second@example.org",
}


class WorkerDeployConfigTests(unittest.TestCase):
    def test_normalizes_valid_values(self):
        values = validated_values({**VALID_ENV, "TEAM_DOMAIN": VALID_ENV["TEAM_DOMAIN"] + "/"})

        self.assertEqual(values["TEAM_DOMAIN"], VALID_ENV["TEAM_DOMAIN"])
        self.assertEqual(values["OWNER_EMAILS"], "samuel@example.com,second@example.org")

    def test_rejects_malformed_account_id(self):
        with self.assertRaisesRegex(ValueError, "32-character hexadecimal"):
            validated_values({**VALID_ENV, "CLOUDFLARE_ACCOUNT_ID": "account-123"})

    def test_rejects_non_access_domain(self):
        with self.assertRaisesRegex(ValueError, "cloudflareaccess"):
            validated_values({**VALID_ENV, "TEAM_DOMAIN": "https://example.com"})

    def test_rejects_access_domain_with_path(self):
        with self.assertRaisesRegex(ValueError, "cloudflareaccess"):
            validated_values({**VALID_ENV, "TEAM_DOMAIN": "https://samco.cloudflareaccess.com/path"})

    def test_rejects_access_domain_with_embedded_credentials(self):
        with self.assertRaisesRegex(ValueError, "cloudflareaccess"):
            validated_values(
                {**VALID_ENV, "TEAM_DOMAIN": "https://user@samco.cloudflareaccess.com"}
            )

    def test_rejects_malformed_audience(self):
        with self.assertRaisesRegex(ValueError, "base64url-style"):
            validated_values({**VALID_ENV, "POLICY_AUD": "short audience"})

    def test_rejects_malformed_owner(self):
        with self.assertRaisesRegex(ValueError, "valid email"):
            validated_values({**VALID_ENV, "OWNER_EMAILS": "owner.example.com"})

    def test_renders_each_value_once_and_preserves_workers_dev(self):
        source_text = """\
name = "worker"
workers_dev = true
[vars]
TEAM_DOMAIN = "https://replace-me.cloudflareaccess.com"
POLICY_AUD = "replace-with-access-application-audience"
OWNER_EMAILS = "owner@example.com"
"""
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "wrangler.example.toml"
            output = Path(directory) / "wrangler.toml"
            source.write_text(source_text)

            render_config(source, output, VALID_ENV)

            rendered = output.read_text()
            self.assertIn('TEAM_DOMAIN = "https://samco.cloudflareaccess.com"', rendered)
            self.assertIn('POLICY_AUD = "audience_0123456789abcdef"', rendered)
            self.assertIn('OWNER_EMAILS = "samuel@example.com,second@example.org"', rendered)
            self.assertNotIn("replace-", rendered)


if __name__ == "__main__":
    unittest.main()
