# Dashboard

The web layer of [auto_jobs_pipeline](../README.md), built on the [ai-job-search](https://github.com/MadsLorentzen/ai-job-search) framework by Mads Lorentzen. Two containers:

| Service | Stack | Port | Role |
|---|---|---|---|
| `web` | Next.js 16, Tailwind 4, shadcn/ui (Base UI), Iconoir, SWR | 3000 | UI. Proxies `/api/*` to the API, so the browser only ever talks to one origin. |
| `api` | FastAPI, Bun (portal CLIs), Claude Code CLI, TeX Live, Playwright + Chromium | 8000 | Reads and writes upstream's state files, runs the portal scrapers, launches headless Claude runs, drives the browser for auto-submit. |

There is no database. The repository root is bind-mounted at `/work` in the API container and **is** the state store, exactly as upstream designed it:

| File | Written by | Read by |
|---|---|---|
| `job_scraper/seen_jobs.json` | Hunt (direct scrape), `/rank` | Jobs, Recommend, Roadmap |
| `job_search_tracker.csv` | `/apply`, `/outcome`, Outcome page, auto-submit | Tailor, Apply, Interview, Outcome |
| `documents/<folder>/` | Import uploads | `/setup`, `/expand` |
| `documents/applications/<company>_<role>/` | `/apply`, `/outcome`, `/interview`, auto-submit screenshots | Application pages |
| `cv/main_*.tex|pdf`, `cover_letters/cover_*.tex|pdf` | `/apply` | Tailor, Apply, PDF viewer |
| `CLAUDE.md`, `.claude/skills/job-application-assistant/*.md`, `.claude/skills/job-scraper/search-queries.md` | `/setup` (Import analysis) | every Claude run; Import standing |
| `dashboard/regions.yaml` | Hunt region editor, "Tailor hunt to my profile" | Hunt |
| `dashboard/profile-answers.json` | Import answers form | Import prefill, queries-from-profile |
| `dashboard/roadmap.json` | Roadmap run | Roadmap page |
| `dashboard/runs/<id>.json` + `.jsonl` | run queue | Runs, live log drawer |
| `dashboard/browser-profile/` | portal login | auto-submit |

Everything in the last five rows plus `documents/`, the tracker, the scraped jobs and all PDFs is gitignored.

## Run

```bash
cp .env.example .env            # set CLAUDE_CODE_OAUTH_TOKEN (from `claude setup-token`) or ANTHROPIC_API_KEY, and UID
docker compose up -d --build    # api image is ~6 GB: TeX Live, Chromium, Node, Bun, Python
open http://localhost:3000
```

`docker compose logs -f api` shows request logs and any Python traceback. The API hot-reloads on changes under `dashboard/api`; the web dev server hot-reloads too (file watching over a WSL bind mount uses polling, already configured).

### Permissions

Headless Claude runs with `--permission-mode bypassPermissions`, which is the documented mode for unattended runs inside a container and needs a non-root user (the image runs as `app`). The API also pre-trusts the `/work` project in the container's `~/.claude.json`, otherwise Claude ignores the project's `.claude/settings.json` allowlist.

If your organisation's policy disables bypass, set in `.env`:

```
CLAUDE_PERMISSION_MODE=acceptEdits
CLAUDE_EXTRA_ARGS=--allowedTools WebFetch WebSearch Agent "Bash(lualatex *)" "Bash(xelatex *)" "Bash(cd cv && lualatex *)" "Bash(cd ../cover_letters && xelatex *)" "Bash(python3 tools/*)" "Bash(rm *)"
```

Runs then record any `permission_denials` in their log so you can widen the list.

## Pages

| Route | Purpose |
|---|---|
| `/` | Pipeline home: seven stage nodes with live counts, one primary action, current or last run. |
| `/import` | Upload documents per folder, answer the `/setup` gap questions, **Analyse** (headless `/setup`, Path A), view **Current standing**, **Tailor hunt to my profile**. |
| `/hunt`, `/hunt/[region]`, `/hunt/new` | Regions with scrape buttons; edit portals, locations, flags and queries; scrape a subset of portals or with override queries; optional LLM `/scrape`. |
| `/jobs`, `/jobs/[key]` | Every seen posting with filters; detail with score, gates, strengths, gaps, tracker rows, **Generate CV + cover letter**. |
| `/recommend` | Rank options and the ranked table by fit band. |
| `/tailor` | Drafted applications and PDF readiness; generate docs from a raw URL. |
| `/apply` | Ready-to-submit applications, dry-run switch, adapter choice, recent submits with screenshots. |
| `/interview` | Applications in interview and their prep packs. |
| `/outcomes` | Tracker status funnel and inline status updates. |
| `/applications/[slug]` | Documents (two PDF viewers), Submit, Interview (build and read prep packs), Outcome (status, `/outcome` run, `outcome.md`). |
| `/roadmap` | Career roadmap: past → now → next roles with readiness, level-up levers, milestones. **Generate / Regenerate**. |
| `/system` | Runs with live log, Health (tools, env and file hints), Regions, Browser login. `/runs` and `/settings` redirect here. |

## Runs

Every long action is a *run*: queued → running → succeeded / failed / cancelled, one at a time (scrape and rank both rewrite `seen_jobs.json`; apply and outcome both rewrite the tracker). Each run keeps a JSON meta file and a JSONL event log under `dashboard/runs/`, streamed to the UI over Server-Sent Events. Success is decided by **file checks**, not exit codes: rank must have scored entries today, apply-docs must have produced both PDFs and a `drafted` tracker row, roadmap must have written valid JSON.

| Kind | Mechanism | Budget cap | Timeout |
|---|---|---|---|
| `scrape` | Bun portal CLIs, one call per query × location × portal, merged with upstream's dedup key | none (no LLM) | 15 min |
| `scrape-llm` | `claude -p "/scrape"` | $4 | 20 min |
| `setup` | `claude -p "/setup"` with your answers pre-supplied, Path A, conflicts kept | $15 | 45 min |
| `rank` | `claude -p "/rank --limit N"` | $3 | 30 min |
| `apply-docs` | `claude -p "/apply <url>"` | $10 | 45 min |
| `interview` | `claude -p "/interview <company> <role>"` with stage details | $4 | 20 min |
| `outcome-run` | `claude -p "/outcome <company>"` with recorded facts | $2 | 10 min |
| `roadmap` | plain prompt that reads the profile, ranked gaps and upskill report, writes `roadmap.json` | $5 | 20 min |
| `submit` | Playwright adapter (`linkedin`, `jobstreet`, `generic`) | none | 10 min |
| `login` | headed Chromium with the persistent profile | none | 15 min |

Failure codes you will see: `auth` (no token or expired token), `no_artifacts` (Claude finished but the promised files are missing), `timeout`, `error_max_budget_usd`, `permission_denials` logged inside the run, and for submits `not_logged_in`, `external_apply`, `already_applied`, `job_closed`, `unanswered_question`, `captcha`, `selector_not_found`, `submit_unconfirmed`.

## API

All JSON, errors as `{"error": code, "detail": text}`. Long actions return `202 {run_id}`.

| Method | Path | Notes |
|---|---|---|
| GET | `/health`, `/overview` | tools present; counts per stage, last runs, current run |
| GET/PUT/DELETE | `/regions`, `/regions/{id}` | region registry |
| POST | `/regions/{id}/queries-from-profile` | replace queries with profile titles + skills (409 without a profile) |
| POST | `/scrape`, `/scrape/llm` | `{region, queries?, portals?}` / `{focus?}` |
| GET/PATCH | `/jobs`, `/jobs/{key}` | filters `status, region, portal, min_score, q, sort, limit, offset`; PATCH `{status: skipped|new}` |
| POST | `/rank`, `/jobs/{key}/apply-docs`, `/apply-docs` | `{all?, focus?, limit?}` / none / `{url}` |
| GET/PATCH | `/applications`, `/applications/{slug}`, `/applications/{slug}/status` | tracker rows joined with archives; PATCH `{status, note?, date?, row?}` |
| POST | `/applications/{slug}/interview`, `/outcome-run`, `/submit` | `{stage, date?, format?, interviewers?}` / `{status, stages?, feedback?}` / `{dry_run, adapter?, row?}` |
| GET | `/applications/{slug}/prep/{stage}` | prep pack markdown |
| GET/POST/DELETE | `/documents`, `/documents/{folder}`, `/documents/applications/{sub}`, `.../{name}` | multipart `files`; 25 MB; PDF/TeX/TXT/MD per folder |
| GET | `/profile` | parsed standing: identity, latest position, years, skills, education, languages, target roles, completeness, placeholders, saved answers |
| POST | `/setup`, `/setup/search` | answers JSON → setup run |
| GET/POST | `/roadmap` | roadmap JSON (schema-validated) / generate |
| POST/GET | `/browser/login`, `/browser/status` | `{site: linkedin|jobstreet}` |
| GET | `/files/{path}` | PDFs, screenshots, `.tex`, `.md` under `cv/`, `cover_letters/`, `documents/` |
| GET/POST | `/runs`, `/runs/{id}`, `/runs/{id}/events` (SSE), `/runs/{id}/cancel` | run history and live log |

## Configure

| What | Where |
|---|---|
| Regions, portals, locations, flags, default queries | `regions.yaml` (or Hunt → region → Edit). Flags are the portal CLI's own flags; `true` becomes a bare flag. |
| Which portals exist / are enabled | `.agents/skills/<portal>-search/SKILL.md` (`enabled: false`); add boards with upstream's `/add-portal` |
| Profile, rubric, templates | upstream files, written by Import / `/setup` |
| Form answers for Easy Apply / JobStreet | `apply-answers.yaml`: `lowercase question label: answer` (gitignored) |
| Headed browser | `HEADED=1` in `.env`; on WSL2 the window appears through WSLg |

## Smoke test

1. System → Health: bun, claude, lualatex, xelatex, pdftotext, playwright present.
2. Hunt → Remote → Edit → add a query or two (or run **Tailor hunt to my profile** on Import) → Scrape. Jobs fills; a second scrape reports `0 new`.
3. Import → upload a PDF → it appears with size and date → delete it with the confirmation dialog.
4. Import → fill answers → Analyse. Without a token the run fails with `auth` and your answers are still saved.
5. Recommend → Rank (needs a token and a real profile). Entries gain scores.
6. Job → Generate CV + cover letter → PDFs render on the application page.
7. System → Browser → Log in to LinkedIn once. Apply → Dry run → screenshots under the application's Submit tab; tracker unchanged.
8. Outcome → set `applied` with a note → row flips, date stamps, home counts move.
9. Roadmap → Generate → track, next roles, levers and milestones render.

Tests: `python3 -m unittest discover -s dashboard/api/tests -t .` from the repo root (35 tests). Upstream stays green: `python3 -m unittest discover -s tests -t .`, `python3 tools/lint_skills.py`, `python3 tools/security_guards.py`. Frontend: `cd dashboard/web && npx tsc --noEmit && npx eslint .`.

## Troubleshooting

- **Runs fail with `auth`.** `.env` has no token, or the `claude setup-token` token expired (they last about a year). Regenerate, `docker compose restart api`.
- **`/apply` run says `no_artifacts`.** Claude finished without both PDFs. Open the run log: usually a LaTeX compile error or a permission denial. Check the Permissions section.
- **Nothing renders in a headless test against `http://web:3000`.** Next's dev server only serves assets to hosts listed in `allowedDevOrigins` (`web`, `localhost`, `127.0.0.1` are set).
- **Login window never appears.** On WSL2 confirm `/mnt/wslg` exists on the host; on other platforms set `DISPLAY` for the `api` service or run with `HEADED=0` and use a portal that keeps you logged in through the persistent profile.
- **Image too big.** Drop `texlive-fonts-extra` from `docker/api.Dockerfile` (saves ~1.2 GB; then install `fontawesome5` manually) or switch templates to Typst with upstream's `/add-template`.
- **Claude Code flags.** `--max-turns` does not exist in Claude Code 2.1.x; runs are bounded by `--max-budget-usd` and wall-clock timeouts instead.

## Notes

- Automated scraping and applying breach LinkedIn's and SEEK/JobStreet's terms; volume is kept low (sequential calls, 2 s pauses, `limit 10`), but account restriction is a real outcome.
- Portal DOMs drift. Every selector lives in one constants block per adapter (`api/submit/linkedin.py`, `api/submit/jobstreet.py`) and every failure ships a screenshot.
- Do not bind-mount your host `~/.claude` into the container: host hooks and plugins would run inside every headless turn. A named volume keeps the container's own Claude state.
- The API serves personal files under `/files` and `/documents`; keep both ports on localhost.
