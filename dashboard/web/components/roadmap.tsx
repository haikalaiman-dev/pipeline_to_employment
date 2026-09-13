"use client";

import { ScoreBar } from "./score-bar";
import type { Roadmap as RoadmapT } from "@/lib/types";
import { cn } from "@/lib/utils";

const PRIO: Record<string, number> = { high: 0, medium: 1, low: 2 };
const prioClass: Record<string, string> = { high: "text-foreground", medium: "text-muted-foreground", low: "text-muted-foreground/60" };
const readinessVerdict = (r: number) => (r >= 70 ? "Strong Fit" : r >= 40 ? "Moderate Fit" : "Weak Fit");
const quarterKey = (q: string) => q.replace(/^(\d{4})-Q(\d)$/, "$1$2");

export function Roadmap({ data }: { data: RoadmapT }) {
  const past = [...data.past];
  const levers = [...data.levers].sort((a, b) => (PRIO[a.priority] ?? 9) - (PRIO[b.priority] ?? 9));
  const milestones = [...data.milestones].sort((a, b) => quarterKey(a.target_quarter).localeCompare(quarterKey(b.target_quarter)));
  return (
    <div className="grid gap-16 lg:grid-cols-[minmax(0,1fr)_16rem] lg:gap-x-16">
      <div className="min-w-0 space-y-12">
        {/* Track: past -> now */}
        <section aria-labelledby="track-h" className="animate-in fade-in duration-500 motion-reduce:animate-none">
          <h2 id="track-h" className="t-label mb-6">Track</h2>
          <ol className={cn(
            "relative flex flex-col gap-6 border-l border-border pl-6",
            "lg:flex-row lg:items-start lg:gap-0 lg:border-l-0 lg:pl-0",
            "lg:before:absolute lg:before:inset-x-0 lg:before:top-[5px] lg:before:h-px lg:before:bg-border",
          )}>
            {past.map((p, i) => (
              <li key={`${p.title}-${i}`} className={cn(
                "relative min-w-0 lg:flex-1 lg:pr-6 lg:pt-6",
                "before:absolute before:size-[11px] before:rounded-full before:border before:border-foreground/60 before:bg-background",
                "before:-left-[calc(1.5rem+6px)] before:top-1.5 lg:before:left-0 lg:before:top-0",
              )}>
                <p className="t-num">{p.start}–{p.end}</p>
                <p className="text-sm">{p.title}</p>
                <p className="truncate text-sm text-muted-foreground">{p.company}</p>
                {p.skills.length > 0 && <p className="line-clamp-1 text-xs text-muted-foreground">{p.skills.join(" · ")}</p>}
              </li>
            ))}
            <li className={cn(
              "relative lg:w-64 lg:flex-none lg:pt-6",
              "before:absolute before:size-[11px] before:rounded-full before:bg-foreground before:ring-2 before:ring-success/70",
              "before:-left-[calc(1.5rem+6px)] before:top-1.5 lg:before:left-0 lg:before:top-0",
            )}>
              <p className="t-label text-success">Now</p>
              <p className="text-lg font-medium">{data.current.title}</p>
              <p className="text-sm text-muted-foreground">{data.current.level} · {data.current.years} yrs</p>
              <p className="mt-2 text-sm">{data.current.summary}</p>
            </li>
          </ol>
        </section>

        {/* Next: branches */}
        <section aria-labelledby="next-h" className="animate-in fade-in duration-500 delay-100 fill-mode-both motion-reduce:animate-none lg:ml-[calc(100%-16rem)]">
          <h2 id="next-h" className="t-label mb-2">Next</h2>
          <ul className="ml-[5px] border-l border-border">
            {data.next.map((n) => (
              <li key={n.title} className="relative py-5 pl-8 before:absolute before:left-0 before:top-9 before:h-px before:w-6 before:bg-border">
                <div className="flex items-baseline justify-between gap-4">
                  <h3 className="text-base font-medium">{n.title}</h3>
                  <span className="t-label">{n.level}</span>
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{n.why}</p>
                <div className="mt-3 flex items-center gap-3">
                  <span className="t-label">readiness</span>
                  <ScoreBar score={n.readiness} verdict={readinessVerdict(n.readiness)} className="w-40" />
                </div>
                {n.missing_skills.length > 0 && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    missing · {n.missing_skills.map((m) => `${m.skill} (${m.priority}${m.est_hours ? `, ~${m.est_hours}h` : ""})`).join(" · ")}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>

        {/* Milestones */}
        <section aria-labelledby="miles-h" className="animate-in fade-in duration-500 delay-200 fill-mode-both motion-reduce:animate-none">
          <h2 id="miles-h" className="t-label mb-4">Milestones</h2>
          <ol className="relative flex flex-wrap gap-x-12 gap-y-4 pt-4 before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-border">
            {milestones.map((m) => (
              <li key={`${m.target_quarter}-${m.label}`}>
                <p className="t-num">{m.target_quarter}</p>
                <p className="text-sm">{m.label}</p>
              </li>
            ))}
          </ol>
        </section>
      </div>

      {/* Level up */}
      <section aria-labelledby="levers-h" className="self-start lg:sticky lg:top-20 animate-in fade-in duration-500 delay-100 fill-mode-both motion-reduce:animate-none">
        <h2 id="levers-h" className="t-label mb-2">Level up</h2>
        <ol>
          {levers.map((l) => (
            <li key={l.skill} className="border-b border-border py-3 last:border-b-0">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-medium">{l.skill}</span>
                <span className={cn("t-label", prioClass[l.priority])}>{l.priority}</span>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">{l.why}</p>
              {l.resources.length > 0 && (
                <p className="mt-1 text-xs">
                  {l.resources.map((r, i) => (
                    <span key={r.url}>
                      {i > 0 && <span className="text-muted-foreground"> · </span>}
                      <a href={r.url} target="_blank" rel="noreferrer" className="underline-offset-4 hover:underline">{r.label}</a>
                    </span>
                  ))}
                </p>
              )}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
