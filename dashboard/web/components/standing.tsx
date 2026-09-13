"use client";

import Link from "next/link";
import { useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { NativeSelect } from "./native-select";
import { ScoreBar } from "./score-bar";
import { ApiError, post } from "@/lib/api";
import { fmtTime } from "@/lib/format";
import type { Profile, Region } from "@/lib/types";

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="rule-row">
      <dt className="shrink-0 text-sm text-muted-foreground">{k}</dt>
      <dd className="text-right text-sm">{v ?? <span className="text-muted-foreground">–</span>}</dd>
    </div>
  );
}

const join = (xs: string[] | undefined) => (xs && xs.length ? xs.join(", ") : undefined);

export function Standing({ updating }: { updating?: boolean }) {
  const { data: p, isLoading } = useSWR<Profile>("/api/profile");
  const { data: regions } = useSWR<{ regions: Region[] }>("/api/regions");
  const { mutate } = useSWRConfig();
  const [region, setRegion] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string; href?: string } | null>(null);
  const rid = region || regions?.regions[0]?.id;

  if (isLoading && !p) return <Skeleton className="h-40" />;
  if (!p || !p.exists) {
    return <p className="text-sm text-muted-foreground">No profile yet. Upload documents and run the analysis above.</p>;
  }

  async function tailor() {
    if (!rid) return;
    setMsg(null);
    try {
      await post(`/api/regions/${rid}/queries-from-profile`);
      await mutate((k) => typeof k === "string" && k.startsWith("/api/regions"), undefined, { revalidate: true });
      setMsg({ ok: true, text: "Queries updated.", href: `/hunt/${rid}` });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof ApiError ? `${e.code}: ${e.message}` : String(e) });
    }
  }

  const label = regions?.regions.find((r) => r.id === rid)?.label ?? rid;
  const nq = p.target_roles.length + p.target_skills.length;
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-medium tracking-tight">{p.identity.name}</h2>
          {p.identity.headline && <p className="text-muted-foreground">{p.identity.headline}</p>}
          <p className="t-label mt-2">profile from {fmtTime(p.generated_at)}{updating && " · updating…"}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="t-label">complete</span>
          <ScoreBar score={p.completeness} verdict={p.completeness >= 75 ? "Strong Fit" : p.completeness >= 45 ? "Moderate Fit" : "Poor Fit"} className="w-32" />
        </div>
      </div>
      {p.placeholders.length > 0 && (
        <p role="status" className="text-sm text-warning">
          {p.placeholders.length} placeholder{p.placeholders.length === 1 ? "" : "s"} remain: {p.placeholders.slice(0, 5).map((x) => `[${x}]`).join(", ")}
          {p.placeholders.length > 5 && ` +${p.placeholders.length - 5}`} — re-run the analysis with more documents, or edit the skill files.
        </p>
      )}
      <dl className="grid gap-x-12 sm:grid-cols-2">
        <Row k="Latest position" v={p.latest_position && `${p.latest_position.title} · ${p.latest_position.company}`} />
        <Row k="Years of experience" v={p.years_experience ?? undefined} />
        <Row k="Location" v={p.identity.location ?? undefined} />
        <Row k="Status" v={p.identity.status ?? undefined} />
        <Row k="Languages" v={join(p.languages.map((l) => `${l.language} ${l.level}`))} />
        <Row k="Education" v={join(p.education.map((e) => [e.degree, e.field, e.institution].filter(Boolean).join(" · ")))} />
        <Row k="Primary skills" v={join(p.skills.primary)} />
        <Row k="Secondary skills" v={join(p.skills.secondary)} />
        <Row k="Domain" v={join(p.skills.domain)} />
        <Row k="Software" v={join(p.skills.software)} />
        <Row k="Target roles" v={join(p.target_roles)} />
        <Row k="Target skills" v={join(p.target_skills)} />
      </dl>
      <div className="flex flex-wrap items-center gap-3">
        <NativeSelect aria-label="Region" value={rid ?? ""} onChange={(e) => setRegion(e.target.value)}>
          {regions?.regions.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
        </NativeSelect>
        <AlertDialog>
          <AlertDialogTrigger render={<Button variant="outline" size="sm" disabled={!rid || nq === 0} />}>Tailor hunt to my profile</AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Replace the queries of {label}?</AlertDialogTitle>
              <AlertDialogDescription>
                {p.target_roles.length} target titles and {p.target_skills.length} skills from your profile become the search queries for this region (up to 12). The current queries are dropped.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={tailor}>Replace queries</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        {msg && (
          <span role={msg.ok ? "status" : "alert"} className={msg.ok ? "text-sm text-success" : "text-sm text-destructive"}>
            {msg.text} {msg.href && <Link className="underline underline-offset-4" href={msg.href}>Open Hunt →</Link>}
          </span>
        )}
      </div>
    </div>
  );
}
