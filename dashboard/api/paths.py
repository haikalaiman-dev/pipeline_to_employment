"""Repo-root paths. The repo root IS the state store (upstream's files)."""

import os
import sys
from pathlib import Path

REPO = Path(os.environ.get("DASHBOARD_REPO", Path(__file__).resolve().parents[2]))

SEEN = REPO / "job_scraper" / "seen_jobs.json"
TRACKER = REPO / "job_search_tracker.csv"
APPS = REPO / "documents" / "applications"
CV = REPO / "cv"
COVER = REPO / "cover_letters"
SKILLS = REPO / ".agents" / "skills"

DOCS = REPO / "documents"
SKILL_DIR = REPO / ".claude" / "skills" / "job-application-assistant"
PROFILE_MD = SKILL_DIR / "01-candidate-profile.md"
JOB_EVAL_MD = SKILL_DIR / "04-job-evaluation.md"
CLAUDE_MD = REPO / "CLAUDE.md"
SEARCH_QUERIES = REPO / ".claude" / "skills" / "job-scraper" / "search-queries.md"
UPSKILL_DIR = REPO / "upskill"

DASH = REPO / "dashboard"
RUNS = DASH / "runs"
REGIONS = DASH / "regions.yaml"
ANSWERS = DASH / "apply-answers.yaml"
BROWSER_PROFILE = DASH / "browser-profile"
ROADMAP = DASH / "roadmap.json"
PROFILE_ANSWERS = DASH / "profile-answers.json"

# upstream's python helpers (tools/job_key.py, tools/rank_state.py)
sys.path.insert(0, str(REPO / "tools"))
