"""Region hunt: run the portal CLIs directly (no LLM) and merge into seen_jobs.json
following /scrape Steps 1b, 2 and 4 mechanically. Fit judgement is /rank's job."""

import asyncio
import json
from collections import Counter
from datetime import date, timedelta

from . import paths, regions
from .runs import Run
from .state import read_seen_doc

import job_key      # tools/job_key.py
import rank_state   # tools/rank_state.py

MAX_AGE_DAYS = 14
CALL_TIMEOUT = 60
POLITE_SLEEP = {"linkedin-search": 2.0}


def merge_results(seen: dict, results: list[dict], *, portal: str, region: str,
                  today: date, tracker: set[tuple[str, str]]) -> Counter:
    """Mutates `seen`; returns counts. Idempotent: same input twice adds nothing."""
    counts = Counter()
    known_urls = {str(e.get("url") or "").rstrip("/") for e in seen.values()}
    for r in results:
        counts["seen"] += 1
        title, company, url = r.get("title") or "", r.get("company") or "", str(r.get("url") or "")
        if not title or not url:
            counts["invalid"] += 1
            continue
        posted = rank_state.parse_iso(str(r.get("date") or "")[:10])
        if posted and (today - posted).days > MAX_AGE_DAYS:
            counts["stale"] += 1
            continue
        if url.rstrip("/") in known_urls:
            counts["duplicate"] += 1
            continue
        key = job_key.make_key(company, title, url)
        if key in seen:
            counts["duplicate"] += 1
            continue
        in_tracker = (rank_state.norm(company), rank_state.norm(title)) in tracker
        seen[key] = {
            "title": title,
            "company": company or None,
            "url": url,
            "location": r.get("location"),
            "first_seen": today.isoformat(),
            "posted_date": posted.isoformat() if posted else None,
            "deadline": None,
            "fit": None,
            "status": "skipped" if in_tracker else "new",
            "portal": portal,
            "source": "cli",
            "region": region,
        }
        known_urls.add(url.rstrip("/"))
        counts["skipped" if in_tracker else "new"] += 1
    return counts


async def run(run: Run) -> None:
    region = regions.get(run.args["region"])
    if region is None:
        run.fail("no_such_region", run.args["region"])
        return
    cmds = regions.build_commands(region, run.args.get("queries"), run.args.get("portals"))
    doc, seen = read_seen_doc()
    tracker = rank_state.tracker_pairs(paths.TRACKER)
    total = Counter()
    per_portal: dict[str, Counter] = {}
    skipped_portals = []
    for cmd in cmds:
        if run.cancelled:
            return
        skill = cmd["skill"]
        if not regions.portal_installed(skill) or not regions.portal_enabled(skill):
            if skill not in skipped_portals:
                skipped_portals.append(skill)
                run.log("summary", text=f"skipped {skill} (not installed or enabled: false)")
            continue
        run.log("status", state="running", step=f"{skill} q={cmd['query']!r} loc={cmd['location']!r}")
        try:
            proc = await asyncio.create_subprocess_exec(
                *cmd["argv"], cwd=paths.REPO,
                stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
            run.proc = proc
            out, err = await asyncio.wait_for(proc.communicate(), CALL_TIMEOUT)
        except asyncio.TimeoutError:
            proc.kill()
            run.log("error", code="portal_timeout", portal=skill, cmd=cmd["argv"])
            total["errors"] += 1
            continue
        except FileNotFoundError as exc:
            run.fail("bun_missing", str(exc))
            return
        finally:
            run.proc = None
        if proc.returncode != 0:
            run.log("error", code="portal_error", portal=skill, exit=proc.returncode,
                    stderr=err.decode(errors="replace")[-1000:])
            total["errors"] += 1
            continue
        try:
            results = json.loads(out.decode() or "{}").get("results", [])
        except json.JSONDecodeError:
            run.log("error", code="portal_bad_json", portal=skill, stdout=out.decode(errors="replace")[:500])
            total["errors"] += 1
            continue
        c = merge_results(seen, results, portal=skill, region=region["id"], today=date.today(), tracker=tracker)
        per_portal.setdefault(skill, Counter()).update(c)
        total.update(c)
        run.log("summary", portal=skill, query=cmd["query"], location=cmd["location"], **c)
        if skill in POLITE_SLEEP:
            await asyncio.sleep(POLITE_SLEEP[skill])
    if "seen" not in doc:
        doc = {"seen": seen}
    rank_state.save_state(paths.SEEN, doc)
    run.result = {"region": region["id"], "calls": len(cmds), **total,
                  "per_portal": {k: dict(v) for k, v in per_portal.items()},
                  "skipped_portals": skipped_portals}
    run.log("summary", text=f"{total['new']} new, {total['duplicate']} already seen, "
                            f"{total['stale']} stale, {total['errors']} errors")
