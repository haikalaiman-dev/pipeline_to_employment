"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useState } from "react";
import useSWR from "swr";
import { PageHeader } from "@/components/page-header";
import { Kpi, KpiGrid } from "@/components/kpi";
import { Bars } from "@/components/bars";
import { JobsTable } from "@/components/jobs-table";
import { RunButton } from "@/components/run-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { BANDS, type Job, type Overview } from "@/lib/types";
import { cn } from "@/lib/utils";

function RecommendInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const band = sp.get("band");
  const { data: ov, isLoading } = useSWR<Overview>("/api/overview");
  const { data, isLoading: jl } = useSWR<{ total: number; items: Job[] }>("/api/jobs?status=ranked&sort=-rank_score&limit=500");
  const [all, setAll] = useState(false);
  const [focus, setFocus] = useState("");
  const [limit, setLimit] = useState(10);
  const items = data?.items.filter((j) => !band || j.rank_verdict === band);
  return (
    <>
      <PageHeader n="03" label="Recommend" title="Rank the fit." description="/rank scores new jobs on technical, experience, behavioral and career fit. Vetoed (location/language FAIL) rows still appear, flagged.">
        <RunButton url="/api/rank" body={{ all, limit, focus: focus || undefined }}>Rank {all ? "all non-skipped" : `${ov?.seen.new ?? ""} new`}</RunButton>
      </PageHeader>
      <KpiGrid>
        <Kpi label="Unranked" value={ov?.seen.new} loading={isLoading} />
        {BANDS.map((b) => <Kpi key={b} label={b} value={ov?.ranked_bands[b]} loading={isLoading} tone={b.startsWith("Strong") || b.startsWith("Good") ? "success" : b === "Poor Fit" ? "danger" : undefined} />)}
      </KpiGrid>
      <div className="mb-4 grid gap-4 lg:grid-cols-3">
        <Bars title="Band distribution" className="lg:col-span-2" loading={isLoading} rows={ov ? BANDS.map((b) => ({ label: b, value: ov.ranked_bands[b] })) : []} />
        <Card className="gap-3">
          <CardHeader><CardTitle className="text-sm font-medium">Rank options</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between"><Label htmlFor="all">Re-score everything (--all)</Label><Switch id="all" checked={all} onCheckedChange={setAll} /></div>
            <div className="space-y-1"><Label htmlFor="limit">Limit per run</Label><Input id="limit" type="number" min={1} max={100} value={limit} onChange={(e) => setLimit(Number(e.target.value) || 10)} className="h-8 w-24" /></div>
            <div className="space-y-1"><Label htmlFor="focus">Focus filter</Label><Input id="focus" placeholder="e.g. a keyword" value={focus} onChange={(e) => setFocus(e.target.value)} className="h-8" /></div>
          </CardContent>
        </Card>
      </div>
      <div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label="Filter by band">
        <Button size="sm" variant={band ? "ghost" : "secondary"} onClick={() => router.replace("/recommend")}>All ranked</Button>
        {BANDS.map((b) => (
          <Button key={b} size="sm" variant={band === b ? "secondary" : "ghost"} className={cn(band === b && "font-medium")} onClick={() => router.replace(`/recommend?band=${encodeURIComponent(b)}`)}>
            {b} <span className="tabular-nums text-muted-foreground">{ov?.ranked_bands[b] ?? ""}</span>
          </Button>
        ))}
      </div>
      <JobsTable items={items} loading={jl} />
    </>
  );
}

export default function RecommendPage() {
  return <Suspense><RecommendInner /></Suspense>;
}
