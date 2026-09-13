export const fmtDate = (iso: string | null | undefined) => (iso ? iso.slice(0, 10) : "–");

export function fmtTime(iso: string | null | undefined) {
  if (!iso) return "–";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
}

export function duration(start: string | null | undefined, end?: string | null) {
  if (!start) return "–";
  const ms = (end ? new Date(end).getTime() : Date.now()) - new Date(start).getTime();
  if (!isFinite(ms) || ms < 0) return "–";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return m < 60 ? `${m}m ${s % 60}s` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

export const fmtUsd = (n: number | null | undefined) => (n == null ? "–" : `$${n.toFixed(2)}`);

export function fmtBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function runLabel(args: Record<string, unknown>) {
  const a = args as Record<string, string | undefined>;
  return a.region ?? a.slug ?? a.company ?? a.url ?? a.site ?? a.focus ?? "";
}
