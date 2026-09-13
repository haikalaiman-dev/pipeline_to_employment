"use client";

import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "./status-badge";
import { fileUrl, post } from "@/lib/api";
import { duration, fmtTime, fmtUsd, runLabel } from "@/lib/format";
import { useRunEvents } from "@/lib/use-run-events";
import type { RunEvent, RunMeta } from "@/lib/types";
import { cn } from "@/lib/utils";

function EventLine({ ev }: { ev: RunEvent }) {
  const time = ev.ts.slice(11, 19);
  if (ev.type === "claude") return null; // raw stream-json; the paired `summary` line is shown instead
  if (ev.type === "screenshot") {
    return (
      <div className="my-2">
        <div className="text-xs text-muted-foreground">{time} screenshot · {String(ev.label)}</div>
        <a href={fileUrl(String(ev.path))} target="_blank" rel="noreferrer">
          <Image src={fileUrl(String(ev.path))} alt={`Screenshot ${String(ev.label)}`} width={640} height={360} unoptimized className="mt-1 rounded border" />
        </a>
      </div>
    );
  }
  const text = ev.type === "status"
    ? `state=${String(ev.state)}${ev.step ? ` · ${String(ev.step)}` : ""}`
    : ev.type === "error"
      ? `${String(ev.code)}: ${String(ev.message ?? ev.detail ?? JSON.stringify(ev))}`
      : ev.type === "summary" && !ev.text
        ? Object.entries(ev).filter(([k]) => !["ts", "type"].includes(k)).map(([k, v]) => `${k}=${String(v)}`).join(" ")
        : String(ev.text ?? "");
  return (
    <div className={cn("whitespace-pre-wrap break-words",
      ev.type === "error" && "text-destructive",
      ev.type === "stderr" && "text-muted-foreground",
      ev.type === "status" && "text-warning",
      ev.type === "summary" && ev.subagent === true && "pl-4 text-muted-foreground")}>
      <span className="select-none text-muted-foreground/60">{time} </span>{text}
    </div>
  );
}

export function RunDrawer() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const runId = sp.get("run");
  const { data: run } = useSWR<RunMeta>(runId ? `/api/runs/${runId}` : null, {
    refreshInterval: (d) => (d && ["succeeded", "failed", "cancelled"].includes(d.state) ? 0 : 2000),
  });
  const { events, done, connected } = useRunEvents(runId);
  const { mutate } = useSWRConfig();
  const [follow, setFollow] = useState(true);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (follow) endRef.current?.scrollIntoView({ block: "end" });
  }, [events.length, follow]);

  useEffect(() => {
    if (done) void mutate(() => true, undefined, { revalidate: true }); // refresh every list once the run ends
  }, [done, mutate]);

  function close() {
    const next = new URLSearchParams(sp.toString());
    next.delete("run");
    router.push(next.size ? `${pathname}?${next}` : pathname);
  }

  const terminal = run && ["succeeded", "failed", "cancelled"].includes(run.state);
  return (
    <Sheet open={!!runId} onOpenChange={(o) => !o && close()}>
      <SheetContent side="right" className="flex w-full flex-col gap-3 sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle className="flex flex-wrap items-center gap-2">
            {run ? (<><StatusBadge value={run.state} /> {run.kind} <span className="font-normal text-muted-foreground">{runLabel(run.args)}</span></>) : "Run"}
          </SheetTitle>
          <SheetDescription className="flex flex-wrap gap-x-4 tabular-nums">
            {run && (<>
              <span>started {fmtTime(run.started_at)}</span>
              <span>{duration(run.started_at, run.finished_at)}</span>
              {run.cost_usd != null && <span>{fmtUsd(run.cost_usd)}</span>}
              {run.num_turns != null && <span>{run.num_turns} turns</span>}
            </>)}
          </SheetDescription>
        </SheetHeader>

        {run?.error && (
          <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-sm">
            <b>{run.error.code}</b> {run.error.message}
          </div>
        )}
        {run?.result && terminal && (
          <details className="rounded-md border p-2 text-sm">
            <summary className="cursor-pointer">Result</summary>
            <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap text-xs">{JSON.stringify(run.result, null, 1)}</pre>
          </details>
        )}

        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span aria-live="polite">{done ? "log complete" : connected ? "live" : "connecting…"} · {events.length} events</span>
          <div className="flex items-center gap-3">
            <Label htmlFor="follow" className="text-xs">Follow</Label>
            <Switch id="follow" checked={follow} onCheckedChange={setFollow} />
            {run && !terminal && (
              <AlertDialog>
                <AlertDialogTrigger render={<Button size="sm" variant="destructive">Cancel run</Button>} />
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Cancel this run?</AlertDialogTitle>
                    <AlertDialogDescription>The process is terminated; partial state files stay as written so far.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Keep running</AlertDialogCancel>
                    <AlertDialogAction onClick={() => post(`/api/runs/${run.id}/cancel`)}>Cancel run</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto rounded-md border bg-muted/40 p-3 font-mono text-xs leading-5">
          {events.map((ev, i) => <EventLine key={i} ev={ev} />)}
          <div ref={endRef} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
