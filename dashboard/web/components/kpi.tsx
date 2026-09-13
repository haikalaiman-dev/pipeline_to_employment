import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** A stat in a definition list: no card, hierarchy by type scale. */
export function Kpi({ label, value, sub, tone, loading }: {
  label: string; value: number | string | null | undefined; sub?: string;
  tone?: "success" | "danger" | "warning"; loading?: boolean;
}) {
  return (
    <div>
      <dt className="t-label">{label}</dt>
      {loading ? (
        <dd className="mt-1"><Skeleton className="h-8 w-14" /></dd>
      ) : (
        <dd className={cn("mt-1 text-3xl tabular-nums tracking-tight",
          tone === "success" && "text-success", tone === "danger" && "text-destructive", tone === "warning" && "text-warning")}>
          {value ?? "–"}
        </dd>
      )}
      {sub && <dd className="text-xs text-muted-foreground">{sub}</dd>}
    </div>
  );
}

export function KpiGrid({ children }: { children: React.ReactNode }) {
  return <dl className="mb-10 grid grid-cols-2 gap-x-8 gap-y-6 border-t pt-6 sm:grid-cols-3 lg:grid-cols-6">{children}</dl>;
}
