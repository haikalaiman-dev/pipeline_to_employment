"use client";

import useSWR from "swr";
import { Terminal } from "iconoir-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "./status-badge";
import { useOpenRun } from "./run-button";
import { duration, runLabel } from "@/lib/format";
import type { Overview } from "@/lib/types";

/** Fixed-bottom strip: visible everywhere while something runs or is queued. */
export function RunBanner() {
  const { data } = useSWR<Overview>("/api/overview", {
    refreshInterval: (d) => (d?.current_run || (d?.queue_length ?? 0) > 0 ? 2000 : 10_000),
  });
  const open = useOpenRun();
  const run = data?.current_run;
  if (!run && !(data?.queue_length ?? 0)) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 px-4 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 text-sm">
        <Terminal className="size-4 text-warning" aria-hidden />
        {run ? (
          <>
            <StatusBadge value={run.state} />
            <span className="font-medium">{run.kind}</span>
            <span className="text-muted-foreground">{runLabel(run.args)}</span>
            <span className="tabular-nums text-muted-foreground">{duration(run.started_at)}</span>
          </>
        ) : (
          <span className="text-muted-foreground">Starting next run…</span>
        )}
        {(data?.queue_length ?? 0) > 0 && <span className="text-muted-foreground">· {data!.queue_length} queued</span>}
        {run && (
          <Button size="sm" variant="outline" className="ml-auto" onClick={() => open(run.id)}>View log</Button>
        )}
      </div>
    </div>
  );
}
