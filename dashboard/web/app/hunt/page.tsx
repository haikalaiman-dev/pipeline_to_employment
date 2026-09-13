"use client";

import Link from "next/link";
import { useState } from "react";
import useSWR from "swr";
import { PageHeader } from "@/components/page-header";
import { RunButton } from "@/components/run-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtTime } from "@/lib/format";
import type { Overview, Region, RunMeta } from "@/lib/types";

function RegionCard({ r, lastScrape }: { r: Region; lastScrape?: RunMeta }) {
  const { data } = useSWR<{ total: number }>(`/api/jobs?region=${r.id}&limit=1`);
  const enabled = r.portals.filter((p) => p.enabled !== false && p.installed !== false);
  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-base">
          <span>{r.label}</span>
          <span className="text-xs font-normal text-muted-foreground">{r.id}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <dl className="grid grid-cols-3 gap-2">
          <div><dt className="text-xs text-muted-foreground">Jobs</dt><dd className="tabular-nums">{data?.total ?? "–"}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Queries</dt><dd className="tabular-nums">{r.queries.length}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Portals</dt><dd className="tabular-nums">{enabled.length}/{r.portals.length}</dd></div>
        </dl>
        <div className="text-xs text-muted-foreground">
          {enabled.map((p) => p.skill.replace("-search", "")).join(", ") || "no enabled portals"}
          {lastScrape && <> · last scrape {fmtTime(lastScrape.finished_at ?? lastScrape.started_at)} ({lastScrape.state})</>}
        </div>
        <div className="flex gap-2">
          <RunButton url="/api/scrape" body={{ region: r.id }} disabled={enabled.length === 0 || r.queries.length === 0}>Scrape</RunButton>
          {r.queries.length === 0 && <span className="self-center text-xs text-muted-foreground">no queries yet: Edit, or tailor from Import</span>}
          <Button variant="outline" size="sm" nativeButton={false} render={<Link href={`/hunt/${r.id}`} />}>Edit</Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function HuntPage() {
  const { data, isLoading } = useSWR<{ regions: Region[] }>("/api/regions");
  const { data: ov } = useSWR<Overview>("/api/overview");
  const { data: runs } = useSWR<{ items: RunMeta[] }>("/api/runs?kind=scrape&limit=50");
  const [focus, setFocus] = useState("");
  const lastByRegion = new Map<string, RunMeta>();
  for (const r of runs?.items ?? []) {
    const id = String(r.args.region ?? "");
    if (id && !lastByRegion.has(id)) lastByRegion.set(id, r);
  }
  return (
    <>
      <PageHeader n="02" label="Hunt" title="Find postings." description="Pick a region; only its portals and locations are scraped. Ranking happens in Recommend.">
        <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/hunt/new" />}>New region</Button>
      </PageHeader>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {isLoading && [0, 1].map((i) => <Skeleton key={i} className="h-44" />)}
        {data?.regions.map((r) => <RegionCard key={r.id} r={r} lastScrape={lastByRegion.get(r.id)} />)}
        <Card className="gap-3 border-dashed">
          <CardHeader><CardTitle className="text-base">LLM scrape (/scrape)</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-muted-foreground">Upstream&apos;s full <code>/scrape</code> via headless Claude Code: WebSearch fallback, portal health check, quick fit. Slower and costs tokens.</p>
            <Input placeholder="optional focus, e.g. a sub-field or seniority" value={focus} onChange={(e) => setFocus(e.target.value)} aria-label="Focus" />
            <RunButton url="/api/scrape/llm" body={{ focus: focus || undefined }} variant="outline">Run /scrape</RunButton>
            {ov?.last_runs["scrape-llm"] && <p className="text-xs text-muted-foreground">last: {fmtTime(ov.last_runs["scrape-llm"].finished_at)} ({ov.last_runs["scrape-llm"].state})</p>}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
