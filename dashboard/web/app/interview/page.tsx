"use client";

import Link from "next/link";
import useSWR from "swr";
import { PageHeader } from "@/components/page-header";
import { Kpi, KpiGrid } from "@/components/kpi";
import { ApplicationsTable } from "@/components/applications-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Application } from "@/lib/types";

export default function InterviewPage() {
  const { data, isLoading } = useSWR<{ items: Application[] }>("/api/applications?status=open");
  const items = data?.items.filter((a) => a.status === "interview" || a.status === "offer" || a.archive.preps.length > 0);
  const preps = data?.items.reduce((n, a) => n + a.archive.preps.length, 0);
  return (
    <>
      <PageHeader n="06" label="Interview" title="Prepare." description="/interview builds a stage-specific prep pack from the archived posting, the CV and cover letter the interviewer read, and feedback from earlier stages." />
      <KpiGrid>
        <Kpi label="In interview" value={data?.items.filter((a) => a.status === "interview").length} loading={isLoading} tone="success" />
        <Kpi label="Offers" value={data?.items.filter((a) => a.status === "offer").length} loading={isLoading} tone="success" />
        <Kpi label="Prep packs" value={preps} loading={isLoading} />
      </KpiGrid>
      <ApplicationsTable items={items} loading={isLoading} tab="interview"
        empty={{ message: "No application is in the interview stage. Set a status in Outcomes when you get an invite.", href: "/outcomes", label: "Go to Outcomes" }}
        extra={(a) => (
          <div className="flex items-center gap-1">
            {a.archive.preps.map((s) => (
              <Badge key={s} variant="outline" className="capitalize" render={<Link href={`/applications/${a.slug}?row=${a.row_index}&tab=interview&stage=${s}`} />}>{s.replace("_", " ")}</Badge>
            ))}
            <Button size="sm" variant="outline" nativeButton={false} render={<Link href={`/applications/${a.slug}?row=${a.row_index}&tab=interview`} />}>Prep</Button>
          </div>
        )} />
    </>
  );
}
