"""Run queue: one worker, one run at a time, jsonl event log per run, SSE tail.

Why global concurrency 1: scrape and rank both rewrite seen_jobs.json; apply and
outcome both rewrite the tracker. ponytail: split into per-file locks if wall time
ever matters."""

import asyncio
import json
import secrets
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Awaitable, Callable

from . import paths

TIMEOUTS = {  # seconds
    "scrape": 15 * 60, "scrape-llm": 20 * 60, "rank": 30 * 60, "apply-docs": 45 * 60,
    "interview": 20 * 60, "outcome-run": 10 * 60, "submit": 10 * 60, "login": 15 * 60,
    "setup": 45 * 60, "roadmap": 20 * 60,
}
TERMINAL = {"succeeded", "failed", "cancelled"}
META_FIELDS = ("id", "kind", "args", "state", "created_at", "started_at", "finished_at",
               "exit_code", "error", "result", "session_id", "cost_usd", "num_turns")


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


@dataclass
class Run:
    id: str
    kind: str
    args: dict
    state: str = "queued"
    created_at: str = field(default_factory=now)
    started_at: str | None = None
    finished_at: str | None = None
    exit_code: int | None = None
    error: dict | None = None
    result: dict | None = None
    session_id: str | None = None
    cost_usd: float | None = None
    num_turns: int | None = None
    proc: Any = field(default=None, repr=False)
    cancel_event: asyncio.Event = field(default_factory=asyncio.Event, repr=False)

    @property
    def meta_path(self) -> Path:
        return paths.RUNS / f"{self.id}.json"

    @property
    def log_path(self) -> Path:
        return paths.RUNS / f"{self.id}.jsonl"

    def meta(self) -> dict:
        return {k: getattr(self, k) for k in META_FIELDS}

    def save(self) -> None:
        paths.RUNS.mkdir(parents=True, exist_ok=True)
        self.meta_path.write_text(json.dumps(self.meta(), indent=1), encoding="utf-8")

    def log(self, type: str, **payload) -> None:
        paths.RUNS.mkdir(parents=True, exist_ok=True)
        with self.log_path.open("a", encoding="utf-8") as fh:
            fh.write(json.dumps({"ts": now(), "type": type, **payload}, ensure_ascii=False) + "\n")

    def fail(self, code: str, message: str = "") -> None:
        self.state = "failed"
        self.error = {"code": code, "message": message[-2000:]}
        self.log("error", code=code, message=message[-2000:])

    @property
    def cancelled(self) -> bool:
        return self.cancel_event.is_set()


Handler = Callable[[Run], Awaitable[None]]
_HANDLERS: dict[str, Handler] = {}
_RUNS: dict[str, Run] = {}
_QUEUE: asyncio.Queue[Run] | None = None
_CURRENT: Run | None = None


def _load_meta(path: Path) -> dict | None:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None


def start(handlers: dict[str, Handler]) -> asyncio.Task:
    global _QUEUE
    _HANDLERS.update(handlers)
    _QUEUE = asyncio.Queue()
    paths.RUNS.mkdir(parents=True, exist_ok=True)
    for p in paths.RUNS.glob("*.json"):  # orphaned by a previous process
        m = _load_meta(p)
        if m and m.get("state") in ("running", "queued"):
            m.update(state="failed", finished_at=now(),
                     error={"code": "orphaned", "message": "api restarted while run was active"})
            p.write_text(json.dumps(m, indent=1), encoding="utf-8")
    return asyncio.create_task(_worker())


def create(kind: str, args: dict) -> Run:
    if kind not in _HANDLERS:
        raise ValueError(f"unknown run kind {kind}")
    run = Run(id=f"{datetime.now():%Y%m%d-%H%M%S}-{kind}-{secrets.token_hex(2)}", kind=kind, args=args)
    _RUNS[run.id] = run
    run.save()
    run.log("status", state="queued")
    _QUEUE.put_nowait(run)
    return run


def get(run_id: str) -> Run | dict | None:
    if run_id in _RUNS:
        return _RUNS[run_id]
    return _load_meta(paths.RUNS / f"{run_id}.json")


def meta_of(run: Run | dict) -> dict:
    return run.meta() if isinstance(run, Run) else run


def list_runs(kind: str | None = None, limit: int = 50) -> list[dict]:
    metas = []
    for p in paths.RUNS.glob("*.json"):
        m = _RUNS[p.stem].meta() if p.stem in _RUNS else _load_meta(p)
        if m and (not kind or m["kind"] == kind):
            metas.append(m)
    metas.sort(key=lambda m: m["created_at"], reverse=True)
    return metas[:limit]


def current() -> dict | None:
    return _CURRENT.meta() if _CURRENT else None


def queue_length() -> int:
    return _QUEUE.qsize() if _QUEUE else 0


def cancel(run_id: str) -> dict | None:
    run = _RUNS.get(run_id)
    if run is None:
        return None
    if run.state == "queued":
        run.state, run.finished_at = "cancelled", now()
        run.save()
        run.log("status", state="cancelled")
    elif run.state == "running":
        run.cancel_event.set()
        if run.proc and run.proc.returncode is None:
            asyncio.get_event_loop().create_task(_terminate(run.proc))
    return run.meta()


async def _terminate(proc) -> None:
    try:
        proc.terminate()
        await asyncio.wait_for(proc.wait(), 5)
    except (ProcessLookupError, asyncio.TimeoutError):
        try:
            proc.kill()
        except ProcessLookupError:
            pass


async def _worker() -> None:
    global _CURRENT
    while True:
        run = await _QUEUE.get()
        if run.state != "queued":
            continue
        _CURRENT = run
        run.state, run.started_at = "running", now()
        run.save()
        run.log("status", state="running")
        try:
            await asyncio.wait_for(_HANDLERS[run.kind](run), TIMEOUTS.get(run.kind, 900))
            if run.cancelled:
                run.state = "cancelled"
            elif run.state == "running":
                run.state = "succeeded"
        except asyncio.TimeoutError:
            if run.proc and run.proc.returncode is None:
                await _terminate(run.proc)
            run.fail("timeout", f"exceeded {TIMEOUTS.get(run.kind, 900)}s")
        except Exception as exc:  # noqa: BLE001 - a handler bug must not kill the worker
            run.fail("exception", repr(exc))
        finally:
            run.finished_at = now()
            run.save()
            run.log("status", state=run.state)
            _CURRENT = None


async def events(run_id: str, after: int = 0):
    """Async generator of (line_no, jsonl line). Ends when the run is terminal and drained."""
    path = paths.RUNS / f"{run_id}.jsonl"
    line_no = 0
    pos = 0  # byte offset: binary mode, since tell() is not allowed while iterating a text file

    def drain() -> list[tuple[int, str]]:
        nonlocal pos, line_no
        out = []
        if not path.is_file():
            return out
        with path.open("rb") as fh:
            fh.seek(pos)
            while True:
                raw = fh.readline()
                if not raw or not raw.endswith(b"\n"):
                    break  # EOF or partial write; re-read next tick
                pos += len(raw)
                line_no += 1
                if line_no > after:
                    out.append((line_no, raw.decode("utf-8", "replace").rstrip("\n")))
        return out

    while True:
        for item in drain():
            yield item
        m = meta_of(get(run_id) or {})
        if not m or m.get("state") in TERMINAL:
            for item in drain():  # lines written between the read and the state flip
                yield item
            return
        await asyncio.sleep(0.5)
