// Single source of truth: vocabulary -> visual tone. Badges always show the text too.
export type Tone = "neutral" | "success" | "danger" | "warning" | "muted";

export const tone: Record<string, Tone> = {
  // seen_jobs status
  new: "neutral", ranked: "success", skipped: "muted", expired: "muted",
  // tracker status
  drafted: "neutral", applied: "success", interview: "success", offer: "success", hired: "success",
  rejected: "danger", no_response: "muted", offer_declined: "muted", withdrawn: "muted",
  // run state
  queued: "neutral", running: "warning", succeeded: "success", failed: "danger", cancelled: "muted",
  // rank bands
  "Strong Fit": "success", "Good Fit": "success", "Moderate Fit": "warning", "Weak Fit": "muted", "Poor Fit": "danger",
  // gates
  PASS: "success", FLAG: "warning", FAIL: "danger",
};

export const toneClass: Record<Tone, string> = {
  neutral: "border-border bg-secondary text-secondary-foreground",
  success: "border-transparent bg-raw-mint text-[#0a0a0a] dark:bg-success/15 dark:text-success dark:border-success/30",
  danger: "border-transparent bg-raw-red text-[#0a0a0a] dark:bg-destructive/15 dark:text-destructive dark:border-destructive/30",
  warning: "border-transparent bg-warning/15 text-warning dark:bg-warning/15 dark:text-warning",
  muted: "border-border bg-transparent text-muted-foreground",
};

export const barColor: Record<Tone, string> = {
  neutral: "bg-foreground/60",
  success: "bg-success",
  danger: "bg-destructive",
  warning: "bg-warning",
  muted: "bg-muted-foreground/50",
};

export const label = (s: string) => s.replace(/_/g, " ");
