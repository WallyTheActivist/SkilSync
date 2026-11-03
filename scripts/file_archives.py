import argparse
import hashlib
import io
import json
import os
import re
import stat
import sys
import zipfile
from pathlib import Path, PurePosixPath


MANIFEST_VERSION = 1
UPLOAD_MANIFEST = "skillsync-uploads-manifest.json"
CONFIG_MANIFEST = "skillsync-config-manifest.json"
IGNORED_DIRECTORIES = {".git", ".sixth", "node_modules", "dist", "build", "coverage"}
CONFIG_IGNORED_DIRECTORIES = IGNORED_DIRECTORIES | {"uploads", "backup", "backups"}


def sha256_file(path):
    digest = hashlib.sha256()
    with Path(path).open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def validate_relative_path(value):
    if not isinstance(value, str) or not value or "\\" in value:
        raise ValueError("Archive contains an invalid relative path.")
    path = PurePosixPath(value)
    if path.is_absolute() or any(part in {"", ".", ".."} for part in path.parts):
        raise ValueError("Archive contains an unsafe relative path.")
    if re.match(r"^[A-Za-z]:", value):
        raise ValueError("Archive contains an absolute drive path.")
    return path


def discover_upload_roots(project_root):
    roots = []
    for current, directories, _files in os.walk(project_root, followlinks=False):
        current_path = Path(current)
        kept = []
        for name in sorted(directories):
            child = current_path / name
            if child.is_symlink():
                raise ValueError("A project directory is a symbolic link; refusing upload discovery.")
            if name in IGNORED_DIRECTORIES:
                continue
            if name.lower() == "uploads":
                roots.append(child)
            else:
                kept.append(name)
        directories[:] = kept
    return sorted(roots)


def ensure_allowed_upload_file(path):
    name = path.name.lower()
    if name == ".env" or name.startswith(".env."):
        raise ValueError("An environment file was found under an upload directory; refusing to archive it.")
    if re.search(r"\.(?:db|sqlite3?)(?:[-.]|$)", name):
        raise ValueError("A database file was found under an upload directory; refusing to archive it.")


def upload_entries(project_root, roots):
    files = []
    directories = set()
    for root in roots:
        relative_root = root.relative_to(project_root).as_posix()
        directories.add(relative_root)
        for current, subdirectories, filenames in os.walk(root, followlinks=False):
            current_path = Path(current)
            for name in sorted(subdirectories):
                entry = current_path / name
                if entry.is_symlink():
                    raise ValueError("An upload directory is a symbolic link; refusing to archive it.")
                directories.add(entry.relative_to(project_root).as_posix())
            for name in sorted(filenames):
                entry = current_path / name
                if entry.is_symlink() or not entry.is_file():
                    raise ValueError("An uploaded file is a symbolic link or special file; refusing to archive it.")
                ensure_allowed_upload_file(entry)
                relative = entry.relative_to(project_root).as_posix()
                files.append({
                    "path": relative,
                    "size": entry.stat().st_size,
                    "sha256": sha256_file(entry),
                })
    return sorted(directories), sorted(files, key=lambda item: item["path"])


def write_zip_manifest(archive, manifest_name, manifest):
    archive.writestr(
        manifest_name,
        json.dumps(manifest, sort_keys=True, separators=(",", ":")).encode("utf-8"),
    )


def read_and_validate_manifest(archive_bytes, manifest_name, required_prefixes):
    try:
        archive = zipfile.ZipFile(io.BytesIO(archive_bytes), "r")
    except (zipfile.BadZipFile, OSError) as exc:
        raise ValueError("The archive is invalid or corrupted.") from exc

    try:
        corrupt_entry = archive.testzip()
        if corrupt_entry is not None:
            raise ValueError("The archive failed CRC validation.")

        names = [entry.filename for entry in archive.infolist()]
        if len(names) != len(set(names)):
            raise ValueError("The archive contains duplicate paths.")
        if manifest_name not in names:
            raise ValueError("The required archive manifest is missing.")

        for entry in archive.infolist():
            path = validate_relative_path(entry.filename.rstrip("/"))
            if entry.filename != manifest_name and not any(
                path.as_posix() == prefix.rstrip("/") or path.as_posix().startswith(prefix.rstrip("/") + "/")
                for prefix in required_prefixes
            ):
                raise ValueError("The archive contains a path outside the expected backup directories.")
            mode = (entry.external_attr >> 16) & 0xFFFF
            if stat.S_ISLNK(mode):
                raise ValueError("The archive contains a symbolic link.")

        try:
            manifest = json.loads(archive.read(manifest_name).decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError, KeyError) as exc:
            raise ValueError("The archive manifest is invalid.") from exc

        if manifest.get("version") != MANIFEST_VERSION:
            raise ValueError("The archive manifest version is unsupported.")

        files = manifest.get("files")
        directories = manifest.get("directories", [])
        if not isinstance(files, list) or not isinstance(directories, list):
            raise ValueError("The archive manifest structure is invalid.")

        expected_file_paths = set()
        total_bytes = 0
        for item in files:
            if not isinstance(item, dict):
                raise ValueError("The archive manifest contains an invalid file entry.")
            relative = validate_relative_path(item.get("path"))
            if not any(
                relative.as_posix() == prefix.rstrip("/") or
                relative.as_posix().startswith(prefix.rstrip("/") + "/")
                for prefix in required_prefixes
            ):
                raise ValueError("The manifest contains a file outside the expected backup directories.")
            size = item.get("size")
            digest = item.get("sha256")
            if not isinstance(size, int) or size < 0 or not isinstance(digest, str) or not re.fullmatch(r"[a-f0-9]{64}", digest):
                raise ValueError("The archive manifest contains invalid file metadata.")
            if relative.as_posix() in expected_file_paths:
                raise ValueError("The archive manifest contains duplicate file paths.")
            expected_file_paths.add(relative.as_posix())
            total_bytes += size
            if archive.getinfo(relative.as_posix()).file_size != size:
                raise ValueError("An archived file size does not match its manifest.")
            file_bytes = archive.read(relative.as_posix())
            if hashlib.sha256(file_bytes).hexdigest() != digest:
                raise ValueError("An archived file hash does not match its manifest.")

        actual_files = {
            entry.filename for entry in archive.infolist()
            if not entry.is_dir() and entry.filename != manifest_name
        }
        if actual_files != expected_file_paths:
            raise ValueError("The archive file set does not match its manifest.")

        directory_paths = set()
        for directory in directories:
            relative = validate_relative_path(directory)
            if not any(
                relative.as_posix() == prefix.rstrip("/") or
                relative.as_posix().startswith(prefix.rstrip("/") + "/")
                for prefix in required_prefixes
            ):
                raise ValueError("The manifest contains an unexpected directory.")
            directory_paths.add(relative.as_posix())
        actual_directories = {entry.filename.rstrip("/") for entry in archive.infolist() if entry.is_dir()}
        if actual_directories != directory_paths:
            raise ValueError("The archive directory set does not match its manifest.")

        return archive, manifest, total_bytes
    except Exception:
        archive.close()
        raise


def backup_uploads(args):
    project_root = Path(args.project_root).resolve(strict=True)
    destination = Path(args.output).resolve()
    roots = discover_upload_roots(project_root)
    directories, files = upload_entries(project_root, roots)
    prefixes = [root.relative_to(project_root).as_posix() for root in roots]
    manifest = {
        "version": MANIFEST_VERSION,
        "kind": "skillsync-uploads",
        "roots": prefixes,
        "directories": directories,
        "files": files,
    }

    output = io.BytesIO()
    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for relative_directory in directories:
            archive.writestr(relative_directory.rstrip("/") + "/", b"")
        for item in files:
            archive.write(project_root / Path(*PurePosixPath(item["path"]).parts), item["path"])
        write_zip_manifest(archive, UPLOAD_MANIFEST, manifest)

    archive_bytes = output.getvalue()
    _archive, validated, total_bytes = read_and_validate_manifest(
        archive_bytes, UPLOAD_MANIFEST, prefixes
    )
    if validated != manifest:
        _archive.close()
        raise ValueError("Upload archive validation did not match the source manifest.")
    _archive.close()
    with destination.open("xb") as stream:
        stream.write(archive_bytes)
    print(f"Upload archive validated; files={len(files)}; total bytes={total_bytes}.")


def validate_upload_archive(args):
    archive_bytes = Path(args.archive).read_bytes()
    archive, manifest, total_bytes = read_and_validate_manifest(
        archive_bytes, UPLOAD_MANIFEST, manifest_prefixes(archive_bytes, UPLOAD_MANIFEST)
    )
    archive.close()
    print(f"Upload archive validated; files={len(manifest['files'])}; total bytes={total_bytes}.")


def manifest_prefixes(archive_bytes, manifest_name):
    try:
        with zipfile.ZipFile(io.BytesIO(archive_bytes), "r") as archive:
            manifest = json.loads(archive.read(manifest_name).decode("utf-8"))
    except (zipfile.BadZipFile, KeyError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ValueError("The upload archive manifest is invalid.") from exc
    roots = manifest.get("roots")
    if not isinstance(roots, list) or not roots:
        raise ValueError("The upload archive contains no upload roots.")
    if manifest.get("kind") != "skillsync-uploads" or manifest.get("version") != MANIFEST_VERSION:
        raise ValueError("The upload archive manifest is not a supported SkillSync upload manifest.")
    normalized = []
    for root in roots:
        relative = validate_relative_path(root)
        if relative.parts[-1].lower() != "uploads":
            raise ValueError("The archive contains an unexpected upload root.")
        normalized.append(relative.as_posix())
    return normalized


def extract_uploads(args):
    archive_bytes = Path(args.archive).read_bytes()
    prefixes = manifest_prefixes(archive_bytes, UPLOAD_MANIFEST)
    archive, manifest, total_bytes = read_and_validate_manifest(
        archive_bytes, UPLOAD_MANIFEST, prefixes
    )
    destination = Path(args.destination)
    destination.mkdir(parents=True, exist_ok=False)
    try:
        for relative in manifest["directories"]:
            output_path = destination.joinpath(*validate_relative_path(relative).parts)
            output_path.mkdir(parents=True, exist_ok=True)
        for item in manifest["files"]:
            relative = validate_relative_path(item["path"])
            output_path = destination.joinpath(*relative.parts)
            output_path.parent.mkdir(parents=True, exist_ok=True)
            with archive.open(relative.as_posix(), "r") as source, output_path.open("xb") as target:
                for chunk in iter(lambda: source.read(1024 * 1024), b""):
                    target.write(chunk)
            if output_path.stat().st_size != item["size"] or sha256_file(output_path) != item["sha256"]:
                raise ValueError("An extracted upload failed manifest verification.")
    finally:
        archive.close()
    print(f"Upload extraction validated; files={len(manifest['files'])}; total bytes={total_bytes}.")


def discover_configuration_files(project_root):
    files = []
    for current, directories, filenames in os.walk(project_root, followlinks=False):
        current_path = Path(current)
        kept = []
        for name in sorted(directories):
            child = current_path / name
            if child.is_symlink():
                raise ValueError("A project directory is a symbolic link; refusing configuration discovery.")
            if name in CONFIG_IGNORED_DIRECTORIES:
                continue
            kept.append(name)
        directories[:] = kept
        for name in sorted(filenames):
            if name == ".env.example" or name.startswith(".env.example.") or not re.fullmatch(r"\.env(?:\..+)?", name):
                continue
            path = current_path / name
            if path.is_symlink() or not path.is_file():
                raise ValueError("A configuration file is a symbolic link or special file.")
            files.append(path)
    return sorted(files)


def config_manifest_and_bytes(project_root):
    files = discover_configuration_files(project_root)
    if not files:
        raise ValueError("No actual environment configuration files were found.")
    manifest_files = []
    content = {}
    for path in files:
        relative = path.relative_to(project_root).as_posix()
        raw = path.read_bytes()
        content[relative] = raw
        manifest_files.append({
            "path": relative,
            "size": len(raw),
            "sha256": hashlib.sha256(raw).hexdigest(),
        })
    manifest = {
        "version": MANIFEST_VERSION,
        "kind": "skillsync-config",
        "files": manifest_files,
    }
    return manifest, content


def create_config_archive(args):
    project_root = Path(args.project_root).resolve(strict=True)
    manifest, content = config_manifest_and_bytes(project_root)
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for item in manifest["files"]:
            info = zipfile.ZipInfo(item["path"])
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = (0o600 & 0xFFFF) << 16
            archive.writestr(info, content[item["path"]])
        info = zipfile.ZipInfo(CONFIG_MANIFEST)
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = (0o600 & 0xFFFF) << 16
        write_zip_manifest(archive, CONFIG_MANIFEST, manifest)
    archive_bytes = output.getvalue()
    _archive, checked, _total = read_and_validate_manifest(
        archive_bytes, CONFIG_MANIFEST, [item["path"] for item in manifest["files"]]
    )
    _archive.close()
    if checked != manifest:
        raise ValueError("Configuration archive validation did not match source metadata.")
    sys.stdout.buffer.write(archive_bytes)


def read_config_archive(stream):
    archive_bytes = stream.read()
    if not archive_bytes:
        raise ValueError("Configuration archive input is empty.")
    try:
        with zipfile.ZipFile(io.BytesIO(archive_bytes), "r") as archive:
            manifest = json.loads(archive.read(CONFIG_MANIFEST).decode("utf-8"))
    except (zipfile.BadZipFile, KeyError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ValueError("Configuration archive is invalid or missing its manifest.") from exc
    files = manifest.get("files")
    if not isinstance(files, list) or not files:
        raise ValueError("Configuration archive manifest has no files.")
    prefixes = []
    for item in files:
        relative = validate_relative_path(item.get("path"))
        name = relative.name
        if name == ".env.example" or not re.fullmatch(r"\.env(?:\..+)?", name):
            raise ValueError("The configuration archive contains a non-environment file.")
        prefixes.append(relative.as_posix())
    archive, validated, total_bytes = read_and_validate_manifest(
        archive_bytes, CONFIG_MANIFEST, prefixes
    )
    if validated.get("kind") != "skillsync-config":
        archive.close()
        raise ValueError("The encrypted archive is not a SkillSync configuration backup.")
    return archive, validated, total_bytes


def validate_config_archive(args):
    archive, manifest, total_bytes = read_config_archive(sys.stdin.buffer)
    archive.close()
    print(f"Configuration archive validated; files={len(manifest['files'])}; total bytes={total_bytes}.")


def extract_config_archive(args):
    archive, manifest, total_bytes = read_config_archive(sys.stdin.buffer)
    destination = Path(args.destination)
    destination.mkdir(parents=True, exist_ok=False)
    try:
        for item in manifest["files"]:
            relative = validate_relative_path(item["path"])
            output_path = destination.joinpath(*relative.parts)
            output_path.parent.mkdir(parents=True, exist_ok=True)
            with archive.open(relative.as_posix(), "r") as source, output_path.open("xb") as target:
                for chunk in iter(lambda: source.read(1024 * 1024), b""):
                    target.write(chunk)
            if output_path.stat().st_size != item["size"] or sha256_file(output_path) != item["sha256"]:
                raise ValueError("A restored configuration file failed manifest verification.")
    finally:
        archive.close()
    print(f"Configuration extraction validated; files={len(manifest['files'])}; total bytes={total_bytes}.")


def main():
    parser = argparse.ArgumentParser()
    subparsers = parser.add_subparsers(dest="operation", required=True)

    uploads = subparsers.add_parser("backup-uploads")
    uploads.add_argument("--project-root", required=True)
    uploads.add_argument("--output", required=True)
    uploads.set_defaults(run=backup_uploads)

    validate_uploads = subparsers.add_parser("validate-uploads")
    validate_uploads.add_argument("--archive", required=True)
    validate_uploads.set_defaults(run=validate_upload_archive)

    extract_upload_parser = subparsers.add_parser("extract-uploads")
    extract_upload_parser.add_argument("--archive", required=True)
    extract_upload_parser.add_argument("--destination", required=True)
    extract_upload_parser.set_defaults(run=extract_uploads)

    config = subparsers.add_parser("create-config-archive")
    config.add_argument("--project-root", required=True)
    config.set_defaults(run=create_config_archive)

    validate_config = subparsers.add_parser("validate-config-archive")
    validate_config.set_defaults(run=validate_config_archive)

    extract_config = subparsers.add_parser("extract-config-archive")
    extract_config.add_argument("--destination", required=True)
    extract_config.set_defaults(run=extract_config_archive)

    args = parser.parse_args()
    try:
        args.run(args)
    except (OSError, ValueError, zipfile.BadZipFile, KeyError) as exc:
        message = "A file-system operation failed." if isinstance(exc, OSError) else str(exc)
        print(f"File archive {args.operation} failed: {type(exc).__name__}: {message}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
