"""Current standing: a tolerant, stdlib-only parse of upstream's profile files
(CLAUDE.md, 01-candidate-profile.md, search-queries.md). Also persists the /setup
gap answers and validates dashboard/roadmap.json. Read-only over upstream files."""

import json
import re
from datetime import date, datetime, timezone

from . import paths

PLACEHOLDER = re.compile(r"\[([A-Z][A-Z0-9_]{2,})(?:[^\]\n]*)\]")
COMMENT = re.compile(r"<!--.*?-->", re.S)
TABLE_ROW = re.compile(r"^\s*\|(.+)\|\s*$", re.M)
KV = r"^- \*\*{key}(?::\*\*|\*\*:)\s*(.+?)\s*$"
EXP = re.compile(r"^###\s+(?P<title>.+?)\s+[-–—]\s+(?P<company>.+?)\s*\((?P<start>[^()\-–—]+?)\s*[-–—]\s*(?P<end>[^()]+?)\)\s*$", re.M)
YEAR = re.compile(r"\b(?:19|20)\d{2}\b")
PRESENT = re.compile(r"present|current|now|ongoing|today", re.I)
QUOTED = re.compile(r'"([^"\n]+)"')
COMPLETENESS_KEYS = ("name", "location", "status", "headline", "languages", "education",
                     "latest_position", "skills_primary", "skills_domain", "target_roles")


def is_blank(v) -> bool:
    return v is None or not str(v).strip() or bool(PLACEHOLDER.search(str(v))) or str(v).strip() in ("-", "–", "N/A")


def clean(v):
    return None if is_blank(v) else str(v).strip().strip('"').strip()


def _read(path) -> str:
    try:
        return COMMENT.sub("", path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError):
        return ""


def section(text: str, heading: str) -> str:
    """Body under a `#..#### heading` up to the next heading of the same or higher level."""
    m = re.search(rf"^(#{{1,4}})\s+{re.escape(heading)}\s*$", text, re.M)
    if not m:
        return ""
    level = len(m.group(1))
    nxt = re.compile(rf"^#{{1,{level}}}\s+\S", re.M).search(text, m.end())
    return text[m.end(): nxt.start() if nxt else len(text)]


def kv(text: str, key: str):
    m = re.search(KV.format(key=re.escape(key)), text, re.M)
    return clean(m.group(1)) if m else None


def table_rows(body: str) -> list[list[str]]:
    rows = []
    for m in TABLE_ROW.finditer(body):
        cells = [c.strip() for c in m.group(1).split("|")]
        if not cells or re.fullmatch(r"[-:\s|]+", "".join(cells)) or all(not c for c in cells):
            continue
        rows.append(cells)
    return rows[1:] if rows else []  # drop header


def split_list(v) -> list[str]:
    return [s.strip() for s in re.split(r"\s*[,;]\s*", v or "") if s.strip() and not is_blank(s)]


def dedupe(items) -> list[str]:
    seen, out = set(), []
    for i in items:
        k = i.strip().lower()
        if k and k not in seen:
            seen.add(k)
            out.append(i.strip())
    return out


def parse_experience(text: str) -> list[dict]:
    out = []
    for m in EXP.finditer(section(text, "Professional Experience")):
        d = {k: clean(v) for k, v in m.groupdict().items()}
        if d["title"] and d["company"]:
            out.append(d)
    return out


def years_span(roles: list[dict]) -> int | None:
    starts = [int(y) for r in roles for y in YEAR.findall(r.get("start") or "")]
    ends = []
    for r in roles:
        e = r.get("end") or ""
        ends.append(date.today().year if PRESENT.search(e) else max((int(y) for y in YEAR.findall(e)), default=0))
    if not starts:
        return None
    return max(0, max(ends, default=date.today().year) - min(starts))


def target_roles_from_queries(text: str) -> list[str]:
    roles: list[str] = []
    for m in re.finditer(r"^###\s+Priority\s+[12]:\s*(.+?)\s*$", text, re.M):
        body = section(text, m.group(0).lstrip("# ").strip())
        roles += [q for q in QUOTED.findall(body) if "site:" not in q and not is_blank(q)]
        if not is_blank(m.group(1)):
            roles.append(m.group(1).strip())
    return dedupe(roles)


def read_answers() -> dict:
    try:
        return json.loads(paths.PROFILE_ANSWERS.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}


def write_answers(answers: dict) -> None:
    paths.PROFILE_ANSWERS.parent.mkdir(parents=True, exist_ok=True)
    paths.PROFILE_ANSWERS.write_text(json.dumps(answers, indent=1, ensure_ascii=False), encoding="utf-8")


def name_is_placeholder() -> bool:
    return kv(section(_read(paths.CLAUDE_MD), "Identity"), "Name") is None


def load() -> dict:
    claude = _read(paths.CLAUDE_MD)
    prof = _read(paths.PROFILE_MD)
    queries = _read(paths.SEARCH_QUERIES)
    answers = read_answers()

    ident_prof, ident_claude = section(prof, "Identity"), section(claude, "Identity")
    name = kv(ident_prof, "Name") or kv(ident_claude, "Name")
    location = kv(ident_prof, "Location") or kv(ident_claude, "Location")
    status = kv(ident_prof, "Status") or kv(ident_claude, "Status")
    headline = kv(ident_claude, "LinkedIn headline") or kv(claude, "LinkedIn headline")

    languages = [{"language": r[0], "level": r[1]} for r in table_rows(section(prof, "Languages") or section(ident_claude, "Languages"))
                 if len(r) >= 2 and not is_blank(r[0]) and not is_blank(r[1]) and r[0].lower() != "language"]
    education = []
    for r in table_rows(section(prof, "Education")):
        if len(r) < 3 or is_blank(r[0]):
            continue
        degree, _, field = r[0].partition(" in ")
        education.append({"degree": degree.strip(), "field": clean(field), "years": clean(r[1]),
                          "institution": clean(r[2]), "topics": clean(r[3]) if len(r) > 3 else None})
    roles = parse_experience(prof)
    tech = section(claude, "Technical Skills")
    skills = {k: split_list(kv(tech, label)) for k, label in
              (("primary", "Primary"), ("secondary", "Secondary"), ("domain", "Domain"), ("software", "Software"))}
    if not skills["primary"]:
        skills["primary"] = [clean(m) for m in re.findall(r"^- \*\*(.+?)\*\*", section(prof, "Programming & ML"), re.M) if clean(m)]
    if not skills["domain"]:
        skills["domain"] = [clean(m) for m in re.findall(r"^- (.+)$", section(prof, "Domain Expertise"), re.M) if clean(m)]

    target_roles = target_roles_from_queries(queries) or dedupe(answers.get("target_titles") or [])
    target_skills = dedupe(skills["primary"][:5] + list(answers.get("key_skills") or []))
    placeholders = sorted({m.group(1) for m in PLACEHOLDER.finditer(claude + "\n" + prof)})
    mtimes = [p.stat().st_mtime for p in (paths.CLAUDE_MD, paths.PROFILE_MD, paths.SEARCH_QUERIES) if p.is_file()]
    filled = {
        "name": bool(name), "location": bool(location), "status": bool(status), "headline": bool(headline),
        "languages": bool(languages), "education": bool(education), "latest_position": bool(roles),
        "skills_primary": bool(skills["primary"]), "skills_domain": bool(skills["domain"]), "target_roles": bool(target_roles),
    }
    return {
        "exists": bool(name) and not name_is_placeholder(),
        "generated_at": datetime.fromtimestamp(max(mtimes), timezone.utc).isoformat(timespec="seconds") if mtimes else None,
        "completeness": round(100 * sum(filled.values()) / len(COMPLETENESS_KEYS)),
        "placeholders": placeholders,
        "identity": {"name": name, "location": location, "headline": headline, "status": status},
        "latest_position": roles[0] if roles else None,
        "past": roles,
        "years_experience": years_span(roles),
        "skills": skills,
        "education": education,
        "languages": languages,
        "target_roles": target_roles,
        "target_skills": target_skills,
        "answers": answers,
    }


def hunt_queries() -> list[str]:
    p = load()
    a = p["answers"]
    titles = p["target_roles"] or list(a.get("target_titles") or [])
    skills = p["target_skills"] or list(a.get("key_skills") or [])
    return dedupe(titles + skills)[:12]  # ponytail: fan-out is queries x locations x portals


def summary() -> dict:
    p = load()
    return {"exists": p["exists"], "completeness": p["completeness"], "placeholders": len(p["placeholders"]),
            "name": p["identity"]["name"], "latest_position": p["latest_position"], "target_roles": p["target_roles"]}


# ---------- roadmap ----------

PRIORITIES = {"high", "medium", "low"}
QUARTER = re.compile(r"^\d{4}-Q[1-4]$")


def validate_roadmap(doc) -> list[str]:
    errs: list[str] = []
    if not isinstance(doc, dict):
        return ["top level must be an object"]

    def need(obj, key, typ, where):
        if key not in obj:
            errs.append(f"{where}.{key}: missing")
            return None
        if not isinstance(obj[key], typ):
            errs.append(f"{where}.{key}: expected {getattr(typ, '__name__', typ)}")
            return None
        return obj[key]

    need(doc, "generated_at", str, "roadmap")
    cur = need(doc, "current", dict, "roadmap")
    if cur is not None:
        for k, t in (("title", str), ("level", str), ("years", (int, float)), ("summary", str)):
            need(cur, k, t, "current")
    past = need(doc, "past", list, "roadmap") or []
    for i, p in enumerate(past):
        if not isinstance(p, dict):
            errs.append(f"past[{i}]: expected object")
            continue
        for k in ("title", "company", "start", "end"):
            need(p, k, str, f"past[{i}]")
        need(p, "skills", list, f"past[{i}]")
    nxt = need(doc, "next", list, "roadmap")
    if nxt is not None:
        if not 2 <= len(nxt) <= 3:
            errs.append(f"next: expected 2-3 items, got {len(nxt)}")
        for i, n in enumerate(nxt):
            if not isinstance(n, dict):
                errs.append(f"next[{i}]: expected object")
                continue
            for k in ("title", "level", "why"):
                need(n, k, str, f"next[{i}]")
            r = need(n, "readiness", int, f"next[{i}]")
            if r is not None and not 0 <= r <= 100:
                errs.append(f"next[{i}].readiness: expected int 0-100")
            for j, ms in enumerate(need(n, "missing_skills", list, f"next[{i}]") or []):
                if not isinstance(ms, dict) or not isinstance(ms.get("skill"), str) or ms.get("priority") not in PRIORITIES \
                        or not isinstance(ms.get("est_hours"), (int, float)):
                    errs.append(f"next[{i}].missing_skills[{j}]: need skill:str, priority:high|medium|low, est_hours:number")
    levers = need(doc, "levers", list, "roadmap")
    if levers is not None:
        if not 5 <= len(levers) <= 8:
            errs.append(f"levers: expected 5-8 items, got {len(levers)}")
        for i, lv in enumerate(levers):
            if not isinstance(lv, dict) or not isinstance(lv.get("skill"), str) or lv.get("priority") not in PRIORITIES \
                    or not isinstance(lv.get("why"), str) or not isinstance(lv.get("resources"), list):
                errs.append(f"levers[{i}]: need skill:str, priority:high|medium|low, why:str, resources:list")
                continue
            for j, res in enumerate(lv["resources"]):
                if not isinstance(res, dict) or not isinstance(res.get("label"), str) or not isinstance(res.get("url"), str):
                    errs.append(f"levers[{i}].resources[{j}]: need label:str, url:str")
    miles = need(doc, "milestones", list, "roadmap")
    if miles is not None:
        if not 4 <= len(miles) <= 6:
            errs.append(f"milestones: expected 4-6 items, got {len(miles)}")
        for i, m in enumerate(miles):
            if not isinstance(m, dict) or not isinstance(m.get("label"), str) or not QUARTER.match(str(m.get("target_quarter", ""))):
                errs.append(f"milestones[{i}]: need label:str, target_quarter:YYYY-Qn")
    return errs


def read_roadmap() -> dict:
    if not paths.ROADMAP.is_file():
        return {"exists": False}
    try:
        doc = json.loads(paths.ROADMAP.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        return {"exists": False, "error": f"roadmap.json unreadable: {exc}"}
    if not isinstance(doc, dict):
        return {"exists": False, "error": "roadmap.json is not an object"}
    return {"exists": True, "errors": validate_roadmap(doc), **doc}
