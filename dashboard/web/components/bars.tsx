import { Skeleton } from "@/components/ui/skeleton";
import { barColor, label as fmtLabel, tone as toneOf, type Tone } from "@/lib/status";
import { cn } from "@/lib/utils";

export interface BarRow { label: string; value: number; tone?: Tone; href?: string }

/** Labelled horizontal bars in a real table (a11y), no card — covers funnel, bands, tracker, per-portal counts. */
export function Bars({ title, rows, loading, className }: {
  title?: string; rows: BarRow[]; loading?: boolean; className?: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <section className={cn("min-w-0", className)}>
      {title && <h2 className="t-label mb-3">{title}</h2>}
      {loading ? (
        <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-5 w-full" />)}</div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No data yet.</p>
      ) : (
        <table className="w-full text-sm">
          <caption className="sr-only">{title ?? "Counts"}</caption>
          <tbody>
            {rows.map((r) => {
              const t = r.tone ?? toneOf[r.label] ?? "neutral";
              return (
                <tr key={r.label} className="align-middle">
                  <th scope="row" className="w-32 py-1.5 pr-3 text-left font-normal text-muted-foreground">
                    {r.href ? <a className="underline-offset-4 hover:underline" href={r.href}>{fmtLabel(r.label)}</a> : fmtLabel(r.label)}
                  </th>
                  <td className="py-1.5">
                    <div className="h-1.5 w-full rounded-sm bg-muted">
                      <div className={cn("h-1.5 rounded-sm", barColor[t])} style={{ width: `${(r.value / max) * 100}%` }} />
                    </div>
                  </td>
                  <td className="w-10 py-1.5 pl-3 text-right tabular-nums">{r.value}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}
