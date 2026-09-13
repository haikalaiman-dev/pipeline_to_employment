"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import useSWR from "swr";
import { PageHeader } from "@/components/page-header";
import { Kpi, KpiGrid } from "@/components/kpi";
import { ApplicationsTable } from "@/components/applications-table";
import { RunButton } from "@/components/run-button";
import { StatusBadge } from "@/components/status-badge";
import { NativeSelect } from "@/components/native-select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { fileUrl } from "@/lib/api";
import { fmtTime, runLabel } from "@/lib/format";
import type { Application, RunMeta } from "@/lib/types";

export default function ApplyPage() {
  const { data, isLoading } = useSWR<{ items: Application[] }>("/api/applications?status=open");
  const { data: bs } = useSWR<{ profile_exists: boolean; headed: boolean }>("/api/browser/status", { refreshInterval: 15_000 });
  const { data: runs } = useSWR<{ items: RunMeta[] }>("/api/runs?kind=submit&limit=10");
  const [dryRun, setDryRun] = useState(true);
  const [adapter, setAdapter] = useState<"auto" | "linkedin" | "jobstreet" | "generic">("auto");
  const ready = data?.items.filter((a) => a.status === "drafted" && a.cv_pdf && a.cover_pdf && a.source);
  const applied = data?.items.filter((a) => a.status === "applied").length;
  return (
    <>
      <PageHeader n="05" label="Apply" title="Send them." description="Playwright fills the portal's application form with the tailored PDFs and your answers file. Dry run stops before the final submit and only keeps screenshots.">
        <div className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm">
          <Label htmlFor="dry">Dry run</Label>
          <Switch id="dry" checked={dryRun} onCheckedChange={setDryRun} />
        </div>
        <NativeSelect aria-label="Adapter" value={adapter} onChange={(e) => setAdapter(e.target.value as typeof adapter)}>
          <option value="auto">auto-detect portal</option>
          <option value="linkedin">LinkedIn Easy Apply</option>
          <option value="jobstreet">JobStreet</option>
          <option value="generic">generic (open only)</option>
        </NativeSelect>
      </PageHeader>
      <KpiGrid>
        <Kpi label="Ready to submit" value={ready?.length} loading={isLoading} />
        <Kpi label="Applied (open)" value={applied} loading={isLoading} tone="success" />
        <Kpi label="Browser profile" value={bs ? (bs.profile_exists ? "saved" : "none") : undefined} sub={bs?.headed ? "headed" : "headless"} />
      </KpiGrid>
      <div className="mb-4 grid gap-4 lg:grid-cols-[1fr_20rem]">
        <ApplicationsTable items={ready} loading={isLoading} tab="submit"
          empty={{ message: "No drafted application has both PDFs and a posting URL yet.", href: "/tailor", label: "Go to Tailor" }}
          extra={(a) => (
            <RunButton url={`/api/applications/${a.slug}/submit`} body={{ dry_run: dryRun, adapter, row: a.row_index }}
              variant={dryRun ? "outline" : "destructive"} icon={false}
              confirm={dryRun ? undefined : { title: `Submit to ${a.company}?`, description: "This sends a real application through the portal and marks the tracker row applied. Portal terms of service forbid automation; you accept that risk.", action: "Submit for real" }}>
              {dryRun ? "Dry run" : "Submit"}
            </RunButton>
          )} />
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {bs && !bs.profile_exists ? "Not logged in to any portal yet. " : ""}
            Portal logins live in <Link href="/system?tab=browser" className="underline underline-offset-4">System → Browser</Link>; form answers in <code>dashboard/apply-answers.yaml</code>.
          </p>
          <Card className="gap-3">
            <CardHeader><CardTitle className="text-sm font-medium">Recent submits</CardTitle></CardHeader>
            <CardContent>
              {runs?.items.length === 0 && <p className="text-sm text-muted-foreground">None yet.</p>}
              <ul className="space-y-2 text-sm">
                {runs?.items.map((r) => {
                  const shots = (r.result?.screenshots as string[] | undefined) ?? [];
                  return (
                    <li key={r.id}>
                      <div className="flex items-center gap-2">
                        <StatusBadge value={r.state} />
                        <Link href={`/apply?run=${r.id}`} className="truncate hover:underline">{runLabel(r.args)}</Link>
                        {r.args.dry_run === true && <span className="text-xs text-muted-foreground">dry</span>}
                        <span className="ml-auto whitespace-nowrap text-xs text-muted-foreground">{fmtTime(r.created_at)}</span>
                      </div>
                      {shots.length > 0 && (
                        <div className="mt-1 flex gap-1 overflow-x-auto">
                          {shots.slice(-4).map((s) => (
                            <a key={s} href={fileUrl(s)} target="_blank" rel="noreferrer">
                              <Image src={fileUrl(s)} alt="submit step" width={96} height={60} unoptimized className="h-14 w-auto rounded border" />
                            </a>
                          ))}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
