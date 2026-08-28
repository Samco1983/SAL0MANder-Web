import pathlib
import re
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[2]
CLAUDE = (ROOT / ".github/workflows/overnight-claude-web-worker.yml").read_text()
GEMINI = (ROOT / ".github/workflows/overnight-gemini-web-review.yml").read_text()


def job(workflow, name):
    lines = workflow.splitlines()
    start = lines.index(f"  {name}:")
    end = len(lines)
    for index in range(start + 1, len(lines)):
        line = lines[index]
        if line.startswith("  ") and not line.startswith("    ") and line.endswith(":"):
            end = index
            break
    return "\n".join(lines[start:end])


class AgentWorkflowSafetyTest(unittest.TestCase):
    def test_claude_model_job_has_read_only_repository_permissions(self):
        model_job = job(CLAUDE, "claude")
        permissions = model_job.split("    steps:", 1)[0]
        self.assertIn("contents: read", permissions)
        self.assertIn("id-token: write", permissions)
        self.assertNotIn("contents: write", permissions)
        self.assertNotIn("issues: write", permissions)
        self.assertNotIn("pull-requests: write", permissions)
        self.assertIn("persist-credentials: false", model_job)

    def test_only_publisher_has_repository_write_permissions(self):
        publisher_permissions = job(CLAUDE, "publish-claude-draft").split("    steps:", 1)[0]
        self.assertIn("contents: write", publisher_permissions)
        self.assertIn("issues: write", publisher_permissions)
        self.assertIn("pull-requests: write", publisher_permissions)
        self.assertNotIn("id-token: write", publisher_permissions)

    def test_guarded_patch_crosses_the_job_boundary(self):
        model_job = job(CLAUDE, "claude")
        publisher_job = job(CLAUDE, "publish-claude-draft")
        self.assertIn("git diff --cached --binary", model_job)
        self.assertIn("actions/upload-artifact@", model_job)
        self.assertIn("actions/download-artifact@", publisher_job)
        self.assertIn("git apply --index", publisher_job)

    def test_credential_bearing_actions_are_immutable(self):
        action_refs = re.findall(r"uses: ([^@\s]+)@([^ #]+)", CLAUDE + GEMINI)
        self.assertTrue(action_refs)
        self.assertTrue(all(re.fullmatch(r"[0-9a-f]{40}", ref) for _, ref in action_refs))
        self.assertIn(("anthropics/claude-code-action", "a60f3e1db3edbceed2b1e6c6a9d34c36b8a15eba"), action_refs)
        self.assertIn(("google-github-actions/run-gemini-cli", "f77273f4c914e4bf38440cf36a0369cb64a37489"), action_refs)

    def test_gemini_cli_is_exactly_versioned(self):
        self.assertIn("gemini_cli_version: 0.57.0", GEMINI)
        self.assertNotIn("gemini_cli_version: latest", GEMINI)

    def test_claude_failure_updates_one_durable_checkpoint(self):
        reporter = job(CLAUDE, "report-claude-result")
        self.assertIn("needs.claude.result == 'failure'", reporter)
        self.assertIn("needs.publish-claude-draft.result == 'failure'", reporter)
        self.assertIn("sal0mander-claude-worker-blocker", reporter)
        self.assertEqual(reporter.count("--method PATCH"), 1)
        self.assertIn("exit 1", job(CLAUDE, "claude"))

    def test_gemini_failure_updates_one_durable_checkpoint(self):
        reporter = job(GEMINI, "report-review-blocker")
        self.assertIn("needs.review.result == 'failure'", reporter)
        self.assertIn("sal0mander-gemini-web-overnight-blocker", reporter)
        self.assertEqual(reporter.count("--method PATCH"), 1)
        self.assertIn("exit 1", job(GEMINI, "review"))
        self.assertNotIn("pull-requests: write", GEMINI)


if __name__ == "__main__":
    unittest.main()
