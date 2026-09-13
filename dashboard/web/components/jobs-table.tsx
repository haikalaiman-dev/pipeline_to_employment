"use client";

import Link from "next/link";
import { OpenNewWindow } from "iconoir-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "./status-badge";
import { ScoreBar } from "./score-bar";
import { RunButton } from "./run-button";
import { Empty } from "./empty";
import { fmtDate } from "@/lib/format";
import type { Job } from "@/lib/types";

export function JobsTable({ items, loading, onSkip, showActions = true }: {
  items: Job[] | undefined; loading?: boolean; onSkip?: (job: Job) => void; showActions?: boolean;
}) {
  if (!loading && items && items.length === 0) {
    return <Empty message="No jobs match." action={{ href: "/hunt", label: "Scrape a region" }} />;
  }
  return (
    <div className="overflow-x-auto rule">
      <Table aria-busy={loading}>
        <TableHeader>
          <TableRow>
            <TableHead>Job</TableHead>
            <TableHead>Location</TableHead>
            <TableHead>Source</TableHead>
            <TableHead>Score</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Posted / deadline</TableHead>
            {showActions && <TableHead className="text-right">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading && !items
            ? [0, 1, 2, 3, 4].map((i) => (
              <TableRow key={i}>{Array.from({ length: showActions ? 7 : 6 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>
            ))
            : items?.map((j) => (
              <TableRow key={j.key}>
                <TableCell className="max-w-72">
                  <Link href={`/jobs/${encodeURIComponent(j.key)}`} className="font-medium hover:underline">{j.title ?? "(untitled)"}</Link>
                  <div className="truncate text-xs text-muted-foreground">{j.company ?? "–"}</div>
                </TableCell>
                <TableCell className="max-w-48 text-sm">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate" title={j.location ?? undefined}>{j.location ?? "–"}</span>
                    {j.location_verdict && j.location_verdict !== "PASS" && <StatusBadge value={j.location_verdict} />}
                  </div>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  <div>{j.portal?.replace("-search", "") ?? j.source}</div>
                  {j.region && <div>{j.region}</div>}
                </TableCell>
                <TableCell>
                  <ScoreBar score={j.rank_score} verdict={j.rank_verdict} />
                  {j.rank_verdict && <div className="text-xs text-muted-foreground">{j.rank_verdict}</div>}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    <StatusBadge value={j.status} />
                    {j.tracker_status && <StatusBadge value={j.tracker_status} />}
                  </div>
                </TableCell>
                <TableCell className="text-xs tabular-nums">
                  <div>{fmtDate(j.posted_date)}</div>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    {fmtDate(j.deadline)}
                    {j.closing_soon && <Badge variant="outline" className="border-warning/40 text-warning">closing soon</Badge>}
                  </div>
                </TableCell>
                {showActions && (
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {j.url && (
                        <Button variant="ghost" size="icon-sm" aria-label="Open posting" nativeButton={false} render={<a href={j.url} target="_blank" rel="noreferrer" />}>
                          <OpenNewWindow className="size-4" aria-hidden />
                        </Button>
                      )}
                      {onSkip && (j.status === "new" || j.status === "skipped") && (
                        <Button variant="ghost" size="sm" onClick={() => onSkip(j)}>{j.status === "skipped" ? "Unskip" : "Skip"}</Button>
                      )}
                      {j.status !== "expired" && !j.application_slug && (
                        <RunButton url={`/api/jobs/${encodeURIComponent(j.key)}/apply-docs`} variant="outline" icon={false}>Docs</RunButton>
                      )}
                      {j.application_slug && (
                        <Button variant="outline" size="sm" nativeButton={false} render={<Link href={`/applications/${j.application_slug}`} />}>Application</Button>
                      )}
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
        </TableBody>
      </Table>
    </div>
  );
}
