"use client";

import Link from "next/link";
import { Suspense } from "react";
import useSWR from "swr";
import { PageHeader } from "@/components/page-header";
import { Roadmap } from "@/components/roadmap";
import { RunButton } from "@/components/run-button";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtTime } from "@/lib/format";
import type { Overview, Profile, Roadmap as RoadmapT } from "@/lib/types";

type RoadmapRes = ({ exists: true; errors: string[] } & RoadmapT) | { exists: false; error?: string };

function Inner() {
  const { data, isLoading } = useSWR<RoadmapRes>("/api/roadmap");
  const { data: profile } = useSWR<Profile>("/api/profile");
  const { data: ov } = useSWR<Overview>("/api/overview");
  const running = ov?.current_run?.kind === "roadmap";
  const last = ov?.last_runs.roadmap;
  const ready = data && data.exists;

  return (
    <>
      <PageHeader label="Roadmap" title="Where you are. What's next." description="Built from your profile, the gaps /rank recorded on ranked postings, and any upskill report."
        action={ready ? <RunButton url="/api/roadmap" variant="outline" icon={false} disabled={running}>Regenerate</RunButton> : undefined}>
        {ready && <p className="t-label">generated {fmtTime(data.generated_at)}</p>}
        {last && last.state !== "succeeded" && <p className="flex items-center gap-2 text-xs text-muted-foreground"><StatusBadge value={last.state} />{last.error?.code}</p>}
      </PageHeader>

      {isLoading && !data && <Skeleton className="h-64" />}

      {data && !data.exists && (
        <dl className="max-w-xl">
          {profile && !profile.exists ? (
            <div className="rule-row">
              <dt className="text-sm text-muted-foreground">No profile yet.</dt>
              <dd><Button size="sm" nativeButton={false} render={<Link href="/import" />}>Go to Import</Button></dd>
            </div>
          ) : (
            <div className="rule-row">
              <dt className="text-sm text-muted-foreground">No roadmap yet.{"error" in data && data.error ? ` ${data.error}` : ""}</dt>
              <dd><RunButton url="/api/roadmap" disabled={running}>{running ? "Generating…" : "Generate roadmap"}</RunButton></dd>
            </div>
          )}
        </dl>
      )}

      {ready && (
        <>
          {data.errors.length > 0 && (
            <p role="alert" className="mb-6 text-sm text-warning">roadmap.json has {data.errors.length} schema issue{data.errors.length === 1 ? "" : "s"}: {data.errors.slice(0, 3).join("; ")}</p>
          )}
          <dl className="t-label mb-10 flex flex-wrap gap-6">
            <div className="flex gap-1.5"><dt aria-hidden>●</dt><dd>now</dd></div>
            <div className="flex gap-1.5"><dt aria-hidden>○</dt><dd>past</dd></div>
            <div className="flex gap-1.5"><dt aria-hidden>│</dt><dd>branch</dd></div>
            <div className="flex gap-1.5"><dt aria-hidden>▮</dt><dd>readiness</dd></div>
          </dl>
          <Roadmap data={data} />
        </>
      )}
    </>
  );
}

export default function RoadmapPage() {
  return <Suspense><Inner /></Suspense>;
}
