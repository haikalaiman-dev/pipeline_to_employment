"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import useSWR from "swr";
import { NAV_EXTRA, STAGES, isActive } from "@/lib/stages";
import type { Overview } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./theme-toggle";

export function TopBar() {
  const path = usePathname();
  const { data } = useSWR<Overview>("/api/overview");
  const running = !!data?.current_run;
  const item = (href: string, label: string, n?: string, also?: string[]) => {
    const active = isActive(path, href, also);
    return (
      <Link
        key={href}
        href={href}
        aria-current={active ? "page" : undefined}
        aria-label={n ? `${n} ${label}` : label}
        className={cn(
          "group relative flex items-baseline gap-1.5 whitespace-nowrap py-3 text-sm text-muted-foreground transition-colors hover:text-foreground",
          "after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-foreground after:opacity-0 after:transition-opacity group-hover:after:opacity-50",
          active && "text-foreground after:opacity-100",
        )}
      >
        {n && <span className="t-num">{n}</span>}
        <span className={cn(n && "hidden md:inline")}>{label}</span>
      </Link>
    );
  };
  return (
    <header className="sticky top-0 z-10 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-12 max-w-6xl items-center gap-6 px-5 md:px-8">
        <Link href="/" className="flex items-center gap-2 text-foreground" aria-label="Jobs Pipeline home">
          <span aria-hidden className={cn("size-1.5 rounded-full", running ? "bg-success animate-pulse motion-reduce:animate-none" : "bg-muted-foreground/40")} />
          <span className="t-label whitespace-nowrap text-foreground">Jobs Pipeline</span>
        </Link>
        <nav aria-label="Main" className="ml-auto flex items-center gap-4 overflow-x-auto [scrollbar-width:none] md:gap-5">
          {STAGES.map((s) => item(s.href, s.label, s.n, s.also))}
          <span aria-hidden className="h-4 w-px bg-border" />
          {NAV_EXTRA.map((e) => item(e.href, e.label))}
        </nav>
        <ThemeToggle />
      </div>
    </header>
  );
}
