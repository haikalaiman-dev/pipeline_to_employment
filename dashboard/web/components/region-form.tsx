"use client";

import { useState } from "react";
import { useSWRConfig } from "swr";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "./status-badge";
import { ApiError, put } from "@/lib/api";
import type { Portal, Region } from "@/lib/types";

const lines = (s: string) => s.split("\n").map((l) => l.trim()).filter(Boolean);

export function RegionForm({ region, isNew }: { region: Region; isNew?: boolean }) {
  const [id, setId] = useState(region.id);
  const [label, setLabel] = useState(region.label);
  const [queries, setQueries] = useState(region.queries.join("\n"));
  const [portals, setPortals] = useState<Portal[]>(region.portals);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const { mutate } = useSWRConfig();

  function updatePortal(i: number, patch: Partial<Portal>) {
    setPortals((p) => p.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  }

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const body = {
        id, label, queries: lines(queries),
        portals: portals.map(({ skill, locations, flags }) => ({
          skill, flags, ...(locations && locations.length ? { locations } : {}),
        })),
      };
      await put(`/api/regions/${id}`, body);
      await mutate((k) => typeof k === "string" && k.startsWith("/api/regions"), undefined, { revalidate: true });
      setMsg({ ok: true, text: "Saved." });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof ApiError ? `${e.code}: ${e.message}` : String(e) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-sm font-medium">{isNew ? "New region" : "Region settings"}</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="rid">Id</Label>
            <Input id="rid" value={id} onChange={(e) => setId(e.target.value)} disabled={!isNew} pattern="[a-z0-9-]+" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="rlabel">Label</Label>
            <Input id="rlabel" value={label} onChange={(e) => setLabel(e.target.value)} />
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="rq">Queries (one per line)</Label>
          <Textarea id="rq" rows={4} value={queries} onChange={(e) => setQueries(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Portals</Label>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Skill</TableHead>
                <TableHead>Locations (one per line)</TableHead>
                <TableHead>Flags (JSON)</TableHead>
                <TableHead>Installed</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {portals.map((p, i) => (
                <TableRow key={i}>
                  <TableCell className="align-top">
                    <Input value={p.skill} onChange={(e) => updatePortal(i, { skill: e.target.value })} className="w-44" aria-label="Portal skill" />
                  </TableCell>
                  <TableCell className="align-top">
                    <Textarea rows={3} value={(p.locations ?? []).join("\n")} aria-label="Locations"
                      onChange={(e) => updatePortal(i, { locations: lines(e.target.value) })} className="min-w-48" />
                  </TableCell>
                  <TableCell className="align-top">
                    <Textarea rows={3} defaultValue={JSON.stringify(p.flags)} aria-label="Flags JSON" className="min-w-56 font-mono text-xs"
                      onBlur={(e) => { try { updatePortal(i, { flags: JSON.parse(e.target.value || "{}") }); } catch { setMsg({ ok: false, text: "flags must be JSON" }); } }} />
                  </TableCell>
                  <TableCell className="align-top text-xs">
                    {p.installed === false ? <StatusBadge value="FAIL" /> : p.enabled === false ? <span className="text-muted-foreground">disabled in SKILL.md</span> : p.installed ? <StatusBadge value="PASS" /> : "–"}
                  </TableCell>
                  <TableCell className="align-top">
                    <Button variant="ghost" size="sm" aria-label="Remove portal" onClick={() => setPortals((x) => x.filter((_, j) => j !== i))}>×</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Button variant="outline" size="sm" onClick={() => setPortals((p) => [...p, { skill: "linkedin-search", locations: [], flags: { jobage: 14, limit: 10 } }])}>
            Add portal
          </Button>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          {msg && <span role="status" className={msg.ok ? "text-sm text-success" : "text-sm text-destructive"}>{msg.text}</span>}
        </div>
      </CardContent>
    </Card>
  );
}
