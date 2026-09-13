"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import useSWR from "swr";
import { PageHeader } from "@/components/page-header";
import { JobsTable } from "@/components/jobs-table";
import { NativeSelect } from "@/components/native-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { patch, qs } from "@/lib/api";
import type { Job, Overview } from "@/lib/types";

const PAGE = 50;

function JobsInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const get = (k: string, d = "") => sp.get(k) ?? d;
  const [q, setQ] = useState(get("q"));
  useEffect(() => {
    const t = setTimeout(() => { if (q !== get("q")) set({ q, offset: "" }); }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  function set(patchParams: Record<string, string>) {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patchParams)) {
      if (v) next.set(k, v); else next.delete(k);
    }
    router.replace(`/jobs?${next}`);
  }

  const params = { status: get("status"), region: get("region"), portal: get("portal"), min_score: get("min_score"),
    q: get("q"), sort: get("sort", "-first_seen"), limit: PAGE, offset: get("offset", "0") };
  const key = `/api/jobs${qs(params)}`;
  const { data, isLoading, mutate } = useSWR<{ total: number; items: Job[] }>(key);
  const { data: ov } = useSWR<Overview>("/api/overview");
  const offset = Number(params.offset);

  async function skip(job: Job) {
    const status = job.status === "skipped" ? "new" : "skipped";
    await mutate(async () => { await patch(`/api/jobs/${encodeURIComponent(job.key)}`, { status }); return undefined; }, {
      optimisticData: (d) => d ? { ...d, items: d.items.map((j) => (j.key === job.key ? { ...j, status } : j)) } : { total: 0, items: [] },
      rollbackOnError: true, populateCache: false, revalidate: true,
    });
  }

  return (
    <>
      <PageHeader label="Hunt · all postings" title="All postings." description={`${data?.total ?? "–"} matching · ${ov?.seen.total ?? "–"} seen in total`} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input aria-label="Search title, company, location" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} className="h-8 w-56" />
        <NativeSelect aria-label="Status" value={params.status} onChange={(e) => set({ status: e.target.value, offset: "" })}>
          <option value="">any status</option>
          {["new", "ranked", "skipped", "expired"].map((s) => <option key={s} value={s}>{s}</option>)}
        </NativeSelect>
        <NativeSelect aria-label="Region" value={params.region} onChange={(e) => set({ region: e.target.value, offset: "" })}>
          <option value="">any region</option>
          {Object.keys(ov?.by_region ?? {}).map((r) => <option key={r} value={r}>{r}</option>)}
        </NativeSelect>
        <NativeSelect aria-label="Portal" value={params.portal} onChange={(e) => set({ portal: e.target.value, offset: "" })}>
          <option value="">any portal</option>
          {Object.keys(ov?.by_portal ?? {}).map((p) => <option key={p} value={p}>{p.replace("-search", "")}</option>)}
        </NativeSelect>
        <Input aria-label="Minimum score" type="number" min={0} max={100} placeholder="min score" className="h-8 w-28"
          value={params.min_score} onChange={(e) => set({ min_score: e.target.value, offset: "" })} />
        <NativeSelect aria-label="Sort" value={params.sort} onChange={(e) => set({ sort: e.target.value })}>
          <option value="-first_seen">newest seen</option>
          <option value="-posted_date">newest posted</option>
          <option value="-rank_score">highest score</option>
          <option value="deadline">deadline soonest</option>
          <option value="company">company A–Z</option>
        </NativeSelect>
        {(params.status || params.region || params.portal || params.min_score || params.q) && (
          <Button variant="ghost" size="sm" onClick={() => { setQ(""); router.replace("/jobs"); }}>Clear</Button>
        )}
      </div>
      <JobsTable items={data?.items} loading={isLoading} onSkip={skip} />
      {data && data.total > PAGE && (
        <div className="mt-3 flex items-center justify-end gap-2 text-sm">
          <span className="text-muted-foreground tabular-nums">{offset + 1}–{Math.min(offset + PAGE, data.total)} of {data.total}</span>
          <Button variant="outline" size="sm" disabled={offset === 0} onClick={() => set({ offset: String(Math.max(0, offset - PAGE)) })}>Previous</Button>
          <Button variant="outline" size="sm" disabled={offset + PAGE >= data.total} onClick={() => set({ offset: String(offset + PAGE) })}>Next</Button>
        </div>
      )}
    </>
  );
}

export default function JobsPage() {
  return <Suspense><JobsInner /></Suspense>;
}
