"use client";

import { useRef, useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { Xmark } from "iconoir-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { NativeSelect } from "./native-select";
import { ApiError, del, upload } from "@/lib/api";
import { fmtBytes, fmtDate } from "@/lib/format";
import type { Documents, Folder } from "@/lib/types";
import { cn } from "@/lib/utils";

export const FOLDERS: { id: Folder; label: string; accept: string; hint: string }[] = [
  { id: "cv", label: "CV", accept: ".pdf,.tex", hint: "master CV as PDF or .tex" },
  { id: "linkedin", label: "LinkedIn export", accept: ".pdf", hint: "Profile → More → Save to PDF" },
  { id: "diplomas", label: "Diplomas", accept: ".pdf", hint: "degree certificates, transcripts" },
  { id: "references", label: "References", accept: ".pdf,.txt,.md", hint: "recommendation letters" },
  { id: "applications", label: "Past applications", accept: ".tex,.md", hint: "cv_draft.tex, cover_letter.tex, job_posting.md, outcome.md" },
  { id: "postings", label: "Postings", accept: ".txt", hint: "\"Company - Job Title.txt\"" },
];
const MAX = 25 * 1024 * 1024;
const REJECT = /\.(docx?|png|jpe?g)$/i;

export function DocumentsUpload() {
  const [folder, setFolder] = useState<Folder>("cv");
  const [sub, setSub] = useState("");
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [done, setDone] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const { mutate } = useSWRConfig();
  const meta = FOLDERS.find((f) => f.id === folder)!;
  const needsSub = folder === "applications";
  const subOk = !needsSub || /^[a-z0-9][a-z0-9_]*$/.test(sub);

  async function send(files: FileList | File[]) {
    const list = Array.from(files);
    if (!list.length || !subOk) return;
    const errs: string[] = [];
    let ok = 0;
    for (const f of list) {
      const ext = "." + (f.name.split(".").pop() ?? "").toLowerCase();
      if (REJECT.test(f.name)) { errs.push(`${f.name}: not readable by /setup; convert to PDF`); continue; }
      if (!meta.accept.split(",").includes(ext)) { errs.push(`${f.name}: ${meta.label} accepts ${meta.accept}`); continue; }
      if (f.size > MAX) { errs.push(`${f.name}: larger than 25 MB`); continue; }
      setBusy(f.name);
      const fd = new FormData();
      fd.append("files", f, f.name);
      try {
        await upload(needsSub ? `/api/documents/applications/${sub}` : `/api/documents/${folder}`, fd);
        ok += 1;
      } catch (e) {
        errs.push(`${f.name}: ${e instanceof ApiError ? `${e.code}: ${e.message}` : String(e)}`);
      }
    }
    setBusy(null);
    setErrors(errs);
    setDone(ok ? `${ok} file${ok === 1 ? "" : "s"} saved to documents/${folder}${needsSub ? `/${sub}` : ""}` : null);
    if (ok) void mutate((k) => typeof k === "string" && (k.startsWith("/api/documents") || k === "/api/overview"), undefined, { revalidate: true });
    if (input.current) input.current.value = "";
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-sm">
          <span className="t-label">Folder</span>
          <NativeSelect value={folder} onChange={(e) => setFolder(e.target.value as Folder)} aria-describedby="folder-hint">
            {FOLDERS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
          </NativeSelect>
        </label>
        {needsSub && (
          <label className="grid gap-1 text-sm">
            <span className="t-label">Application folder</span>
            <Input value={sub} onChange={(e) => setSub(e.target.value.toLowerCase())} placeholder="company_role" pattern="[a-z0-9][a-z0-9_]*" className="h-8 w-48" aria-invalid={!subOk} />
          </label>
        )}
        <p id="folder-hint" className="text-xs text-muted-foreground">{meta.hint} · {meta.accept.replaceAll(",", " ")}</p>
      </div>
      <label
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); void send(e.dataTransfer.files); }}
        className={cn(
          "block cursor-pointer border-y border-dashed py-12 text-center text-sm transition-colors hover:bg-muted/40 focus-within:ring-1 focus-within:ring-ring",
          over && "bg-muted/60", busy && "pointer-events-none opacity-60", !subOk && "cursor-not-allowed opacity-50",
        )}
      >
        <input ref={input} type="file" multiple accept={meta.accept} className="sr-only" disabled={!subOk || !!busy}
          onChange={(e) => e.target.files && void send(e.target.files)} />
        {busy ? <span aria-live="polite">Uploading {busy}…</span> : <><span className="text-foreground">Drop files or browse</span><span className="text-muted-foreground"> · PDF, TeX, TXT, MD · up to 25 MB</span></>}
      </label>
      {done && <p role="status" className="text-sm text-success">{done}</p>}
      {errors.length > 0 && (
        <ul role="alert" className="space-y-0.5 text-sm text-destructive">{errors.map((e) => <li key={e}>{e}</li>)}</ul>
      )}
    </div>
  );
}

export function DocumentsList() {
  const { data, isLoading, mutate } = useSWR<Documents>("/api/documents");
  const [err, setErr] = useState<string | null>(null);

  async function remove(url: string) {
    setErr(null);
    try {
      await del(url);
      await mutate();
    } catch (e) {
      setErr(e instanceof ApiError ? `${e.code}: ${e.message}` : String(e));
    }
  }

  const Row = ({ name, size, modified, url }: { name: string; size: number; modified: string; url: string }) => (
    <div className="rule-row group">
      <span className="truncate font-mono text-sm">{name}</span>
      <span className="flex items-center gap-4 text-xs tabular-nums text-muted-foreground">
        <span>{fmtBytes(size)}</span>
        <span>{fmtDate(modified)}</span>
        <AlertDialog>
          <AlertDialogTrigger render={<Button variant="ghost" size="icon-xs" aria-label={`Delete ${name}`} className="text-muted-foreground group-hover:text-foreground" />}>
            <Xmark className="size-3.5" aria-hidden />
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {name}?</AlertDialogTitle>
              <AlertDialogDescription>The file is removed from the documents folder. Re-run the analysis afterwards so the profile matches.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep</AlertDialogCancel>
              <AlertDialogAction onClick={() => remove(url)}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </span>
    </div>
  );

  if (isLoading && !data) return <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-5 w-full" />)}</div>;
  return (
    <div className="grid gap-8 sm:grid-cols-2">
      {err && <p role="alert" className="text-sm text-destructive sm:col-span-2">{err}</p>}
      {FOLDERS.map((f) => {
        const files = f.id === "applications" ? [] : data?.folders[f.id] ?? [];
        const apps = f.id === "applications" ? data?.folders.applications ?? [] : [];
        const n = f.id === "applications" ? apps.reduce((a, x) => a + x.files.length, 0) : files.length;
        return (
          <section key={f.id} aria-labelledby={`docs-${f.id}`}>
            <h3 id={`docs-${f.id}`} className="t-label flex justify-between border-b pb-2"><span>{f.label}</span><span className="tabular-nums">{n}</span></h3>
            {n === 0 && <p className="py-3 text-sm text-muted-foreground">nothing yet</p>}
            {files.map((x) => <Row key={x.path} name={x.name} size={x.size} modified={x.modified} url={`/api/documents/${f.id}/${encodeURIComponent(x.name)}`} />)}
            {apps.map((a) => (
              <div key={a.name} className="pt-2">
                <p className="t-num">{a.name}</p>
                {a.files.map((x) => <Row key={x.path} name={x.name} size={x.size} modified={x.modified} url={`/api/documents/applications/${a.name}/${encodeURIComponent(x.name)}`} />)}
              </div>
            ))}
          </section>
        );
      })}
    </div>
  );
}
