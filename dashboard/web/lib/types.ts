// Hand-written mirror of dashboard/api/main.py response shapes.
// Regenerate with `npm run gen:api` (openapi-typescript) once the API stabilises, if wanted.

export type RunState = "queued" | "running" | "succeeded" | "failed" | "cancelled";
export type RunKind =
  | "scrape" | "scrape-llm" | "rank" | "apply-docs" | "interview" | "outcome-run" | "submit" | "login"
  | "setup" | "roadmap";

export type Folder = "cv" | "linkedin" | "diplomas" | "references" | "applications" | "postings";
export interface DocumentFile { name: string; path: string; size: number; modified: string }
export interface Documents {
  folders: Record<Exclude<Folder, "applications">, DocumentFile[]> & { applications: { name: string; files: DocumentFile[] }[] };
  total: number;
  newest: string | null;
}

/** Form state (strings, one item per line for lists); toPayload() converts to the API shape. */
export interface SetupAnswers {
  career_goals: string; excites: string; deal_breakers: string; languages: string;
  location: string; target_titles: string; key_skills: string; geography: string;
}

export interface Profile {
  exists: boolean;
  generated_at: string | null;
  completeness: number;
  placeholders: string[];
  identity: { name: string | null; location: string | null; headline: string | null; status: string | null };
  latest_position: { title: string; company: string; start: string | null; end: string | null } | null;
  past: { title: string; company: string; start: string | null; end: string | null }[];
  years_experience: number | null;
  skills: { primary: string[]; secondary: string[]; domain: string[]; software: string[] };
  education: { degree: string; field: string | null; years: string | null; institution: string | null }[];
  languages: { language: string; level: string }[];
  target_roles: string[];
  target_skills: string[];
  answers: {
    career_goals?: string | null; excites?: string | null; deal_breakers?: string | null;
    languages?: { language: string; level: string }[]; location?: string | null;
    target_titles?: string[]; key_skills?: string[]; geography?: string | null;
  };
}

export type Priority = "high" | "medium" | "low";
export interface Roadmap {
  generated_at: string;
  current: { title: string; level: string; years: number; summary: string };
  past: { title: string; company: string; start: string; end: string; skills: string[] }[];
  next: { title: string; level: string; why: string; readiness: number; missing_skills: { skill: string; priority: Priority; est_hours: number }[] }[];
  levers: { skill: string; priority: Priority; why: string; resources: { label: string; url: string }[] }[];
  milestones: { label: string; target_quarter: string }[];
}

export interface RunMeta {
  id: string;
  kind: RunKind;
  args: Record<string, unknown>;
  state: RunState;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  exit_code: number | null;
  error: { code: string; message: string } | null;
  result: Record<string, unknown> | null;
  session_id: string | null;
  cost_usd: number | null;
  num_turns: number | null;
}

export interface RunEvent {
  ts: string;
  type: "status" | "stdout" | "stderr" | "claude" | "summary" | "screenshot" | "error";
  [k: string]: unknown;
}

export type JobStatus = "new" | "ranked" | "skipped" | "expired";
export type TrackerStatus =
  | "drafted" | "applied" | "interview" | "offer" | "hired"
  | "rejected" | "no_response" | "offer_declined" | "withdrawn";
export const TRACKER_STATUSES: TrackerStatus[] = [
  "drafted", "applied", "interview", "offer", "hired", "rejected", "no_response", "offer_declined", "withdrawn",
];
export const FINAL_STATUSES: TrackerStatus[] = ["hired", "rejected", "no_response", "offer_declined", "withdrawn"];
export const BANDS = ["Strong Fit", "Good Fit", "Moderate Fit", "Weak Fit", "Poor Fit"] as const;
export type Band = (typeof BANDS)[number];

export interface Job {
  key: string;
  title: string | null;
  company: string | null;
  url: string | null;
  location: string | null;
  portal: string | null;
  region: string | null;
  source: string | null;
  first_seen: string | null;
  posted_date: string | null;
  deadline: string | null;
  closing_soon: boolean;
  fit: string | null;
  status: JobStatus;
  rank_score: number | null;
  rank_verdict: Band | null;
  rank_date: string | null;
  location_verdict: "PASS" | "FAIL" | "FLAG" | null;
  language_gate: "PASS" | "FAIL" | "FLAG" | null;
  language_note: string | null;
  strengths: string[];
  gaps: string[];
  tracker_status: TrackerStatus | null;
  application_slug: string | null;
}

export interface JobDetail extends Job {
  tracker_rows: Application[];
}

export interface Archive {
  exists: boolean;
  job_posting: string | null;
  cv_draft: string | null;
  cover_letter: string | null;
  outcome: string | null;
  preps: string[];
  submit_runs: { run_id: string; screenshots: string[] }[];
}

export interface Application {
  row_index: number;
  slug: string;
  final: boolean;
  date: string;
  company: string;
  sector: string;
  role: string;
  role_type: string;
  channel: string;
  status: TrackerStatus;
  contact_person: string;
  fit_rating: string;
  notes: string;
  cv_file: string;
  cover_letter_file: string;
  source: string;
  deadline: string;
  cv_pdf: string | null;
  cover_pdf: string | null;
  archive: Archive;
  outcome_md?: string | null;
  rows?: number[];
}

export interface Portal {
  skill: string;
  locations?: string[];
  flags: Record<string, string | number | boolean>;
  installed?: boolean;
  enabled?: boolean;
}

export interface Region {
  id: string;
  label: string;
  queries: string[];
  portals: Portal[];
}

export interface Overview {
  seen: Record<JobStatus | "total", number>;
  ranked_bands: Record<Band, number>;
  by_region: Record<string, number>;
  by_portal: Record<string, number>;
  tracker: Record<TrackerStatus, number>;
  tracker_total: number;
  last_runs: Partial<Record<RunKind, RunMeta>>;
  current_run: RunMeta | null;
  queue_length: number;
  documents_total: number;
  profile_exists: boolean;
  roadmap_exists: boolean;
}

export interface Health {
  ok: boolean;
  bun: string | null;
  claude: string | null;
  lualatex: string | null;
  xelatex: string | null;
  pdftotext: string | null;
  playwright: string | null;
  repo: string;
  seen_exists: boolean;
  tracker_exists: boolean;
  regions: string[];
}

export interface Accepted {
  run_id: string;
  state: RunState;
  position: number;
}
