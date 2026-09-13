"""The one writer for job_search_tracker.csv. Rules copied from /outcome Step 4
and /apply Step 6b: touch only status/notes/date of one row, never reorder,
keep unknown columns, append `,deadline` to a legacy header."""

import csv
import os
import tempfile
from datetime import date

from . import paths
from .state import FINAL, HEADER, VOCAB, norm_status


def _read() -> tuple[list[str], list[dict]]:
    if not paths.TRACKER.is_file():
        return list(HEADER), []
    with paths.TRACKER.open(encoding="utf-8", newline="") as fh:
        reader = csv.DictReader(fh)
        rows = [dict(r) for r in reader]
        header = list(reader.fieldnames or HEADER)
    if header[-1] != "deadline":
        header.append("deadline")
    return header, rows


def _write(header: list[str], rows: list[dict]) -> None:
    paths.TRACKER.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=str(paths.TRACKER.parent), prefix=".tracker.", suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="") as fh:
            w = csv.DictWriter(fh, fieldnames=header, extrasaction="ignore", restval="")
            w.writeheader()
            w.writerows(rows)
        os.replace(tmp, paths.TRACKER)
    except BaseException:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        raise


def set_status(row_index: int, status: str, note: str | None = None,
               when: date | None = None) -> dict:
    if status not in VOCAB:
        raise ValueError(f"status must be one of {', '.join(VOCAB)}")
    header, rows = _read()
    if not 0 <= row_index < len(rows):
        raise IndexError(f"no tracker row {row_index}")
    row = rows[row_index]
    today = (when or date.today()).isoformat()
    previous = norm_status(row.get("status", ""))
    row["status"] = status
    if previous == "drafted" and status != "drafted":
        row["date"] = today  # /outcome: drafted date is the drafting date, not the send date
    if note:
        existing = (row.get("notes") or "").strip()
        row["notes"] = f"{existing}; {note} {today}".strip("; ") if existing else f"{note} {today}"
    _write(header, rows)
    row["row_index"] = row_index
    row["final"] = status in FINAL
    return row
