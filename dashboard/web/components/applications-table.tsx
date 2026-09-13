"use client";

import Link from "next/link";
import { Check, OpenNewWindow, Xmark } from "iconoir-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "./status-badge";
import { Empty } from "./empty";
import { fmtDate } from "@/lib/format";
import type { Application } from "@/lib/types";

function Dot({ ok, label }: { ok: boolean; label: string }) {
  return ok
    ? <span className="inline-flex items-center gap-1 text-success"><Check className="size-3.5" aria-hidden />{label}</span>
    : <span className="inline-flex items-center gap-1 text-muted-foreground"><Xmark className="size-3.5" aria-hidden />{label}</span>;
}

export function ApplicationsTable({ items, loading, tab = "docs", extra, empty }: {
  items: Application[] | undefined; loading?: boolean; tab?: string;
  extra?: (a: Application) => React.ReactNode; empty?: { message: string; href?: string; label?: string };
}) {
  if (!loading && items && items.length === 0) {
    return <Empty message={empty?.message ?? "No applications yet."}
      action={empty?.href ? { href: empty.href, label: empty.label ?? "Go" } : { href: "/recommend", label: "Rank jobs" }} />;
  }
  return (
    <div className="overflow-x-auto rule">
      <Table aria-busy={loading}>
        <TableHeader>
          <TableRow>
            <TableHead>Application</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Fit</TableHead>
            <TableHead>Documents</TableHead>
            <TableHead>Date / deadline</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading && !items
            ? [0, 1, 2].map((i) => <TableRow key={i}>{Array.from({ length: 6 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>)
            : items?.map((a) => (
              <TableRow key={`${a.slug}-${a.row_index}`}>
                <TableCell className="max-w-72">
                  <Link href={`/applications/${a.slug}?row=${a.row_index}&tab=${tab}`} className="font-medium hover:underline">{a.role || "(role)"}</Link>
                  <div className="truncate text-xs text-muted-foreground">{a.company}{a.channel ? ` · ${a.channel}` : ""}</div>
                </TableCell>
                <TableCell><StatusBadge value={a.status} /></TableCell>
                <TableCell className="tabular-nums">{a.fit_rating || "–"}</TableCell>
                <TableCell className="text-xs">
                  <div className="flex flex-col gap-0.5">
                    <Dot ok={!!a.cv_pdf} label="CV" />
                    <Dot ok={!!a.cover_pdf} label="Cover letter" />
                  </div>
                </TableCell>
                <TableCell className="text-xs tabular-nums">
                  <div>{fmtDate(a.date)}</div>
                  <div className="text-muted-foreground">{a.deadline || "–"}</div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    {a.source && (
                      <Button variant="ghost" size="icon-sm" aria-label="Open posting" nativeButton={false} render={<a href={a.source} target="_blank" rel="noreferrer" />}>
                        <OpenNewWindow className="size-4" aria-hidden />
                      </Button>
                    )}
                    {extra?.(a)}
                  </div>
                </TableCell>
              </TableRow>
            ))}
        </TableBody>
      </Table>
    </div>
  );
}
