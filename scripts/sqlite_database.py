import argparse
import re
import sqlite3
import sys
import time
from pathlib import Path


def expected_table_names(schema_path):
    schema = Path(schema_path).read_text(encoding="utf-8")
    models = re.findall(r"(?ms)^model\s+([A-Za-z_]\w*)\s*\{(.*?)^\}", schema)
    if not models:
        raise ValueError("No Prisma models were found in the schema.")

    expected = set()
    for model_name, body in models:
        mapped = re.search(r'(?m)^\s*@@map\("([^"]+)"\)', body)
        expected.add(mapped.group(1) if mapped else model_name)
    expected.add("_prisma_migrations")
    return expected


def open_read_only(database_path):
    path = Path(database_path).resolve(strict=True)
    if not path.is_file() or path.stat().st_size == 0:
        raise ValueError("The SQLite database is missing or empty.")
    connection = sqlite3.connect(path.as_uri() + "?mode=ro", uri=True, timeout=10)
    connection.execute("PRAGMA query_only = ON")
    return connection


def quote_identifier(value):
    return '"' + value.replace('"', '""') + '"'


def validate_database(database_path, schema_path):
    expected = expected_table_names(schema_path)
    connection = open_read_only(database_path)
    try:
        integrity = connection.execute("PRAGMA integrity_check").fetchall()
        if integrity != [("ok",)]:
            raise ValueError("SQLite integrity validation failed.")

        tables = {
            row[0]
            for row in connection.execute(
                "SELECT name FROM sqlite_master WHERE type = 'table' "
                "AND name NOT LIKE 'sqlite_%'"
            )
        }
        missing = expected - tables
        if missing:
            raise ValueError("The database is missing one or more Prisma schema tables.")

        migration_columns = {
            row[1] for row in connection.execute('PRAGMA table_info("_prisma_migrations")')
        }
        if not {"migration_name", "finished_at", "rolled_back_at"} <= migration_columns:
            raise ValueError("Prisma migration metadata has an unexpected schema.")

        incomplete_migrations = connection.execute(
            'SELECT COUNT(*) FROM "_prisma_migrations" '
            "WHERE finished_at IS NULL AND rolled_back_at IS NULL"
        ).fetchone()[0]
        if incomplete_migrations:
            raise ValueError("The database contains an incomplete Prisma migration.")

        migration_directories = Path(schema_path).resolve().parent / "migrations"
        expected_migrations = {
            directory.name
            for directory in migration_directories.iterdir()
            if directory.is_dir() and (directory / "migration.sql").is_file()
        }
        successful_migrations = {
            row[0]
            for row in connection.execute(
                'SELECT migration_name FROM "_prisma_migrations" '
                "WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL"
            )
        }
        if not expected_migrations or expected_migrations - successful_migrations:
            raise ValueError("One or more checked-in Prisma migrations are not applied successfully.")

        foreign_key_violations = connection.execute("PRAGMA foreign_key_check").fetchall()
        if foreign_key_violations:
            raise ValueError("SQLite foreign-key validation failed.")

        row_counts = {}
        for table_name in sorted(tables):
            query = "SELECT COUNT(*) FROM " + quote_identifier(table_name)
            row_counts[table_name] = connection.execute(query).fetchone()[0]

        return {
            "tables": tables,
            "successful_migrations": successful_migrations,
            "row_counts": row_counts,
        }
    finally:
        connection.close()


def online_backup(source_path, destination_path):
    source = open_read_only(source_path)
    destination = sqlite3.connect(destination_path, timeout=10)
    started = time.monotonic()

    def report_progress(_status, _remaining, _total):
        if time.monotonic() - started > 120:
            raise TimeoutError("SQLite online backup exceeded the 120-second safety limit.")

    try:
        source.backup(
            destination,
            pages=256,
            progress=report_progress,
            sleep=0.1,
        )
    finally:
        destination.close()
        source.close()


def run_backup(args):
    source = Path(args.source).resolve(strict=True)
    destination_argument = Path(args.destination)
    if destination_argument.is_symlink():
        raise ValueError("The temporary backup destination cannot be a symbolic link.")
    destination = destination_argument.resolve()
    if source == destination:
        raise ValueError("The backup destination cannot be the configured database.")
    if destination.exists():
        if not destination.is_file() or destination.stat().st_size != 0:
            raise FileExistsError("The temporary backup path already exists and is not an empty owned file.")

    online_backup(source, destination)
    if not destination.is_file() or destination.stat().st_size == 0:
        raise ValueError("SQLite did not produce a non-empty backup.")
    validate_database(destination, args.schema)
    print("SQLite online backup completed; integrity, schema, migration, and foreign-key checks passed.")


def run_restore(args):
    source = Path(args.source).resolve(strict=True)
    destination = Path(args.destination).resolve()
    configured_database = Path(args.configured_database).resolve(strict=True)

    if source == configured_database:
        raise ValueError("The configured application database cannot be used as a restore backup.")
    if destination == configured_database:
        raise ValueError("Refusing to restore over the configured application database.")
    if source == destination:
        raise ValueError("The restore destination cannot be the source backup.")
    if destination.exists():
        raise FileExistsError("The restore destination already exists.")

    source_validation = validate_database(source, args.schema)
    online_backup(source, destination)
    restored_validation = validate_database(destination, args.schema)
    if source_validation["row_counts"] != restored_validation["row_counts"]:
        raise ValueError("Restored table row counts do not match the validated backup.")
    if source_validation["tables"] != restored_validation["tables"]:
        raise ValueError("Restored table set does not match the validated backup.")
    if source_validation["successful_migrations"] != restored_validation["successful_migrations"]:
        raise ValueError("Restored migration metadata does not match the validated backup.")
    print("SQLite restore completed; integrity, schema, migration, foreign-key, and table-count checks passed.")


def main():
    parser = argparse.ArgumentParser()
    subparsers = parser.add_subparsers(dest="operation", required=True)

    backup = subparsers.add_parser("backup")
    backup.add_argument("--source", required=True)
    backup.add_argument("--destination", required=True)
    backup.add_argument("--schema", required=True)
    backup.set_defaults(run=run_backup)

    restore = subparsers.add_parser("restore")
    restore.add_argument("--source", required=True)
    restore.add_argument("--destination", required=True)
    restore.add_argument("--configured-database", required=True)
    restore.add_argument("--schema", required=True)
    restore.set_defaults(run=run_restore)

    args = parser.parse_args()
    try:
        args.run(args)
    except (sqlite3.Error, OSError, ValueError, TimeoutError) as exc:
        print(f"SQLite {args.operation} failed: {type(exc).__name__}: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
