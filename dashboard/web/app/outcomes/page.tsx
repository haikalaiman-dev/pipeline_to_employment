"use client";

import Link from "next/link";
import { useState } from "react";
import useSWR from "swr";
import { PageHeader } from "@/components/page-header";
import { Kpi, KpiGrid } from "@/components/kpi";
import { Bars } from "@/components/bars";
import { ApplicationsTable } from "@/components/applications-table";
import { NativeSelect } from "@/components/native-select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, patch } from "@/lib/api";
import { TRACKER_STATUSES, type Application, type Overview, type TrackerStatus } from "@/lib/types";

export default function OutcomesPage() {
  const [tab, setTab] = useState<"open" | "final" | "all">("open");
  const { data, isLoading, mutate } = useSWR<{ items: Application[] }>(`/api/applications?status=${tab}`);
  const { data: ov } = useSWR<Overview>("/api/overview");
  const [pending, setPending] = useState<{ a: Application; status: TrackerStatus } | null>(null);
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);

  async function commit() {
    if (!pending) return;
    const { a, status } = pending;
    setErr(null);
    try {
      await mutate(async (d) => {
        await patch(`/api/applications/${a.slug}/status`, { status, note: note || undefined, row: a.row_index });
        return d;
      }, {
        optimisticData: (d) => d ? { ...d, items: d.items.map((x) => (x.row_index === a.row_index ? { ...x, status } : x)) } : { items: [] },
        rollbackOnError: true, populateCache: false, revalidate: true,
      });
      setPending(null);
      setNote("");
    } catch (e) {
      setErr(e instanceof ApiError ? `${e.code}: ${e.message}` : String(e));
    }
  }

  return (
    <>
      <PageHeader n="07" label="Outcome" title="Record what happened." description="Moving a row off drafted stamps today's date; final statuses close the application.">
        <div role="group" aria-label="Filter" className="flex gap-1">
          {(["open", "final", "all"] as const).map((t) => (
            <Button key={t} size="sm" variant={tab === t ? "secondary" : "ghost"} onClick={() => setTab(t)} className="capitalize">{t}</Button>
          ))}
        </div>
      </PageHeader>
      <KpiGrid>
        <Kpi label="Open" value={ov && ov.tracker_total - (ov.tracker.hired + ov.tracker.rejected + ov.tracker.no_response + ov.tracker.offer_declined + ov.tracker.withdrawn)} />
        <Kpi label="Hired" value={ov?.tracker.hired} tone="success" />
        <Kpi label="Rejected" value={ov?.tracker.rejected} tone="danger" />
        <Kpi label="No response" value={ov?.tracker.no_response} />
        <Kpi label="Withdrawn / declined" value={ov && ov.tracker.withdrawn + ov.tracker.offer_declined} />
        <Kpi label="Total tracked" value={ov?.tracker_total} />
      </KpiGrid>
      <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
        <Bars title="Tracker statuses" rows={ov ? TRACKER_STATUSES.map((k) => ({ label: k, value: ov.tracker[k] })) : []} loading={!ov} />
        <ApplicationsTable items={data?.items} loading={isLoading} tab="outcome"
          empty={{ message: tab === "open" ? "No open applications." : "Nothing here yet.", href: "/tailor", label: "Go to Tailor" }}
          extra={(a) => (
            <div className="flex items-center gap-1">
              <NativeSelect aria-label={`Status for ${a.company}`} value={a.status} onChange={(e) => setPending({ a, status: e.target.value as TrackerStatus })}>
                {TRACKER_STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
              </NativeSelect>
              <Button size="sm" variant="ghost" nativeButton={false} render={<Link href={`/applications/${a.slug}?row=${a.row_index}&tab=outcome`} />}>Detail</Button>
            </div>
          )} />
      </div>

      <Dialog open={!!pending} onOpenChange={(o) => { if (!o) { setPending(null); setErr(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set status to “{pending?.status.replace("_", " ")}”</DialogTitle>
            <DialogDescription>{pending?.a.role} at {pending?.a.company}. An optional note is appended to the tracker row with today&apos;s date.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            <Label htmlFor="note">Note</Label>
            <Input id="note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. recruiter email, 2nd round scheduled" />
          </div>
          {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPending(null)}>Cancel</Button>
            <Button onClick={commit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
