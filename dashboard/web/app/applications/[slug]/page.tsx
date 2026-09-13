"use client";

import Image from "next/image";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import useSWR from "swr";
import { OpenNewWindow } from "iconoir-react";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { PdfViewer } from "@/components/pdf-viewer";
import { MarkdownView } from "@/components/markdown-view";
import { RunButton } from "@/components/run-button";
import { NativeSelect } from "@/components/native-select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, fileUrl, patch, qs } from "@/lib/api";
import { fmtDate } from "@/lib/format";
import { TRACKER_STATUSES, type Application, type TrackerStatus } from "@/lib/types";

const STAGES = ["phone_screen", "technical", "case", "final"] as const;

function Inner() {
  const { slug } = useParams<{ slug: string }>();
  const sp = useSearchParams();
  const router = useRouter();
  const row = sp.get("row");
  const tab = sp.get("tab") ?? "docs";
  const key = `/api/applications/${slug}${qs({ row })}`;
  const { data: a, error, isLoading, mutate } = useSWR<Application>(key);
  const set = (p: Record<string, string | null>) => {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(p)) {
      if (v) next.set(k, v); else next.delete(k);
    }
    router.replace(`/applications/${slug}?${next}`);
  };

  if (error) return <p role="alert" className="text-sm text-destructive">Application not found.</p>;
  if (isLoading || !a) return <Skeleton className="h-64" />;
  const base = { row: a.row_index };

  return (
    <>
      <PageHeader title={a.role || "(role)"} description={`${a.company}${a.sector ? ` · ${a.sector}` : ""}${a.channel ? ` · ${a.channel}` : ""}`}>
        {a.source && <Button variant="outline" size="sm" nativeButton={false} render={<a href={a.source} target="_blank" rel="noreferrer" />}><OpenNewWindow className="size-4" aria-hidden />Posting</Button>}
      </PageHeader>
      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
        <StatusBadge value={a.status} />
        <span className="text-muted-foreground">fit {a.fit_rating || "–"}</span>
        <span className="text-muted-foreground">date {fmtDate(a.date)}</span>
        <span className="text-muted-foreground">deadline {a.deadline || "–"}</span>
        {a.rows && a.rows.length > 1 && (
          <NativeSelect aria-label="Tracker row" value={String(a.row_index)} onChange={(e) => set({ row: e.target.value })}>
            {a.rows.map((r) => <option key={r} value={r}>row {r}</option>)}
          </NativeSelect>
        )}
        {a.notes && <span className="w-full text-xs text-muted-foreground">{a.notes}</span>}
      </div>

      <Tabs value={tab} onValueChange={(v) => set({ tab: String(v) })}>
        <TabsList>
          <TabsTrigger value="docs">Documents</TabsTrigger>
          <TabsTrigger value="submit">Submit</TabsTrigger>
          <TabsTrigger value="interview">Interview</TabsTrigger>
          <TabsTrigger value="outcome">Outcome</TabsTrigger>
        </TabsList>

        <TabsContent value="docs" className="mt-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <PdfViewer path={a.cv_pdf} title="CV" />
            <PdfViewer path={a.cover_pdf} title="Cover letter" />
          </div>
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
            {a.cv_file && <a className="hover:underline" href={fileUrl(a.cv_file)} target="_blank" rel="noreferrer">{a.cv_file}</a>}
            {a.cover_letter_file && <a className="hover:underline" href={fileUrl(a.cover_letter_file)} target="_blank" rel="noreferrer">{a.cover_letter_file}</a>}
            {a.archive.job_posting && <a className="hover:underline" href={fileUrl(a.archive.job_posting)} target="_blank" rel="noreferrer">job_posting.md</a>}
            {!a.cv_pdf && a.source && <RunButton url="/api/apply-docs" body={{ url: a.source }} variant="outline">Regenerate docs</RunButton>}
          </div>
        </TabsContent>

        <TabsContent value="submit" className="mt-4"><SubmitTab a={a} /></TabsContent>
        <TabsContent value="interview" className="mt-4"><InterviewTab a={a} slug={slug} stage={sp.get("stage")} onStage={(s) => set({ stage: s })} /></TabsContent>
        <TabsContent value="outcome" className="mt-4"><OutcomeTab a={a} slug={slug} base={base} refresh={() => mutate()} /></TabsContent>
      </Tabs>
    </>
  );
}

function SubmitTab({ a }: { a: Application }) {
  const [dry, setDry] = useState(true);
  const [adapter, setAdapter] = useState("auto");
  const ok = a.status === "drafted" && a.cv_pdf && a.cover_pdf && a.source;
  return (
    <div className="grid gap-4 lg:grid-cols-[20rem_1fr]">
      <Card className="gap-3">
        <CardHeader><CardTitle className="text-sm font-medium">Auto-submit</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          {!ok && <p className="text-muted-foreground">Needs status drafted, both PDFs, and a posting URL. Current: {a.status}{!a.cv_pdf && ", no CV PDF"}{!a.cover_pdf && ", no cover PDF"}{!a.source && ", no URL"}.</p>}
          <div className="flex items-center justify-between"><Label htmlFor="dry2">Dry run</Label><Switch id="dry2" checked={dry} onCheckedChange={setDry} /></div>
          <NativeSelect aria-label="Adapter" value={adapter} onChange={(e) => setAdapter(e.target.value)} className="w-full">
            <option value="auto">auto-detect</option><option value="linkedin">LinkedIn</option><option value="jobstreet">JobStreet</option><option value="generic">generic</option>
          </NativeSelect>
          <RunButton url={`/api/applications/${a.slug}/submit`} body={{ dry_run: dry, adapter, row: a.row_index }} disabled={!ok}
            variant={dry ? "outline" : "destructive"} icon={false}
            confirm={dry ? undefined : { title: `Submit to ${a.company}?`, description: "Sends a real application and marks the row applied. Portal ToS forbid automation.", action: "Submit for real" }}>
            {dry ? "Dry run" : "Submit"}
          </RunButton>
        </CardContent>
      </Card>
      <div className="space-y-3">
        {a.archive.submit_runs.length === 0 && <p className="text-sm text-muted-foreground">No submit runs yet.</p>}
        {a.archive.submit_runs.map((r) => (
          <Card key={r.run_id} className="gap-2">
            <CardHeader><CardTitle className="text-sm font-medium"><a className="hover:underline" href={`?row=${a.row_index}&tab=submit&run=${r.run_id}`}>{r.run_id}</a></CardTitle></CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {r.screenshots.map((s) => (
                <a key={s} href={fileUrl(s)} target="_blank" rel="noreferrer"><Image src={fileUrl(s)} alt={s.split("/").pop() ?? "screenshot"} width={200} height={125} unoptimized className="h-28 w-auto rounded border" /></a>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function InterviewTab({ a, slug, stage, onStage }: { a: Application; slug: string; stage: string | null; onStage: (s: string) => void }) {
  const [form, setForm] = useState({ stage: "phone_screen", date: "", format: "", interviewers: "" });
  const current = stage ?? a.archive.preps[0];
  const { data: prep } = useSWR<{ markdown: string }>(current ? `/api/applications/${slug}/prep/${current}` : null);
  return (
    <div className="grid gap-4 lg:grid-cols-[20rem_1fr]">
      <Card className="gap-3">
        <CardHeader><CardTitle className="text-sm font-medium">New prep pack</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="space-y-1"><Label htmlFor="st">Stage</Label>
            <NativeSelect id="st" value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value })} className="w-full">
              {STAGES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
            </NativeSelect></div>
          <div className="space-y-1"><Label htmlFor="dt">Date</Label><Input id="dt" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
          <div className="space-y-1"><Label htmlFor="fm">Format</Label><Input id="fm" placeholder="video / phone / onsite" value={form.format} onChange={(e) => setForm({ ...form, format: e.target.value })} /></div>
          <div className="space-y-1"><Label htmlFor="iv">Interviewers</Label><Input id="iv" placeholder="comma separated" value={form.interviewers} onChange={(e) => setForm({ ...form, interviewers: e.target.value })} /></div>
          <RunButton url={`/api/applications/${slug}/interview`} body={{ row: a.row_index, stage: form.stage, date: form.date || undefined, format: form.format || undefined,
            interviewers: form.interviewers ? form.interviewers.split(",").map((s) => s.trim()).filter(Boolean) : undefined }}>
            Build prep pack
          </RunButton>
        </CardContent>
      </Card>
      <Card className="gap-3">
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2 text-sm font-medium">
            Prep packs
            {a.archive.preps.map((s) => (
              <Button key={s} size="sm" variant={s === current ? "secondary" : "ghost"} className="capitalize" onClick={() => onStage(s)}>{s.replace("_", " ")}</Button>
            ))}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!current && <p className="text-sm text-muted-foreground">No prep pack yet.</p>}
          {current && !prep && <Skeleton className="h-40" />}
          {prep && <MarkdownView markdown={prep.markdown} />}
        </CardContent>
      </Card>
    </div>
  );
}

function OutcomeTab({ a, slug, base, refresh }: { a: Application; slug: string; base: { row: number }; refresh: () => void }) {
  const [status, setStatus] = useState<TrackerStatus>(a.status);
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [stages, setStages] = useState<string[]>([]);
  const [feedback, setFeedback] = useState("");
  async function save() {
    setErr(null); setSaved(false);
    try {
      await patch(`/api/applications/${slug}/status`, { ...base, status, note: note || undefined });
      setSaved(true); setNote(""); refresh();
    } catch (e) { setErr(e instanceof ApiError ? `${e.code}: ${e.message}` : String(e)); }
  }
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="gap-3">
        <CardHeader><CardTitle className="text-sm font-medium">Update status (tracker only)</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <NativeSelect aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value as TrackerStatus)} className="w-full">
            {TRACKER_STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
          </NativeSelect>
          <Input aria-label="Note" placeholder="note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="flex items-center gap-3">
            <Button size="sm" onClick={save}>Save</Button>
            {saved && <span role="status" className="text-success">Saved.</span>}
            {err && <span role="alert" className="text-destructive">{err}</span>}
          </div>
        </CardContent>
      </Card>
      <Card className="gap-3">
        <CardHeader><CardTitle className="text-sm font-medium">Run /outcome (archive + outcome.md)</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">Headless /outcome archives the submitted .tex files and posting, writes outcome.md with stages and feedback, and updates the tracker.</p>
          <fieldset className="flex flex-wrap gap-3">
            <legend className="mb-1 text-xs text-muted-foreground">Stages reached</legend>
            {STAGES.map((s) => (
              <div key={s} className="flex items-center gap-1.5">
                <Checkbox id={`s-${s}`} checked={stages.includes(s)} onCheckedChange={(c) => setStages(c ? [...stages, s] : stages.filter((x) => x !== s))} />
                <Label htmlFor={`s-${s}`} className="font-normal capitalize">{s.replace("_", " ")}</Label>
              </div>
            ))}
          </fieldset>
          <Textarea rows={3} placeholder="feedback received (optional)" value={feedback} onChange={(e) => setFeedback(e.target.value)} aria-label="Feedback" />
          <RunButton url={`/api/applications/${slug}/outcome-run`} body={{ ...base, status, stages: stages.length ? stages : undefined, feedback: feedback || undefined }} variant="outline">
            Run /outcome as “{status.replace("_", " ")}”
          </RunButton>
        </CardContent>
      </Card>
      {a.outcome_md && (
        <Card className="gap-3 lg:col-span-2">
          <CardHeader><CardTitle className="text-sm font-medium">outcome.md</CardTitle></CardHeader>
          <CardContent><MarkdownView markdown={a.outcome_md} /></CardContent>
        </Card>
      )}
    </div>
  );
}

export default function ApplicationPage() {
  return <Suspense><Inner /></Suspense>;
}
