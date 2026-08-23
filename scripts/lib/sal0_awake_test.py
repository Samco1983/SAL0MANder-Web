import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest import mock

import scripts.sal0_awake as awake


class AwakeLeaseTest(unittest.TestCase):
    def setUp(self):
        self.tempdir = tempfile.TemporaryDirectory()
        self.state_file = Path(self.tempdir.name) / "awake.json"
        self.state_patch = mock.patch.object(awake, "STATE_FILE", self.state_file)
        self.dir_patch = mock.patch.object(awake, "STATE_DIR", Path(self.tempdir.name))
        self.state_patch.start()
        self.dir_patch.start()

    def tearDown(self):
        self.state_patch.stop()
        self.dir_patch.stop()
        self.tempdir.cleanup()

    @mock.patch.object(awake, "on_ac_power", return_value=False)
    def test_refuses_battery_by_default(self, _power):
        self.assertEqual(awake.start(600, allow_battery=False), 2)
        self.assertFalse(self.state_file.exists())

    @mock.patch.object(awake, "on_ac_power", return_value=True)
    @mock.patch("subprocess.Popen")
    def test_starts_bounded_caffeinate_lease(self, popen, _power):
        popen.return_value.pid = 4242
        self.assertEqual(awake.start(600, allow_battery=False), 0)
        popen.assert_called_once()
        self.assertEqual(popen.call_args.args[0], ["/usr/bin/caffeinate", "-dis", "-t", "600"])
        self.assertEqual(json.loads(self.state_file.read_text())["pid"], 4242)

    def test_clears_stale_state(self):
        self.state_file.write_text(json.dumps({"pid": 99999999}))
        with mock.patch.object(awake, "process_alive", return_value=False):
            self.assertIsNone(awake.active_state())
        self.assertFalse(self.state_file.exists())

    def test_permission_error_does_not_destroy_live_state(self):
        with mock.patch.object(os, "kill", side_effect=PermissionError):
            self.assertTrue(awake.process_alive(4242))

    def test_stop_terminates_active_lease(self):
        self.state_file.write_text(json.dumps({"pid": 4242}))
        with mock.patch.object(awake, "process_alive", return_value=True), mock.patch.object(
            os, "kill"
        ) as kill:
            self.assertEqual(awake.stop(), 0)
        kill.assert_called_with(4242, awake.signal.SIGTERM)
        self.assertFalse(self.state_file.exists())


if __name__ == "__main__":
    unittest.main()
