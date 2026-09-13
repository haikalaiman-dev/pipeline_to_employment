"""Region registry (dashboard/regions.yaml) and portal-CLI command builder."""

import re
import yaml

from . import paths

SEARCH_TS = ".agents/skills/{skill}/cli/src/cli.ts"


def _validate(region: dict) -> dict:
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]*", str(region.get("id", ""))):
        raise ValueError("region id must be lowercase letters, digits, dashes")
    portals = region.get("portals") or []
    if not portals:
        raise ValueError(f"region {region['id']}: at least one portal required")
    for p in portals:
        if not p.get("skill"):
            raise ValueError(f"region {region['id']}: portal without skill")
        p.setdefault("flags", {})
    region.setdefault("label", region["id"])
    region.setdefault("queries", [])
    return region


def load() -> list[dict]:
    if not paths.REGIONS.is_file():
        return []
    doc = yaml.safe_load(paths.REGIONS.read_text(encoding="utf-8")) or {}
    return [_validate(r) for r in doc.get("regions", [])]


def save(regions: list[dict]) -> None:
    paths.REGIONS.write_text(
        yaml.safe_dump({"regions": [_validate(r) for r in regions]}, sort_keys=False, allow_unicode=True),
        encoding="utf-8",
    )


def get(region_id: str) -> dict | None:
    return next((r for r in load() if r["id"] == region_id), None)


def upsert(region: dict) -> dict:
    region = _validate(region)
    regions = [r for r in load() if r["id"] != region["id"]] + [region]
    save(regions)
    return region


def frontmatter(path) -> dict:
    text = path.read_text(encoding="utf-8") if path.is_file() else ""
    m = re.match(r"^---\n(.*?)\n---", text, re.DOTALL)
    return (yaml.safe_load(m.group(1)) or {}) if m else {}


def portal_installed(skill: str) -> bool:
    return (paths.REPO / SEARCH_TS.format(skill=skill)).is_file()


def portal_enabled(skill: str) -> bool:
    """/scrape Step 1b: enabled unless SKILL.md frontmatter says `enabled: false`."""
    return frontmatter(paths.SKILLS / skill / "SKILL.md").get("enabled", True) is not False


def with_portal_status(region: dict) -> dict:
    return {**region, "portals": [
        {**p, "installed": portal_installed(p["skill"]), "enabled": portal_enabled(p["skill"])}
        for p in region["portals"]]}


def build_commands(region: dict, queries: list[str] | None = None,
                   portals: list[str] | None = None) -> list[dict]:
    """One CLI call per (portal, query, location). Flags: {k: v} -> --k v; True -> --k."""
    queries = queries or region.get("queries") or []
    out = []
    for p in region["portals"]:
        if portals and p["skill"] not in portals:
            continue
        base = ["bun", "run", SEARCH_TS.format(skill=p["skill"]), "search"]
        flags = []
        for k, v in (p.get("flags") or {}).items():
            if v is True:
                flags.append(f"--{k}")
            elif v not in (None, False, ""):
                flags += [f"--{k}", str(v)]
        for q in queries:
            for loc in p.get("locations") or [None]:
                argv = base + ["-q", q] + (["--location", loc] if loc else []) + flags + ["--format", "json"]
                out.append({"skill": p["skill"], "query": q, "location": loc, "argv": argv})
    return out
