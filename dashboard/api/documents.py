"""documents/ folder: list, upload, delete. Personal data, local-only. Never log contents."""

import os
import re
from datetime import datetime, timezone
from pathlib import Path

from . import paths

# documents/README.md "Supported formats"
FOLDERS: dict[str, set[str]] = {
    "cv": {".pdf", ".tex"},
    "linkedin": {".pdf"},
    "diplomas": {".pdf"},
    "references": {".pdf", ".txt", ".md"},
    "postings": {".txt"},
    "applications": {".tex", ".md"},
}
CONVERT_HINT = {".docx", ".doc", ".png", ".jpg", ".jpeg"}
MAX_BYTES = 25 * 1024 * 1024
SUB_RE = re.compile(r"[a-z0-9][a-z0-9_]*")  # state.archive_slug shape


class DocError(ValueError):
    def __init__(self, code: str, detail: str = ""):
        super().__init__(detail or code)
        self.code, self.detail = code, detail


def safe_name(name: str) -> str:
    n = Path(str(name).replace("\\", "/")).name  # basename only: no traversal
    n = re.sub(r"[^\w .()\-]", "_", n, flags=re.ASCII).strip(" .")
    if not n or n.startswith(".") or n in (".", ".."):
        raise DocError("bad_filename", name)
    return n


def target_dir(folder: str, sub: str | None) -> Path:
    if folder not in FOLDERS:
        raise DocError("bad_folder", folder)
    if (folder == "applications") != bool(sub):
        raise DocError("bad_folder", "applications need a <company>_<role> subfolder; other folders take none")
    if sub and not SUB_RE.fullmatch(sub):
        raise DocError("bad_subfolder", sub)
    d = paths.DOCS / folder / (sub or "")
    if not d.resolve().is_relative_to(paths.DOCS.resolve()):
        raise DocError("bad_path", str(d))
    return d


def check_ext(folder: str, name: str) -> None:
    ext = Path(name).suffix.lower()
    if ext in CONVERT_HINT:
        raise DocError("unsupported_type", f"{ext} is not readable by /setup; convert to PDF")
    if ext not in FOLDERS[folder]:
        raise DocError("unsupported_type", f"{folder}/ accepts {', '.join(sorted(FOLDERS[folder]))}")


def save(folder: str, sub: str | None, name: str, stream) -> dict:
    """Stream a binary file-like into documents/<folder>/[sub/]<name>. Same name = replace."""
    d = target_dir(folder, sub)  # validates folder/sub before anything else
    name = safe_name(name)
    check_ext(folder, name)
    d.mkdir(parents=True, exist_ok=True)
    part = d / (name + ".part")
    size = 0
    try:
        with part.open("wb") as fh:
            while chunk := stream.read(1 << 20):
                size += len(chunk)
                if size > MAX_BYTES:
                    raise DocError("too_large", f"larger than {MAX_BYTES // (1024 * 1024)} MB")
                fh.write(chunk)
        os.replace(part, d / name)
    finally:
        part.unlink(missing_ok=True)
    return _item(d / name)


def delete(folder: str, sub: str | None, name: str) -> None:
    p = target_dir(folder, sub) / safe_name(name)
    if not p.is_file():
        raise DocError("not_found", name)
    p.unlink()
    if sub and not any(x for x in p.parent.iterdir() if x.name != ".gitkeep"):
        for leftover in p.parent.iterdir():
            leftover.unlink()
        p.parent.rmdir()


def _item(p: Path) -> dict:
    st = p.stat()
    return {"name": p.name, "path": str(p.relative_to(paths.REPO)), "size": st.st_size,
            "modified": datetime.fromtimestamp(st.st_mtime, timezone.utc).isoformat(timespec="seconds")}


def _files(d: Path) -> list[dict]:
    if not d.is_dir():
        return []
    return sorted((_item(p) for p in d.iterdir()
                   if p.is_file() and p.name != ".gitkeep" and not p.name.endswith(".part")),
                  key=lambda i: i["name"])


def listing() -> dict:
    folders: dict = {f: _files(paths.DOCS / f) for f in FOLDERS if f != "applications"}
    apps = paths.DOCS / "applications"
    folders["applications"] = [{"name": d.name, "files": _files(d)}
                               for d in sorted(apps.iterdir()) if d.is_dir()] if apps.is_dir() else []
    total = sum(len(v) for k, v in folders.items() if k != "applications") + \
        sum(len(a["files"]) for a in folders["applications"])
    newest = max((f["modified"] for k, v in folders.items() if k != "applications" for f in v), default=None)
    return {"folders": folders, "total": total, "newest": newest}
