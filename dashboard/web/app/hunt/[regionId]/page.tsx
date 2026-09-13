"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import useSWR from "swr";
import { PageHeader } from "@/components/page-header";
import { RegionForm } from "@/components/region-form";
import { RunButton } from "@/components/run-button";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { fmtTime, duration } from "@/lib/format";
import type { Region, RunMeta } from "@/lib/types";

const NEW: Region = { id: "", label: "", queries: [], portals: [{ skill: "linkedin-search", locations: [], flags: { jobage: 14, limit: 10 } }] };

export default function RegionPage() {
  const { regionId } = useParams<{ regionId: string }>();
  const isNew = regionId === "new";
  const { data, error, isLoading } = useSWR<Region>(isNew ? null : `/api/regions/${regionId}`);
  const { data: runs } = useSWR<{ items: RunMeta[] }>(isNew ? null : "/api/runs?kind=scrape&limit=100");
  const [portals, setPortals] = useState<string[] | null>(null);
  const [queries, setQueries] = useState("");
  const region = isNew ? NEW : data;
  const chosen = portals ?? region?.portals.map((p) => p.skill) ?? [];
  const mine = runs?.items.filter((r) => r.args.region === regionId).slice(0, 15) ?? [];

  return (
    <>
      <PageHeader title={isNew ? "New region" : region?.label ?? regionId} description={isNew ? undefined : `region id ${regionId}`}>
        <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/hunt" />}>← Hunt</Button>
      </PageHeader>
      {error && <p role="alert" className="text-sm text-destructive">Region not found.</p>}
      {isLoading && <Skeleton className="h-64" />}
      {region && (
        <div className="grid gap-4 xl:grid-cols-[1fr_22rem]">
          <RegionForm key={region.id} region={region} isNew={isNew} />
          {!isNew && (
            <div className="space-y-4">
              <Card className="gap-3">
                <CardHeader><CardTitle className="text-sm font-medium">Scrape now</CardTitle></CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <fieldset className="space-y-1.5">
                    <legend className="text-xs text-muted-foreground">Portals</legend>
                    {region.portals.map((p) => (
                      <div key={p.skill} className="flex items-center gap-2">
                        <Checkbox id={`p-${p.skill}`} checked={chosen.includes(p.skill)} disabled={p.enabled === false || p.installed === false}
                          onCheckedChange={(c) => setPortals(c ? [...chosen, p.skill] : chosen.filter((s) => s !== p.skill))} />
                        <Label htmlFor={`p-${p.skill}`} className="font-normal">{p.skill}{p.enabled === false && " (disabled)"}{p.installed === false && " (missing)"}</Label>
                      </div>
                    ))}
                  </fieldset>
                  <div className="space-y-1">
                    <Label htmlFor="oq" className="text-xs text-muted-foreground">Override queries (optional, one per line)</Label>
                    <Textarea id="oq" rows={3} value={queries} onChange={(e) => setQueries(e.target.value)} />
                  </div>
                  <RunButton url="/api/scrape" disabled={chosen.length === 0}
                    body={{ region: region.id, portals: chosen, queries: queries.trim() ? queries.split("\n").map((s) => s.trim()).filter(Boolean) : undefined }}>
                    Scrape {region.label}
                  </RunButton>
                </CardContent>
              </Card>
              <Card className="gap-3">
                <CardHeader><CardTitle className="text-sm font-medium">Recent scrapes</CardTitle></CardHeader>
                <CardContent>
                  {mine.length === 0 && <p className="text-sm text-muted-foreground">None yet.</p>}
                  <ul className="space-y-1.5 text-sm">
                    {mine.map((r) => (
                      <li key={r.id} className="flex items-center gap-2">
                        <StatusBadge value={r.state} />
                        <Link href={`/hunt/${regionId}?run=${r.id}`} className="hover:underline">{fmtTime(r.created_at)}</Link>
                        <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                          {r.result ? `${String(r.result.new ?? 0)} new` : duration(r.started_at, r.finished_at)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}
    </>
  );
}
