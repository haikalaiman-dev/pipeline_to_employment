"use client";

import { Suspense, useMemo, useState, useSyncExternalStore } from "react";
import useSWR from "swr";
import { PageHeader } from "@/components/page-header";
import { DocumentsList, DocumentsUpload } from "@/components/documents";
import { AnswersForm, EMPTY_ANSWERS, toPayload, validate } from "@/components/answers-form";
import { Standing } from "@/components/standing";
import { RunButton } from "@/components/run-button";
import { StatusBadge } from "@/components/status-badge";
import { fmtTime } from "@/lib/format";
import type { Documents, Overview, Profile, SetupAnswers } from "@/lib/types";
import { cn } from "@/lib/utils";

const DRAFT_KEY = "import.answers";
const subscribeStorage = (cb: () => void) => { window.addEventListener("storage", cb); return () => window.removeEventListener("storage", cb); };
const readDraft = () => { try { return localStorage.getItem(DRAFT_KEY); } catch { return null; } };
const STEPS = [
  { id: "upload", label: "Upload" }, { id: "answer", label: "Answer" }, { id: "analyse", label: "Analyse" }, { id: "standing", label: "Standing" },
];

function Inner() {
  const { data: docs } = useSWR<Documents>("/api/documents");
  const { data: profile } = useSWR<Profile>("/api/profile");
  const { data: ov } = useSWR<Overview>("/api/overview");
  // Answers shown = what the user typed this session, else the localStorage draft, else the last server answers.
  const draftRaw = useSyncExternalStore(subscribeStorage, readDraft, () => null);
  const [edited, setEdited] = useState<SetupAnswers | null>(null);
  const answers = useMemo<SetupAnswers>(() => {
    if (edited) return edited;
    if (draftRaw) { try { return { ...EMPTY_ANSWERS, ...JSON.parse(draftRaw) }; } catch { /* corrupt draft */ } }
    const a = profile?.answers;
    if (a && Object.keys(a).length) {
      return {
        career_goals: a.career_goals ?? "", excites: a.excites ?? "", deal_breakers: a.deal_breakers ?? "",
        languages: (a.languages ?? []).map((l) => `${l.language}: ${l.level}`).join("\n"),
        location: a.location ?? "", target_titles: (a.target_titles ?? []).join("\n"),
        key_skills: (a.key_skills ?? []).join("\n"), geography: a.geography ?? "",
      };
    }
    return EMPTY_ANSWERS;
  }, [edited, draftRaw, profile]);
  const loaded = !!edited || !!draftRaw; // show validation only once the user has typed or a draft exists

  const update = (v: SetupAnswers) => {
    setEdited(v);
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(v)); } catch { /* ignore */ }
  };

  const errors = useMemo(() => validate(answers), [answers]);
  const valid = Object.keys(errors).length === 0;
  const total = docs?.total ?? 0;
  const running = ov?.current_run?.kind === "setup";
  const stale = !!(profile?.exists && docs?.newest && profile.generated_at && docs.newest > profile.generated_at);
  const step = total === 0 ? 0 : !valid ? 1 : !profile?.exists || stale ? 2 : 3;
  const last = ov?.last_runs.setup;
  const reason = total === 0 ? "Upload at least one document." : !valid ? `Fix ${Object.keys(errors).length} answer${Object.keys(errors).length === 1 ? "" : "s"}.` : null;

  return (
    <>
      <PageHeader n="01" label="Import" title="Start with who you are." description="Upload your documents, answer eight questions, and let /setup build your profile. The profile drives every later stage." />

      <ol aria-label="Progress" className="mb-12 flex flex-wrap gap-8">
        {STEPS.map((s, i) => (
          <li key={s.id} aria-current={step === i ? "step" : undefined} className={cn("flex items-baseline gap-2 text-sm", step === i ? "text-foreground" : "text-muted-foreground")}>
            <span className="t-num">{i + 1}</span><a href={`#${s.id}`} className="underline-offset-4 hover:underline">{s.label}</a>
          </li>
        ))}
      </ol>

      <section id="upload" className="scroll-mt-20">
        <h2 className="t-label mb-4">1 · Upload</h2>
        <DocumentsUpload />
        <div className="mt-8"><DocumentsList /></div>
      </section>

      <section id="answer" className="section-gap scroll-mt-20">
        <h2 className="t-label mb-1">2 · Answer</h2>
        <p className="mb-6 max-w-prose text-sm text-muted-foreground">These are the questions /setup would ask in conversation. Answers are saved as you type and reused next time.</p>
        <AnswersForm value={answers} onChange={update} errors={loaded ? errors : {}} />
      </section>

      <section id="analyse" className="section-gap scroll-mt-20">
        <h2 className="t-label mb-1">3 · Analyse</h2>
        <p className="mb-4 max-w-prose text-sm text-muted-foreground">
          Runs upstream&apos;s <code>/setup</code> (Path A) headless: reads every file above, merges what it finds into your profile, fills the gaps from your answers, and writes the search queries. Conflicts with existing profile text are kept, not overwritten. Takes several minutes and costs tokens.
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <RunButton url="/api/setup" body={toPayload(answers)} disabled={!!reason || running}>{profile?.exists ? "Re-analyse documents" : "Analyse documents"}</RunButton>
          {reason && <span className="text-sm text-muted-foreground">{reason}</span>}
          {last && <span className="flex items-center gap-2 text-xs text-muted-foreground"><StatusBadge value={last.state} /> last analysis {fmtTime(last.finished_at ?? last.started_at)}{last.error && ` · ${last.error.code}`}</span>}
        </div>
      </section>

      <section id="standing" className="section-gap scroll-mt-20">
        <h2 className="t-label mb-4">4 · Current standing</h2>
        {stale && <p role="status" className="mb-4 text-sm text-warning">Documents changed after the last analysis. Re-analyse to refresh.</p>}
        <Standing updating={running} />
      </section>
    </>
  );
}

export default function ImportPage() {
  return <Suspense><Inner /></Suspense>;
}
