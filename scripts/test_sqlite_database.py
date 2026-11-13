import argparse
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from scripts import sqlite_database


class BackupDestinationTests(unittest.TestCase):
    def setUp(self):
        self.temporary_directory = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary_directory.name)
        self.source = self.root / "source-placeholder.db"
        self.destination = self.root / "owned-empty.tmp"
        self.source.write_bytes(b"synthetic source placeholder")
        self.destination.touch()
        self.arguments = argparse.Namespace(
            source=str(self.source),
            destination=str(self.destination),
            schema=str(self.root / "schema.prisma"),
        )

    def tearDown(self):
        self.temporary_directory.cleanup()

    @patch("scripts.sqlite_database.validate_database")
    @patch("scripts.sqlite_database.online_backup")
    def test_backup_accepts_an_existing_empty_operation_owned_destination(self, online_backup, _validate):
        online_backup.side_effect = lambda _source, destination: Path(destination).write_bytes(b"synthetic output")

        sqlite_database.run_backup(self.arguments)

        self.assertEqual(self.destination.read_bytes(), b"synthetic output")
        online_backup.assert_called_once()

    @patch("scripts.sqlite_database.online_backup")
    def test_backup_refuses_a_preexisting_nonempty_destination(self, online_backup):
        self.destination.write_bytes(b"unowned contents")

        with self.assertRaises(FileExistsError):
            sqlite_database.run_backup(self.arguments)

        online_backup.assert_not_called()
        self.assertEqual(self.destination.read_bytes(), b"unowned contents")

    @patch("scripts.sqlite_database.online_backup")
    def test_backup_refuses_a_symbolic_link_destination_when_supported(self, online_backup):
        self.destination.unlink()
        try:
            self.destination.symlink_to(self.source)
        except (OSError, NotImplementedError) as error:
            self.skipTest(f"Symlink creation is not supported: {error}")

        with self.assertRaisesRegex(ValueError, "symbolic link"):
            sqlite_database.run_backup(self.arguments)

        online_backup.assert_not_called()


if __name__ == "__main__":
    unittest.main()
