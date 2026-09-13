"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Play } from "iconoir-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ApiError, post } from "@/lib/api";
import type { Accepted } from "@/lib/types";

export function useOpenRun() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  return (runId: string) => {
    const next = new URLSearchParams(sp.toString());
    next.set("run", runId);
    router.push(`${pathname}?${next.toString()}`);
  };
}

/** POSTs to `url`, then opens the run drawer. `confirm` wraps the click in an AlertDialog. */
export function RunButton({ url, body, children, confirm, disabled, variant = "default", size = "sm", icon = true, onDone }: {
  url: string; body?: unknown; children: React.ReactNode;
  confirm?: { title: string; description: string; action?: string };
  disabled?: boolean; variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"]; icon?: boolean; onDone?: (r: Accepted) => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const open = useOpenRun();

  async function go() {
    setPending(true);
    setError(null);
    try {
      const r = await post<Accepted>(url, body);
      onDone?.(r);
      open(r.run_id);
    } catch (e) {
      setError(e instanceof ApiError ? `${e.code}: ${e.message}` : String(e));
    } finally {
      setPending(false);
    }
  }

  const btn = (
    <Button variant={variant} size={size} disabled={disabled || pending} onClick={confirm ? undefined : go}>
      {icon && <Play className="size-3.5" aria-hidden />}
      {pending ? "Queuing…" : children}
    </Button>
  );

  return (
    <span className="inline-flex flex-col items-start gap-1">
      {confirm ? (
        <AlertDialog>
          <AlertDialogTrigger render={btn} />
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{confirm.title}</AlertDialogTitle>
              <AlertDialogDescription>{confirm.description}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={go}>{confirm.action ?? "Continue"}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : btn}
      {error && <span role="alert" className="text-xs text-destructive">{error}</span>}
    </span>
  );
}
