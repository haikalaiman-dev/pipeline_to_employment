"use client";

import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { STAGES, kindStage } from "@/lib/stages";
import type { Overview } from "@/lib/types";
import { cn } from "@/lib/utils";

/** The home page: seven clickable stage nodes with one live count each. */
export function Pipeline({ overview }: { overview: Overview | undefined }) {
  const activeStage = overview?.current_run ? kindStage[overview.current_run.kind] : undefined;
  return (
    <ol
      aria-label="Pipeline"
      className="grid gap-y-10 [--icon:2.5rem] lg:grid-cols-7 lg:gap-y-0 animate-in fade-in slide-in-from-bottom-2 duration-500 motion-reduce:animate-none"
    >
      {STAGES.map((s) => {
        const count = overview ? s.count(overview) : undefined;
        const running = activeStage === s.id;
        return (
          <li
            key={s.id}
            className={cn(
              "relative",
              // vertical rail (<lg): line from icon bottom to the next item
              "after:absolute after:left-[calc(var(--icon)/2)] after:top-[var(--icon)] after:-bottom-10 after:w-px after:bg-border last:after:hidden",
              // horizontal connector (lg+): from this icon's right edge to the next icon's left edge
              "lg:after:left-[calc(50%+var(--icon)/2+0.5rem)] lg:after:right-[calc(-50%+var(--icon)/2+0.5rem)] lg:after:top-[calc(var(--icon)/2)] lg:after:bottom-auto lg:after:h-px lg:after:w-auto",
            )}
          >
            <Link
              href={s.href}
              aria-label={`${s.n} ${s.label}, ${count ?? "unknown"} ${s.unit}`}
              className={cn(
                "group grid grid-cols-[var(--icon)_1fr_auto] items-center gap-4 rounded-sm outline-none",
                "focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background",
                "lg:grid-cols-1 lg:justify-items-center lg:gap-2 lg:text-center",
              )}
            >
              <span className="relative grid size-(--icon) place-items-center rounded-full border bg-background transition-transform group-hover:-translate-y-0.5 motion-reduce:transform-none">
                <s.Icon className="size-5" strokeWidth={1.5} aria-hidden />
                {running && (
                  <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-success animate-pulse motion-reduce:animate-none">
                    <span className="sr-only">running</span>
                  </span>
                )}
              </span>
              <span className="flex items-baseline gap-2 lg:flex-col lg:items-center lg:gap-0.5">
                <span className="t-num">{s.n}</span>
                <span className="text-sm decoration-1 underline-offset-4 group-hover:underline">{s.label}</span>
              </span>
              <span className="flex items-baseline gap-2 lg:flex-col lg:items-center lg:gap-0">
                {count === undefined ? (
                  <Skeleton className="h-7 w-10" />
                ) : (
                  <span className="text-2xl tabular-nums text-muted-foreground transition-colors group-hover:text-foreground">{count}</span>
                )}
                <span className="t-label">{s.unit}</span>
              </span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
