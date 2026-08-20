import tempfile
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parent))
import sal0_inbox_gate


class InboxGateTest(unittest.TestCase):
    def write_inbox(self, text: str) -> str:
        path = Path(tempfile.mkdtemp()) / "INBOX.md"
        path.write_text(text, encoding="utf-8")
        return str(path)

    def test_unanswered_direct_question_blocks_addressee(self):
        inbox = self.write_inbox(
            "### SAL0-04 -> SAL0-01: What do you need?\n\n"
            "MESSAGE: Pick one of three options.\n"
        )

        with patch.object(sal0_inbox_gate, "INBOX", inbox):
            waiting = sal0_inbox_gate.unanswered("SAL0-01")

        self.assertEqual(len(waiting), 1)
        self.assertEqual(waiting[0]["from"], "SAL0-04")
        self.assertEqual(waiting[0]["subject"], "What do you need?")

    def test_ack_clears_direct_question(self):
        inbox = self.write_inbox(
            "### SAL0-04 -> SAL0-01: What do you need?\n\n"
            "ACK by SAL0-01.\n"
        )

        with patch.object(sal0_inbox_gate, "INBOX", inbox):
            waiting = sal0_inbox_gate.unanswered("SAL0-01")

        self.assertEqual(waiting, [])

    def test_unrelated_later_message_does_not_clear_question(self):
        inbox = self.write_inbox(
            "### SAL0-04 -> SAL0-01: What do you need?\n\n"
            "MESSAGE: Choose a lane.\n\n"
            "### SAL0-01 -> SAL0-04: Different subject\n\n"
            "MESSAGE: I shipped another thing.\n"
        )

        with patch.object(sal0_inbox_gate, "INBOX", inbox):
            waiting = sal0_inbox_gate.unanswered("SAL0-01")

        self.assertEqual(len(waiting), 1)
        self.assertEqual(waiting[0]["subject"], "What do you need?")


if __name__ == "__main__":
    unittest.main()
