"""Read-only views over upstream's state files: seen_jobs.json, the tracker CSV,
and the per-application archive folders. Nothing here writes."""

import csv
import re
from datetime import date, timedelta
from pathlib import Path

from . import paths

import rank_state  # tools/rank_state.py

# /outcome "Tracker status vocabulary"
VOCAB = ("drafted", "applied", "interview", "offer", "hired",
         "rejected", "no_response", "offer_declined", "withdrawn")
FINAL = frozenset({"hired", "rejected", "no_response", "offer_declined", "withdrawn"})
LEGACY = {"no response": "no_response", "offer declined": "offer_declined"}
HEADER = ("date,company,sector,role,role_type,channel,status,contact_person,"
          "fit_rating,notes,cv_file,cover_letter_file,source,deadline").split(",")
BANDS = ("Strong Fit", "Good Fit", "Moderate Fit", "Weak Fit", "Poor Fit")
JOB_STATUSES = ("new", "ranked", "skipped", "expired")
URGENT_DAYS = 7


def norm_status(value: str) -> str:
    v = (value or "").strip()
    return LEGACY.get(v.lower(), v)


def read_seen_doc() -> tuple[dict, dict]:
    """(document, seen-map). Empty doc when the file does not exist yet."""
    if not paths.SEEN.is_file():
        doc = {"seen": {}}
        return doc, doc["seen"]
    try:
        return rank_state.load_state(paths.SEEN)
    except SystemExit as exc:  # load_state exits on bad JSON
        raise RuntimeError(str(exc)) from exc


def read_seen() -> dict:
    return read_seen_doc()[1]


def read_tracker() -> list[dict]:
    if not paths.TRACKER.is_file():
        return []
    with paths.TRACKER.open(encoding="utf-8", newline="") as fh:
        rows = []
        for i, row in enumerate(csv.DictReader(fh)):
            row = {k: (v or "") for k, v in row.items() if k is not None}
            row["status"] = norm_status(row.get("status", ""))
            row["row_index"] = i
            rows.append(row)
        return rows


def archive_slug(company: str, role: str) -> str:
    """documents/README.md: `<company>_<role>` lowercase, underscores for spaces."""
    s = f"{company}_{role}".lower().replace(" ", "_")
    s = re.sub(r"[^a-z0-9_]", "", s)
    return re.sub(r"_+", "_", s).strip("_")


def _pdf_for(tex_path: str) -> Path | None:
    if not tex_path:
        return None
    p = paths.REPO / tex_path
    pdf = p if p.suffix == ".pdf" else p.with_suffix(".pdf")
    return pdf if pdf.is_file() else None


def _rel(p: Path | None) -> str | None:
    return str(p.relative_to(paths.REPO)) if p else None


def _archive(slug: str) -> dict:
    d = paths.APPS / slug
    if not d.is_dir():
        return {"exists": False, "job_posting": None, "cv_draft": None, "cover_letter": None,
                "outcome": None, "preps": [], "submit_runs": []}
    f = lambda name: _rel(d / name) if (d / name).is_file() else None
    preps = sorted(p.stem.removeprefix("interview_prep_") for p in d.glob("interview_prep_*.md"))
    submit_runs = []
    for run_dir in sorted((d / "submit").glob("*")) if (d / "submit").is_dir() else []:
        shots = sorted(_rel(s) for s in run_dir.glob("*.png"))
        submit_runs.append({"run_id": run_dir.name, "screenshots": shots})
    return {"exists": True, "job_posting": f("job_posting.md"), "cv_draft": f("cv_draft.tex"),
            "cover_letter": f("cover_letter.tex"), "outcome": f("outcome.md"),
            "preps": preps, "submit_runs": submit_runs}


def application_item(row: dict) -> dict:
    slug = archive_slug(row.get("company", ""), row.get("role", ""))
    return {
        **{k: row.get(k, "") for k in HEADER},
        "row_index": row["row_index"],
        "slug": slug,
        "final": row["status"] in FINAL,
        "cv_pdf": _rel(_pdf_for(row.get("cv_file", ""))),
        "cover_pdf": _rel(_pdf_for(row.get("cover_letter_file", ""))),
        "archive": _archive(slug),
    }


def list_applications(status: str = "all") -> list[dict]:
    items = [application_item(r) for r in read_tracker()]
    if status == "open":
        items = [i for i in items if not i["final"]]
    elif status == "final":
        items = [i for i in items if i["final"]]
    return items


def find_application(slug: str, row: int | None = None) -> list[dict]:
    items = [i for i in list_applications() if i["slug"] == slug]
    if row is not None:
        items = [i for i in items if i["row_index"] == row]
    return items


def job_item(key: str, entry: dict, tracker_status: dict[tuple[str, str], str]) -> dict:
    pair = (rank_state.norm(entry.get("company")), rank_state.norm(entry.get("title")))
    deadline = rank_state.parse_iso(entry.get("deadline"))
    today = date.today()
    return {
        "key": key,
        "title": entry.get("title"),
        "company": entry.get("company"),
        "url": entry.get("url"),
        "location": entry.get("location") if entry.get("location") not in ("PASS", "FAIL", "FLAG") else None,
        "portal": entry.get("portal"),
        "region": entry.get("region"),
        "source": entry.get("source"),
        "first_seen": entry.get("first_seen"),
        "posted_date": entry.get("posted_date"),
        "deadline": entry.get("deadline"),
        "closing_soon": bool(deadline and today <= deadline <= today + timedelta(days=URGENT_DAYS)),
        "fit": entry.get("fit"),
        "status": entry.get("status"),
        "rank_score": entry.get("rank_score"),
        "rank_verdict": entry.get("rank_verdict"),
        "rank_date": entry.get("rank_date"),
        "location_verdict": rank_state.entry_location_verdict(entry),
        "language_gate": entry.get("language_gate"),
        "language_note": entry.get("language_note"),
        "strengths": entry.get("strengths") or [],
        "gaps": entry.get("gaps") or [],
        "tracker_status": tracker_status.get(pair),
        "application_slug": archive_slug(entry.get("company") or "", entry.get("title") or "")
        if pair in tracker_status else None,
    }


def tracker_status_map(rows: list[dict] | None = None) -> dict[tuple[str, str], str]:
    out = {}
    for r in rows if rows is not None else read_tracker():
        out[(rank_state.norm(r.get("company")), rank_state.norm(r.get("role")))] = r["status"]
    return out


def list_jobs(status=None, region=None, portal=None, min_score=None, q=None,
              sort="first_seen", limit=50, offset=0) -> dict:
    seen = read_seen()
    tmap = tracker_status_map()
    statuses = set(status.split(",")) if status else None
    items = []
    for key, entry in seen.items():
        if statuses and entry.get("status") not in statuses:
            continue
        if region and entry.get("region") != region:
            continue
        if portal and entry.get("portal") != portal:
            continue
        if min_score is not None and (entry.get("rank_score") or -1) < min_score:
            continue
        if q:
            hay = " ".join(str(entry.get(k) or "") for k in ("title", "company", "location")).lower()
            if q.lower() not in hay:
                continue
        items.append(job_item(key, entry, tmap))
    desc = sort.startswith("-")
    field = sort.lstrip("-")
    items.sort(key=lambda i: (i.get(field) is None, i.get(field) or ""), reverse=desc)
    return {"total": len(items), "items": items[offset: offset + limit]}


def job_detail(key: str) -> dict | None:
    seen = read_seen()
    entry = seen.get(key)
    if entry is None:
        return None
    rows = read_tracker()
    item = job_item(key, entry, tracker_status_map(rows))
    pair = (rank_state.norm(entry.get("company")), rank_state.norm(entry.get("title")))
    item["tracker_rows"] = [
        application_item(r) for r in rows
        if (rank_state.norm(r.get("company")), rank_state.norm(r.get("role"))) == pair
    ]
    return item


def overview() -> dict:
    seen = read_seen()
    rows = read_tracker()
    by_status = {s: 0 for s in JOB_STATUSES}
    bands = {b: 0 for b in BANDS}
    by_region, by_portal = {}, {}
    for e in seen.values():
        by_status[e.get("status")] = by_status.get(e.get("status"), 0) + 1
        if e.get("rank_verdict") in bands:
            bands[e["rank_verdict"]] += 1
        if e.get("region"):
            by_region[e["region"]] = by_region.get(e["region"], 0) + 1
        if e.get("portal"):
            by_portal[e["portal"]] = by_portal.get(e["portal"], 0) + 1
    tracker = {s: 0 for s in VOCAB}
    for r in rows:
        tracker[r["status"]] = tracker.get(r["status"], 0) + 1
    return {
        "seen": {**by_status, "total": len(seen)},
        "ranked_bands": bands,
        "by_region": by_region,
        "by_portal": by_portal,
        "tracker": tracker,
        "tracker_total": len(rows),
    }
