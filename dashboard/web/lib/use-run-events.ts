"use client";

import { useEffect, useState } from "react";
import type { RunEvent } from "./types";

const CAP = 2000; // ponytail: keep the last 2000 lines in memory; the jsonl on disk is complete

interface State { id: string | null; events: RunEvent[]; done: boolean; connected: boolean }
const fresh = (id: string | null): State => ({ id, events: [], done: false, connected: false });

export function useRunEvents(runId: string | null) {
  const [state, setState] = useState<State>(() => fresh(runId));
  // Reset when the run changes: a state update during render (React's documented pattern), not in an effect.
  if (state.id !== runId) setState(fresh(runId));

  useEffect(() => {
    if (!runId) return;
    const es = new EventSource(`/api/runs/${runId}/events`);
    const patch = (p: Partial<State>) => setState((s) => (s.id === runId ? { ...s, ...p } : s));
    es.onopen = () => patch({ connected: true });
    es.onmessage = (e) => {
      try {
        const ev = JSON.parse(e.data) as RunEvent;
        setState((s) => s.id !== runId ? s : { ...s, events: s.events.length >= CAP ? [...s.events.slice(-CAP + 1), ev] : [...s.events, ev] });
      } catch {
        /* skip malformed line */
      }
    };
    es.addEventListener("done", () => {
      patch({ done: true, connected: false });
      es.close();
    });
    es.onerror = () => patch({ connected: false }); // EventSource retries on its own
    return () => es.close();
  }, [runId]);

  return { events: state.events, done: state.done, connected: state.connected };
}
