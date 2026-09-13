"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import useSWR from "swr";
import { OpenNewWindow } from "iconoir-react";
import { PageHeader } from "@/components/page-header";
import { ScoreBar } from "@/components/score-bar";
import { StatusBadge } from "@/components/status-badge";
import { RunButton } from "@/components/run-button";
import { ApplicationsTable } from "@/components/applications-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { patch } from "@/lib/api";
import { fmtDate } from "@/lib/format";
import type { JobDetail } from "@/lib/types";

export default function JobPage() {
  const { key } = useParams<{ key: string }>();
  const { data: j, error, isLoading, mutate } = useSWR<JobDetail>(`/api/jobs/${key}`);
  if (error) return <p role="alert" className="text-sm text-destructive">Job not found.</p>;
  if (isLoading || !j) return <Skeleton className="h-64" />;
  const skippable = j.status === "new" || j.status === "skipped";
  return (
    <>
      <PageHeader title={j.title ?? "(untitled)"} description={[j.company, j.location].filter(Boolean).join(" · ")}>
        {j.url && <Button variant="outline" size="sm" nativeButton={false} render={<a href={j.url} target="_blank" rel="noreferrer" />}><OpenNewWindow className="size-4" aria-hidden />Open posting</Button>}
        {skippable && (
          <Button variant="ghost" size="sm" onClick={async () => { await patch(`/api/jobs/${key}`, { status: j.status === "skipped" ? "new" : "skipped" }); mutate(); }}>
            {j.status === "skipped" ? "Unskip" : "Skip"}
          </Button>
        )}
        {j.application_slug
          ? <Button size="sm" nativeButton={false} render={<Link href={`/applications/${j.application_slug}`} />}>Open application</Button>
          : <RunButton url={`/api/jobs/${key}/apply-docs`} disabled={j.status === "expired"}>Generate CV + cover letter</RunButton>}
      </PageHeader>

      <div className="mb-4 flex flex-wrap gap-1.5">
        <StatusBadge value={j.status} />
        {j.tracker_status && <StatusBadge value={j.tracker_status} />}
        {j.rank_verdict && <StatusBadge value={j.rank_verdict} />}
        {j.location_verdict && <StatusBadge value={j.location_verdict} />}
        {j.language_gate && j.language_gate !== "PASS" && <StatusBadge value={j.language_gate} />}
        {j.closing_soon && <StatusBadge value="FLAG" />}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="gap-3">
          <CardHeader><CardTitle className="text-sm font-medium">Fit</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center gap-3"><span className="w-28 text-muted-foreground">Score</span><ScoreBar score={j.rank_score} verdict={j.rank_verdict} /></div>
            <div className="flex gap-3"><span className="w-28 text-muted-foreground">Verdict</span>{j.rank_verdict ?? "not ranked yet"}</div>
            <div className="flex gap-3"><span className="w-28 text-muted-foreground">Ranked</span>{fmtDate(j.rank_date)}</div>
            <div className="flex gap-3"><span className="w-28 text-muted-foreground">Location gate</span>{j.location_verdict ?? "–"}</div>
            <div className="flex gap-3"><span className="w-28 text-muted-foreground">Language gate</span>{j.language_gate ?? "–"}{j.language_note && <span className="text-muted-foreground"> · {j.language_note}</span>}</div>
            {!j.rank_score && <RunButton url="/api/rank" body={{ limit: 10 }} variant="outline">Rank new jobs</RunButton>}
          </CardContent>
        </Card>
        <Card className="gap-3">
          <CardHeader><CardTitle className="text-sm font-medium">Posting</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex gap-3"><span className="w-28 text-muted-foreground">Portal</span>{j.portal ?? j.source ?? "–"}</div>
            <div className="flex gap-3"><span className="w-28 text-muted-foreground">Region</span>{j.region ?? "–"}</div>
            <div className="flex gap-3"><span className="w-28 text-muted-foreground">Posted</span>{fmtDate(j.posted_date)}</div>
            <div className="flex gap-3"><span className="w-28 text-muted-foreground">First seen</span>{fmtDate(j.first_seen)}</div>
            <div className="flex gap-3"><span className="w-28 text-muted-foreground">Deadline</span>{fmtDate(j.deadline)}</div>
            <div className="flex gap-3"><span className="w-28 text-muted-foreground">Key</span><code className="text-xs">{j.key}</code></div>
          </CardContent>
        </Card>
        <Card className="gap-3">
          <CardHeader><CardTitle className="text-sm font-medium text-success">Strengths</CardTitle></CardHeader>
          <CardContent>{j.strengths.length ? <ul className="list-disc pl-5 text-sm">{j.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul> : <p className="text-sm text-muted-foreground">Rank this job to see strengths.</p>}</CardContent>
        </Card>
        <Card className="gap-3">
          <CardHeader><CardTitle className="text-sm font-medium text-destructive">Gaps</CardTitle></CardHeader>
          <CardContent>{j.gaps.length ? <ul className="list-disc pl-5 text-sm">{j.gaps.map((s, i) => <li key={i}>{s}</li>)}</ul> : <p className="text-sm text-muted-foreground">–</p>}</CardContent>
        </Card>
      </div>

      {j.tracker_rows.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-sm font-medium">Tracker rows</h2>
          <ApplicationsTable items={j.tracker_rows} />
        </section>
      )}
    </>
  );
}
