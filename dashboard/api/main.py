"""FastAPI app: thin routes over state/regions/scrape/runs/claude_runner/tracker/submit."""

import asyncio
import shutil
import subprocess
from contextlib import asynccontextmanager
from datetime import date as Date  # aliased: request models have a field literally named `date`
from pathlib import Path
from typing import Literal

from fastapi import FastAPI, File, Query, UploadFile
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from pydantic import BaseModel, Field

from . import claude_runner, documents, paths, profile, regions, runs, scrape, state, tracker

FILE_ROOTS = (paths.CV, paths.COVER, paths.DOCS)  # DOCS contains documents/applications (archives) and uploads


@asynccontextmanager
async def lifespan(app: FastAPI):
    from . import submit  # imports playwright lazily
    worker = runs.start({
        "scrape": scrape.run,
        "scrape-llm": claude_runner.run,
        "rank": claude_runner.run,
        "apply-docs": claude_runner.run,
        "interview": claude_runner.run,
        "outcome-run": claude_runner.run,
        "submit": submit.run_submit,
        "login": submit.run_login,
        "setup": claude_runner.run,
        "roadmap": claude_runner.run,
    })
    yield
    worker.cancel()


app = FastAPI(title="auto_jobs_pipeline", lifespan=lifespan)


def err(status: int, code: str, detail: str = ""):
    return JSONResponse({"error": code, "detail": detail}, status_code=status)


def accepted(run: runs.Run):
    return JSONResponse({"run_id": run.id, "state": run.state, "position": runs.queue_length()}, status_code=202)


def _version(cmd: list[str]) -> str | None:
    if not shutil.which(cmd[0]):
        return None
    try:
        out = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
        return (out.stdout or out.stderr).strip().splitlines()[0][:80] if (out.stdout or out.stderr) else "present"
    except (subprocess.SubprocessError, OSError):
        return "present"


# ---------- health / overview ----------

@app.get("/health")
def health():
    tools = {"bun": _version(["bun", "--version"]), "claude": _version(["claude", "--version"]),
             "lualatex": _version(["lualatex", "--version"]), "xelatex": _version(["xelatex", "--version"]),
             "pdftotext": _version(["pdftotext", "-v"])}
    try:
        import playwright  # noqa: F401
        tools["playwright"] = "present"
    except ImportError:
        tools["playwright"] = None
    return {"ok": True, **tools, "repo": str(paths.REPO),
            "seen_exists": paths.SEEN.is_file(), "tracker_exists": paths.TRACKER.is_file(),
            "regions": [r["id"] for r in regions.load()]}


@app.get("/overview")
def overview():
    last = {}
    for m in runs.list_runs(limit=200):
        last.setdefault(m["kind"], m)
    return {**state.overview(), "last_runs": last, "current_run": runs.current(),
            "queue_length": runs.queue_length(),
            "documents_total": documents.listing()["total"],
            "profile_exists": not profile.name_is_placeholder(),
            "roadmap_exists": paths.ROADMAP.is_file()}


# ---------- regions / hunt ----------

class Portal(BaseModel):
    skill: str
    locations: list[str] | None = None
    flags: dict = Field(default_factory=dict)


class Region(BaseModel):
    id: str
    label: str
    queries: list[str] = Field(default_factory=list)
    portals: list[Portal]


@app.get("/regions")
def list_regions():
    return {"regions": [regions.with_portal_status(r) for r in regions.load()]}


@app.get("/regions/{region_id}")
def get_region(region_id: str):
    r = regions.get(region_id)
    return regions.with_portal_status(r) if r else err(404, "not_found", region_id)


@app.put("/regions/{region_id}")
def put_region(region_id: str, body: Region):
    if body.id != region_id:
        return err(400, "id_mismatch")
    try:
        r = regions.upsert(body.model_dump(exclude_none=True))
    except ValueError as exc:
        return err(400, "invalid_region", str(exc))
    return regions.with_portal_status(r)


@app.delete("/regions/{region_id}")
def delete_region(region_id: str):
    regs = regions.load()
    if not any(r["id"] == region_id for r in regs):
        return err(404, "not_found", region_id)
    regions.save([r for r in regs if r["id"] != region_id])
    return {"deleted": region_id}


class ScrapeReq(BaseModel):
    region: str
    queries: list[str] | None = None
    portals: list[str] | None = None


@app.post("/scrape")
def post_scrape(body: ScrapeReq):
    if regions.get(body.region) is None:
        return err(404, "not_found", body.region)
    return accepted(runs.create("scrape", body.model_dump(exclude_none=True)))


class FocusReq(BaseModel):
    focus: str | None = None


@app.post("/scrape/llm")
def post_scrape_llm(body: FocusReq):
    return accepted(runs.create("scrape-llm", body.model_dump(exclude_none=True)))


# ---------- jobs ----------

@app.get("/jobs")
def list_jobs(status: str | None = None, region: str | None = None, portal: str | None = None,
              min_score: int | None = None, q: str | None = None, sort: str = "-first_seen",
              limit: int = Query(50, le=1000), offset: int = 0):
    return state.list_jobs(status, region, portal, min_score, q, sort, limit, offset)


@app.get("/jobs/{key}")
def get_job(key: str):
    item = state.job_detail(key)
    return item if item else err(404, "not_found", key)


class JobPatch(BaseModel):
    status: Literal["skipped", "new"]


@app.patch("/jobs/{key}")
def patch_job(key: str, body: JobPatch):
    doc, seen = state.read_seen_doc()
    if key not in seen:
        return err(404, "not_found", key)
    if seen[key].get("status") not in ("new", "skipped"):
        return err(409, "not_editable", f"status is {seen[key].get('status')}")
    seen[key]["status"] = body.status
    import rank_state
    rank_state.save_state(paths.SEEN, doc)
    return state.job_detail(key)


class RankReq(BaseModel):
    all: bool = False
    focus: str | None = None
    limit: int = 10


@app.post("/rank")
def post_rank(body: RankReq):
    return accepted(runs.create("rank", body.model_dump(exclude_none=True)))


@app.post("/jobs/{key}/apply-docs")
def post_job_apply_docs(key: str):
    entry = state.read_seen().get(key)
    if entry is None:
        return err(404, "not_found", key)
    return accepted(runs.create("apply-docs", {"url": entry["url"], "key": key,
                                               "company": entry.get("company"), "title": entry.get("title")}))


class UrlReq(BaseModel):
    url: str


@app.post("/apply-docs")
def post_apply_docs(body: UrlReq):
    return accepted(runs.create("apply-docs", {"url": body.url}))


# ---------- applications ----------

@app.get("/applications")
def list_applications(status: Literal["open", "final", "all"] = "all"):
    return {"items": state.list_applications(status)}


@app.get("/applications/{slug}")
def get_application(slug: str, row: int | None = None):
    items = state.find_application(slug, row)
    if not items:
        return err(404, "not_found", slug)
    item = items[-1] if row is None else items[0]
    out = paths.APPS / slug / "outcome.md"
    item["outcome_md"] = out.read_text(encoding="utf-8") if out.is_file() else None
    item["rows"] = [i["row_index"] for i in items]
    return item


def _pick_row(slug: str, row: int | None) -> dict | JSONResponse:
    items = state.find_application(slug, row)
    if not items:
        return err(404, "not_found", slug)
    open_rows = [i for i in items if not i["final"]]
    if row is None and len(open_rows) > 1:
        return err(409, "ambiguous", f"rows {[i['row_index'] for i in open_rows]} are open; pass row")
    return (open_rows or items)[-1]


class StatusReq(BaseModel):
    status: str
    note: str | None = None
    date: Date | None = None
    row: int | None = None


@app.patch("/applications/{slug}/status")
def patch_status(slug: str, body: StatusReq):
    item = _pick_row(slug, body.row)
    if isinstance(item, JSONResponse):
        return item
    try:
        tracker.set_status(item["row_index"], body.status, body.note, body.date)
    except ValueError as exc:
        return err(400, "bad_status", str(exc))
    return state.find_application(slug, item["row_index"])[0]


class OutcomeRunReq(BaseModel):
    status: str
    stages: list[str] | None = None
    feedback: str | None = None
    date: Date | None = None
    row: int | None = None


@app.post("/applications/{slug}/outcome-run")
def post_outcome_run(slug: str, body: OutcomeRunReq):
    item = _pick_row(slug, body.row)
    if isinstance(item, JSONResponse):
        return item
    if body.status not in state.VOCAB:
        return err(400, "bad_status")
    args = {"company": item["company"], "role": item["role"], "slug": slug, "status": body.status}
    if body.stages:
        args["stages"] = ", ".join(body.stages)
    if body.feedback:
        args["feedback"] = body.feedback
    if body.date:
        args["date"] = body.date.isoformat()
    return accepted(runs.create("outcome-run", args))


class InterviewReq(BaseModel):
    stage: Literal["phone_screen", "technical", "case", "final"]
    date: Date | None = None
    format: str | None = None
    interviewers: list[str] | None = None
    row: int | None = None


@app.post("/applications/{slug}/interview")
def post_interview(slug: str, body: InterviewReq):
    item = _pick_row(slug, body.row)
    if isinstance(item, JSONResponse):
        return item
    args = {"company": item["company"], "role": item["role"], "slug": slug, "stage": body.stage}
    if body.date:
        args["date"] = body.date.isoformat()
    if body.format:
        args["format"] = body.format
    if body.interviewers:
        args["interviewers"] = ", ".join(body.interviewers)
    return accepted(runs.create("interview", args))


@app.get("/applications/{slug}/prep/{stage}")
def get_prep(slug: str, stage: str):
    p = paths.APPS / slug / f"interview_prep_{stage}.md"
    if not p.is_file():
        return err(404, "not_found", str(p.relative_to(paths.REPO)))
    return {"stage": stage, "markdown": p.read_text(encoding="utf-8")}


class SubmitReq(BaseModel):
    dry_run: bool = True
    adapter: Literal["auto", "linkedin", "jobstreet", "generic"] = "auto"
    row: int | None = None


@app.post("/applications/{slug}/submit")
def post_submit(slug: str, body: SubmitReq):
    item = _pick_row(slug, body.row)
    if isinstance(item, JSONResponse):
        return item
    if item["status"] != "drafted":
        return err(409, "not_drafted", f"status is {item['status']}")
    if not (item["cv_pdf"] and item["cover_pdf"]):
        return err(409, "pdfs_missing", "run apply-docs first")
    if not item["source"]:
        return err(409, "no_source_url", "tracker row has no posting URL")
    return accepted(runs.create("submit", {
        "slug": slug, "row": item["row_index"], "url": item["source"], "company": item["company"],
        "role": item["role"], "cv_pdf": item["cv_pdf"], "cover_pdf": item["cover_pdf"],
        "dry_run": body.dry_run, "adapter": body.adapter}))


class LoginReq(BaseModel):
    site: Literal["linkedin", "jobstreet"]


@app.post("/browser/login")
def post_login(body: LoginReq):
    return accepted(runs.create("login", {"site": body.site}))


@app.get("/browser/status")
def browser_status():
    from . import submit
    return submit.status()


# ---------- documents / profile / setup / roadmap ----------

def _doc_err(exc: documents.DocError):
    status = {"not_found": 404, "too_large": 413, "unsupported_type": 415}.get(exc.code, 400)
    return err(status, exc.code, exc.detail)


@app.get("/documents")
def list_documents():
    return documents.listing()


async def _upload(folder: str, sub: str | None, files: list[UploadFile]):
    saved, rejected = [], []
    for f in files:
        try:
            saved.append(documents.save(folder, sub, f.filename or "", f.file))
        except documents.DocError as exc:
            rejected.append({"name": f.filename, "error": exc.code, "detail": exc.detail})
        finally:
            await f.close()
    if not saved and rejected:
        r = rejected[0]
        return _doc_err(documents.DocError(r["error"], f"{r['name']}: {r['detail']}"))
    return {"saved": saved, "rejected": rejected}


@app.post("/documents/applications/{sub}", status_code=201)
async def upload_application_docs(sub: str, files: list[UploadFile] = File(...)):
    return await _upload("applications", sub, files)


@app.post("/documents/{folder}", status_code=201)
async def upload_documents(folder: str, files: list[UploadFile] = File(...)):
    return await _upload(folder, None, files)


@app.delete("/documents/applications/{sub}/{name}")
def delete_application_doc(sub: str, name: str):
    try:
        documents.delete("applications", sub, name)
    except documents.DocError as exc:
        return _doc_err(exc)
    return {"deleted": name}


@app.delete("/documents/{folder}/{name}")
def delete_document(folder: str, name: str):
    try:
        documents.delete(folder, None, name)
    except documents.DocError as exc:
        return _doc_err(exc)
    return {"deleted": name}


@app.get("/profile")
def get_profile():
    return profile.load()


class Lang(BaseModel):
    language: str
    level: str = ""


class SetupReq(BaseModel):
    career_goals: str | None = None
    excites: str | None = None
    deal_breakers: str | None = None
    languages: list[Lang] = Field(default_factory=list)
    location: str | None = None
    target_titles: list[str] = Field(default_factory=list)
    key_skills: list[str] = Field(default_factory=list)
    geography: str | None = None


def _setup(body: SetupReq, section: str | None):
    answers = body.model_dump()
    profile.write_answers(answers)  # persisted first: prefill + queries-from-profile work even if the run fails
    return accepted(runs.create("setup", {**answers, **({"section": section} if section else {})}))


@app.post("/setup")
def post_setup(body: SetupReq):
    return _setup(body, None)


@app.post("/setup/search")
def post_setup_search(body: SetupReq):
    return _setup(body, "search")


@app.post("/regions/{region_id}/queries-from-profile")
def post_queries_from_profile(region_id: str):
    r = regions.get(region_id)
    if r is None:
        return err(404, "not_found", region_id)
    qs = profile.hunt_queries()
    if not qs:
        return err(409, "no_profile_queries", "run the document analysis first, or add target titles")
    return regions.with_portal_status(regions.upsert({**r, "queries": qs}))


@app.get("/roadmap")
def get_roadmap():
    return profile.read_roadmap()


@app.post("/roadmap")
def post_roadmap():
    return accepted(runs.create("roadmap", {}))


# ---------- files / runs ----------

@app.get("/files/{path:path}")
def get_file(path: str):
    target = (paths.REPO / path).resolve()
    if not any(target.is_relative_to(root.resolve()) for root in FILE_ROOTS) or not target.is_file():
        return err(404, "not_found", path)
    return FileResponse(target)


@app.get("/runs")
def list_runs(kind: str | None = None, limit: int = Query(50, le=500)):
    return {"items": runs.list_runs(kind, limit)}


@app.get("/runs/{run_id}")
def get_run(run_id: str):
    r = runs.get(run_id)
    if r is None:
        return err(404, "not_found", run_id)
    log = paths.RUNS / f"{run_id}.jsonl"
    tail = log.read_text(encoding="utf-8").splitlines()[-50:] if log.is_file() else []
    return {**runs.meta_of(r), "tail": tail}


@app.get("/runs/{run_id}/events")
async def run_events(run_id: str, after: int = 0):
    if runs.get(run_id) is None:
        return err(404, "not_found", run_id)

    async def gen():
        async for n, line in runs.events(run_id, after):
            yield f"id: {n}\ndata: {line}\n\n"
        yield "event: done\ndata: {}\n\n"

    return StreamingResponse(gen(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@app.post("/runs/{run_id}/cancel")
def cancel_run(run_id: str):
    m = runs.cancel(run_id)
    return m if m else err(404, "not_found", run_id)
