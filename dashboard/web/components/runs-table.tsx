"use client";

import { useState } from "react";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "./status-badge";
import { NativeSelect } from "./native-select";
import { useOpenRun } from "./run-button";
import { Empty } from "./empty";
import { Kpi, KpiGrid } from "./kpi";
import { duration, fmtTime, fmtUsd, runLabel } from "@/lib/format";
import type { RunMeta } from "@/lib/types";

const KINDS = ["setup", "scrape", "scrape-llm", "rank", "apply-docs", "interview", "outcome-run", "submit", "login", "roadmap"];

export function RunsTable() {
  const [kind, setKind] = useState("");
  const { data, isLoading } = useSWR<{ items: RunMeta[] }>(`/api/runs?limit=200${kind ? `&kind=${kind}` : ""}`, { refreshInterval: 5000 });
  const open = useOpenRun();
  const items = data?.items;
  const [now] = useState(() => Date.now());
  const today = new Date(now).toISOString().slice(0, 10);
  const week = now - 7 * 864e5;
  return (
    <div className="space-y-6">
      <KpiGrid>
        <Kpi label="Today" value={items?.filter((r) => r.created_at.startsWith(today)).length} loading={isLoading} />
        <Kpi label="Failed (7d)" value={items?.filter((r) => r.state === "failed" && new Date(r.created_at).getTime() > week).length} loading={isLoading} tone="danger" />
        <Kpi label="Cost (7d)" value={items && fmtUsd(items.filter((r) => new Date(r.created_at).getTime() > week).reduce((n, r) => n + (r.cost_usd ?? 0), 0))} loading={isLoading} />
      </KpiGrid>
      <div className="flex items-center justify-between gap-3">
        <p className="t-label">Runs</p>
        <NativeSelect aria-label="Kind" value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="">all kinds</option>
          {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
        </NativeSelect>
      </div>
      {items && items.length === 0 ? (
        <Empty message="Nothing has run yet." action={{ href: "/hunt", label: "Scrape a region" }} />
      ) : (
        <div className="overflow-x-auto rule">
          <Table aria-busy={isLoading}>
            <TableHeader>
              <TableRow>
                <TableHead>State</TableHead><TableHead>Kind</TableHead><TableHead>Target</TableHead>
                <TableHead>Started</TableHead><TableHead className="text-right">Duration</TableHead><TableHead className="text-right">Cost</TableHead>
                <TableHead className="text-right">Turns</TableHead><TableHead>Error</TableHead><TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {!items && [0, 1, 2].map((i) => <TableRow key={i}>{Array.from({ length: 9 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>)}
              {items?.map((r) => (
                <TableRow key={r.id} className="group cursor-pointer" onClick={() => open(r.id)}>
                  <TableCell><StatusBadge value={r.state} /></TableCell>
                  <TableCell className="font-medium">{r.kind}</TableCell>
                  <TableCell className="max-w-64 truncate text-muted-foreground">{runLabel(r.args)}{r.args.dry_run === true && " (dry)"}</TableCell>
                  <TableCell className="whitespace-nowrap text-xs tabular-nums">{fmtTime(r.started_at ?? r.created_at)}</TableCell>
                  <TableCell className="text-right tabular-nums">{duration(r.started_at, r.finished_at)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtUsd(r.cost_usd)}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.num_turns ?? "–"}</TableCell>
                  <TableCell className="max-w-64 truncate text-xs text-destructive">{r.error?.code}</TableCell>
                  <TableCell className="text-right opacity-60 group-hover:opacity-100 focus-within:opacity-100">
                    <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); open(r.id); }}>Log</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
