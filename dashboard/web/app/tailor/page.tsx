"use client";

import Link from "next/link";
import { useState } from "react";
import useSWR from "swr";
import { PageHeader } from "@/components/page-header";
import { Kpi, KpiGrid } from "@/components/kpi";
import { ApplicationsTable } from "@/components/applications-table";
import { RunButton } from "@/components/run-button";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { fmtTime, runLabel } from "@/lib/format";
import type { Application, RunMeta } from "@/lib/types";

export default function TailorPage() {
  const { data, isLoading } = useSWR<{ items: Application[] }>("/api/applications?status=open");
  const { data: runs } = useSWR<{ items: RunMeta[] }>("/api/runs?kind=apply-docs&limit=10");
  const [url, setUrl] = useState("");
  const drafted = data?.items.filter((a) => a.status === "drafted");
  const ready = drafted?.filter((a) => a.cv_pdf && a.cover_pdf).length;
  return (
    <>
      <PageHeader n="04" label="Tailor" title="Draft the documents." description="/apply drafts a tailored LaTeX CV and cover letter per posting, reviews them with a second agent, compiles and verifies the PDFs. Nothing is sent." />
      <KpiGrid>
        <Kpi label="Drafted" value={drafted?.length} loading={isLoading} />
        <Kpi label="PDFs ready" value={ready} loading={isLoading} tone="success" />
        <Kpi label="PDFs missing" value={drafted && ready != null ? drafted.length - ready : undefined} loading={isLoading} tone="warning" />
      </KpiGrid>
      <div className="mb-4 grid gap-4 lg:grid-cols-[1fr_20rem]">
        <ApplicationsTable items={drafted} loading={isLoading} tab="docs"
          empty={{ message: "Nothing drafted yet. Generate docs from a ranked job.", href: "/recommend", label: "Go to Recommend" }}
          extra={(a) => (
            <Button variant="outline" size="sm" nativeButton={false} render={<Link href={`/applications/${a.slug}?row=${a.row_index}&tab=docs`} />}>Docs</Button>
          )} />
        <div className="space-y-4">
          <Card className="gap-3">
            <CardHeader><CardTitle className="text-sm font-medium">From a URL</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Input aria-label="Posting URL" placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} />
              <RunButton url="/api/apply-docs" body={{ url }} disabled={!/^https?:\/\//.test(url)}>Generate docs</RunButton>
            </CardContent>
          </Card>
          <Card className="gap-3">
            <CardHeader><CardTitle className="text-sm font-medium">Recent /apply runs</CardTitle></CardHeader>
            <CardContent>
              {runs?.items.length === 0 && <p className="text-sm text-muted-foreground">None yet.</p>}
              <ul className="space-y-1.5 text-sm">
                {runs?.items.map((r) => (
                  <li key={r.id} className="flex items-center gap-2">
                    <StatusBadge value={r.state} />
                    <Link href={`/tailor?run=${r.id}`} className="truncate hover:underline">{runLabel(r.args)}</Link>
                    <span className="ml-auto whitespace-nowrap text-xs text-muted-foreground">{fmtTime(r.created_at)}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
