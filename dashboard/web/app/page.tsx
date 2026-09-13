"use client";

import Link from "next/link";
import { Suspense } from "react";
import useSWR from "swr";
import { NavArrowRight } from "iconoir-react";
import { Pipeline } from "@/components/pipeline";
import { RunButton, useOpenRun } from "@/components/run-button";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { duration, fmtTime, runLabel } from "@/lib/format";
import type { Overview, Region } from "@/lib/types";

function Inner() {
  const { data: ov } = useSWR<Overview>("/api/overview");
  const { data: regions } = useSWR<{ regions: Region[] }>("/api/regions");
  const open = useOpenRun();
  const first = regions?.regions[0];
  const run = ov?.current_run;
  const last = ov ? Object.values(ov.last_runs).filter(Boolean).sort((a, b) => (b!.finished_at ?? b!.created_at).localeCompare(a!.finished_at ?? a!.created_at))[0] : undefined;

  let cta: React.ReactNode = null;
  if (ov) {
    if (!ov.documents_total && !ov.profile_exists) {
      cta = <Button nativeButton={false} render={<Link href="/import" />}>Start with Import <NavArrowRight className="size-4" aria-hidden /></Button>;
    } else if (ov.seen.new > 0) {
      cta = <RunButton url="/api/rank" body={{ limit: 10 }} size="default">Rank {ov.seen.new} new</RunButton>;
    } else if (first) {
      cta = <RunButton url="/api/scrape" body={{ region: first.id }} size="default">Scrape {first.label}</RunButton>;
    }
  }

  return (
    <div className="space-y-16">
      <header className="grid gap-6 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <p className="t-label mb-3">Pipeline</p>
          <h1 className="t-display">Your pipeline.</h1>
        </div>
        <div className="md:justify-self-end">{cta}</div>
      </header>

      <Pipeline overview={ov} />

      <div className="rule pt-4">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          {run ? (
            <>
              <StatusBadge value={run.state} />
              <span className="font-medium">{run.kind}</span>
              <span className="text-muted-foreground">{runLabel(run.args)}</span>
              <span className="tabular-nums text-muted-foreground">{duration(run.started_at)}</span>
              <Button size="sm" variant="ghost" onClick={() => open(run.id)}>View log</Button>
            </>
          ) : last ? (
            <>
              <span className="t-label">last run</span>
              <StatusBadge value={last.state} />
              <button className="font-medium underline-offset-4 hover:underline" onClick={() => open(last.id)}>{last.kind}</button>
              <span className="text-muted-foreground">{runLabel(last.args)}</span>
              <span className="text-xs text-muted-foreground">{fmtTime(last.finished_at ?? last.created_at)}</span>
            </>
          ) : (
            <span className="text-muted-foreground">Nothing has run yet.</span>
          )}
          <Link href="/roadmap" className="ml-auto inline-flex items-center gap-1 text-sm underline-offset-4 hover:underline">
            Career roadmap <NavArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return <Suspense><Inner /></Suspense>;
}
