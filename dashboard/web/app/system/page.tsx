"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import useSWR from "swr";
import { PageHeader } from "@/components/page-header";
import { RunsTable } from "@/components/runs-table";
import { RunButton } from "@/components/run-button";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Health, Region } from "@/lib/types";

const TOOLS: (keyof Health)[] = ["bun", "claude", "lualatex", "xelatex", "pdftotext", "playwright"];
const ENV = [
  ["CLAUDE_CODE_OAUTH_TOKEN", "from `claude setup-token`; or ANTHROPIC_API_KEY. Needed by Import analysis, Recommend, Tailor, Interview, Outcome, Roadmap."],
  ["CLAUDE_PERMISSION_MODE", "bypassPermissions (default). Set acceptEdits + CLAUDE_EXTRA_ARGS if your org disables bypass."],
  ["HEADED", "1 opens a visible Chromium (WSLg) for portal login and submits."],
  ["dashboard/regions.yaml", "regions, portals, locations, default queries."],
  ["dashboard/apply-answers.yaml", "answers for portal application forms (label: answer)."],
  ["dashboard/browser-profile/", "persistent Chromium profile with your portal logins."],
];

function Inner() {
  const sp = useSearchParams();
  const router = useRouter();
  const tab = sp.get("tab") ?? "runs";
  const setTab = (v: string) => {
    const next = new URLSearchParams(sp.toString());
    next.set("tab", v);
    router.replace(`/system?${next}`);
  };
  const { data: h, error } = useSWR<Health>("/api/health", { refreshInterval: 30_000 });
  const { data: regions } = useSWR<{ regions: Region[] }>("/api/regions");
  const { data: bs } = useSWR<{ profile_exists: boolean; headed: boolean }>("/api/browser/status", { refreshInterval: 15_000 });

  return (
    <>
      <PageHeader label="System" title="Under the hood." description="Runs and logs, tool health, regions and portals, browser login. Configuration lives in files." />
      <Tabs value={tab} onValueChange={(v) => setTab(String(v))}>
        <TabsList variant="line">
          <TabsTrigger value="runs">Runs</TabsTrigger>
          <TabsTrigger value="health">Health</TabsTrigger>
          <TabsTrigger value="regions">Regions</TabsTrigger>
          <TabsTrigger value="browser">Browser</TabsTrigger>
        </TabsList>

        <TabsContent value="runs" className="mt-8"><RunsTable /></TabsContent>

        <TabsContent value="health" className="mt-8 grid gap-12 md:grid-cols-2">
          <section>
            <h2 className="t-label mb-3">Tools in the api container</h2>
            {error && <p role="alert" className="text-sm text-destructive">API unreachable: {String(error.message)}</p>}
            {!h && !error && <Skeleton className="h-40" />}
            {h && (
              <dl>
                {TOOLS.map((t) => (
                  <div key={t} className="rule-row">
                    <dt className="text-sm">{t}</dt>
                    <dd className="flex items-center gap-3 text-xs text-muted-foreground"><span className="hidden sm:inline">{String(h[t] ?? "not found")}</span><StatusBadge value={h[t] ? "PASS" : "FAIL"} /></dd>
                  </div>
                ))}
                <div className="rule-row"><dt className="text-sm">seen_jobs.json</dt><dd><StatusBadge value={h.seen_exists ? "PASS" : "FLAG"} /></dd></div>
                <div className="rule-row"><dt className="text-sm">job_search_tracker.csv</dt><dd><StatusBadge value={h.tracker_exists ? "PASS" : "FLAG"} /></dd></div>
                <div className="rule-row"><dt className="text-sm">repo</dt><dd className="font-mono text-xs">{h.repo}</dd></div>
              </dl>
            )}
          </section>
          <section>
            <h2 className="t-label mb-3">Environment and files</h2>
            <dl>
              {ENV.map(([k, v]) => (
                <div key={k} className="border-b py-3 last:border-b-0">
                  <dt className="font-mono text-xs">{k}</dt>
                  <dd className="mt-0.5 text-sm text-muted-foreground">{v}</dd>
                </div>
              ))}
            </dl>
          </section>
        </TabsContent>

        <TabsContent value="regions" className="mt-8">
          <dl>
            {regions?.regions.map((r) => {
              const enabled = r.portals.filter((p) => p.enabled !== false && p.installed !== false).length;
              const missing = r.portals.filter((p) => p.installed === false);
              return (
                <div key={r.id} className="rule-row">
                  <dt className="flex items-baseline gap-3"><span className="text-sm">{r.label}</span><span className="t-num">{r.id}</span></dt>
                  <dd className="flex items-center gap-4 text-xs tabular-nums text-muted-foreground">
                    <span>{r.queries.length} queries · {enabled}/{r.portals.length} portals</span>
                    {missing.length > 0 && <StatusBadge value="FAIL" />}
                    <Button variant="ghost" size="sm" nativeButton={false} render={<Link href={`/hunt/${r.id}`} />}>Edit</Button>
                  </dd>
                </div>
              );
            })}
          </dl>
          <Button variant="outline" size="sm" className="mt-4" nativeButton={false} render={<Link href="/hunt/new" />}>New region</Button>
        </TabsContent>

        <TabsContent value="browser" className="mt-8 max-w-xl space-y-4 text-sm">
          <dl>
            <div className="rule-row"><dt className="text-muted-foreground">Saved profile</dt><dd>{bs ? (bs.profile_exists ? "yes" : "none yet") : "–"}</dd></div>
            <div className="rule-row"><dt className="text-muted-foreground">Mode</dt><dd>{bs ? (bs.headed ? "headed (HEADED=1)" : "headless") : "–"}</dd></div>
          </dl>
          <p className="text-muted-foreground">Log in once per portal in a real Chromium window; the session persists in the browser profile and Apply reuses it.</p>
          <div className="flex gap-2">
            <RunButton url="/api/browser/login" body={{ site: "linkedin" }} variant="outline" icon={false}>Log in to LinkedIn</RunButton>
            <RunButton url="/api/browser/login" body={{ site: "jobstreet" }} variant="outline" icon={false}>Log in to JobStreet</RunButton>
          </div>
        </TabsContent>
      </Tabs>
    </>
  );
}

export default function SystemPage() {
  return <Suspense><Inner /></Suspense>;
}
