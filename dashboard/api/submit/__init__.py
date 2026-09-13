"""Playwright auto-submit. Adapter = module with HOSTS, submit(page, ctx), login_url(), is_logged_in(page).

ToS note: automated applications breach LinkedIn's and SEEK/JobStreet's terms; the user
accepted that risk. Keep volume low, prefer HEADED=1, never loop submits."""

import asyncio
import os
import shutil
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

import yaml

from .. import paths, tracker
from ..runs import Run
from . import generic, jobstreet, linkedin

ADAPTERS = {"linkedin": linkedin, "jobstreet": jobstreet, "generic": generic}


class SubmitError(Exception):
    def __init__(self, code: str, detail: str = ""):
        super().__init__(f"{code}: {detail}")
        self.code, self.detail = code, detail


@dataclass
class Screenshots:
    dir: Path
    run: Run
    n: int = 0

    def shot(self, page, label: str) -> str:
        self.dir.mkdir(parents=True, exist_ok=True)
        self.n += 1
        path = self.dir / f"{self.n:02d}-{label}.png"
        try:
            page.screenshot(path=str(path), full_page=False)
        except Exception as exc:  # noqa: BLE001 - a failed screenshot must not fail the submit
            self.run.log("stderr", text=f"screenshot failed: {exc!r}")
            return ""
        rel = str(path.relative_to(paths.REPO))
        self.run.log("screenshot", path=rel, label=label)
        return rel


@dataclass
class SubmitContext:
    url: str
    company: str
    role: str
    cv_pdf: Path
    cover_pdf: Path
    answers: dict
    dry_run: bool
    shots: Screenshots
    run: Run
    steps: list[str] = field(default_factory=list)

    def step(self, name: str) -> None:
        self.steps.append(name)
        self.run.log("status", state="running", step=name)

    @property
    def cancelled(self) -> bool:
        return self.run.cancelled


def pick_adapter(url: str, name: str = "auto"):
    if name != "auto":
        return ADAPTERS[name]
    host = (urlparse(url).hostname or "").lower()
    for mod in (linkedin, jobstreet):
        if any(host == h or host.endswith("." + h) for h in mod.HOSTS):
            return mod
    return generic


def load_answers() -> dict:
    if not paths.ANSWERS.is_file():
        return {}
    doc = yaml.safe_load(paths.ANSWERS.read_text(encoding="utf-8")) or {}
    return {str(k).strip().lower(): str(v) for k, v in doc.items()}


def _headed() -> bool:
    return os.environ.get("HEADED", "0") == "1"


def _launch(pw, headless: bool):
    paths.BROWSER_PROFILE.mkdir(parents=True, exist_ok=True)
    return pw.chromium.launch_persistent_context(
        user_data_dir=str(paths.BROWSER_PROFILE), headless=headless,
        viewport={"width": 1280, "height": 900}, locale="en-US",
        args=["--disable-blink-features=AutomationControlled"])


def _submit_sync(run: Run) -> dict:
    from playwright.sync_api import sync_playwright

    a = run.args
    adapter = pick_adapter(a["url"], a.get("adapter", "auto"))
    slug = a["slug"]
    shots_dir = paths.APPS / slug / "submit" / run.id
    with sync_playwright() as pw:
        ctx = _launch(pw, headless=not _headed())
        page = ctx.pages[0] if ctx.pages else ctx.new_page()
        page.set_default_timeout(20_000)
        sc = Screenshots(shots_dir, run)
        sctx = SubmitContext(url=a["url"], company=a["company"], role=a["role"],
                             cv_pdf=paths.REPO / a["cv_pdf"], cover_pdf=paths.REPO / a["cover_pdf"],
                             answers=load_answers(), dry_run=bool(a.get("dry_run", True)),
                             shots=sc, run=run)
        try:
            result = adapter.submit(page, sctx)
        except SubmitError as exc:
            sc.shot(page, f"error-{exc.code}")
            raise
        except Exception as exc:  # playwright timeouts etc.
            sc.shot(page, "error")
            raise SubmitError("selector_not_found" if "Timeout" in type(exc).__name__ else "exception",
                              f"{sctx.steps[-1] if sctx.steps else 'start'}: {exc}") from exc
        finally:
            ctx.close()
    return {**result, "adapter": adapter.__name__.rsplit(".", 1)[-1], "steps": sctx.steps,
            "screenshots": sorted(str(p.relative_to(paths.REPO)) for p in shots_dir.glob("*.png"))
            if shots_dir.is_dir() else []}


async def run_submit(run: Run) -> None:
    try:
        result = await asyncio.to_thread(_submit_sync, run)
    except SubmitError as exc:
        if exc.code == "already_applied":
            tracker.set_status(run.args["row"], "applied", note="already applied on portal")
            run.result = {"outcome": "already_applied"}
            return
        run.fail(exc.code, exc.detail)
        return
    run.result = result
    if result.get("outcome") == "submitted":
        tracker.set_status(run.args["row"], "applied",
                           note=f"auto-submitted via {result['adapter']} run {run.id}")
        _archive_tex(run.args)
        run.log("summary", text="tracker status -> applied")
    else:
        run.log("summary", text="dry run complete; nothing was submitted")


def _archive_tex(a: dict) -> None:
    """Mirror /outcome Step 3.1: copy the submitted .tex into the archive, never overwrite."""
    d = paths.APPS / a["slug"]
    d.mkdir(parents=True, exist_ok=True)
    for src_key, name in (("cv_pdf", "cv_draft.tex"), ("cover_pdf", "cover_letter.tex")):
        src = (paths.REPO / a[src_key]).with_suffix(".tex")
        if src.is_file() and not (d / name).exists():
            shutil.copy2(src, d / name)


def _login_sync(run: Run) -> dict:
    from playwright.sync_api import sync_playwright

    mod = ADAPTERS[run.args["site"]]
    with sync_playwright() as pw:
        ctx = _launch(pw, headless=False)
        page = ctx.pages[0] if ctx.pages else ctx.new_page()
        page.goto(mod.login_url())
        run.log("summary", text=f"Chromium window opened at {mod.login_url()}; log in there. Waiting up to 15 min.")
        deadline = datetime.now(timezone.utc).timestamp() + 14 * 60
        try:
            while datetime.now(timezone.utc).timestamp() < deadline:
                if run.cancelled:
                    raise SubmitError("cancelled")
                page.wait_for_timeout(3000)
                try:
                    if mod.is_logged_in(page):
                        Screenshots(paths.RUNS / "login", run).shot(page, run.args["site"])
                        return {"logged_in": True}
                except Exception:  # noqa: BLE001 - page navigating mid-check
                    pass
            raise SubmitError("timeout", "no login detected")
        finally:
            ctx.close()


async def run_login(run: Run) -> None:
    try:
        run.result = await asyncio.to_thread(_login_sync, run)
    except SubmitError as exc:
        run.fail(exc.code, exc.detail)
    except Exception as exc:  # noqa: BLE001
        run.fail("browser_error", repr(exc))


def status() -> dict:
    return {"profile_exists": paths.BROWSER_PROFILE.is_dir() and any(paths.BROWSER_PROFILE.iterdir()),
            "headed": _headed(), "sites": list(ADAPTERS)[:2]}
