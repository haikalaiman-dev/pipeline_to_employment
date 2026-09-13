"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { SetupAnswers } from "@/lib/types";

export const EMPTY_ANSWERS: SetupAnswers = {
  career_goals: "", excites: "", deal_breakers: "", languages: "", location: "", target_titles: "", key_skills: "", geography: "",
};

export const lines = (s: string) => s.split("\n").map((l) => l.trim()).filter(Boolean);

export function validate(a: SetupAnswers): Partial<Record<keyof SetupAnswers, string>> {
  const e: Partial<Record<keyof SetupAnswers, string>> = {};
  if (a.career_goals.trim().length < 10) e.career_goals = "Say a little more (10+ characters).";
  if (!a.excites.trim()) e.excites = "Required.";
  if (!lines(a.languages).some((l) => /^.+:\s*.+$/.test(l))) e.languages = "One per line as “Language: level”.";
  if (!a.location.trim()) e.location = "Required.";
  const t = lines(a.target_titles).length;
  if (t < 3 || t > 8) e.target_titles = `3 to 8 titles, one per line (you have ${t}).`;
  const k = lines(a.key_skills).length;
  if (k < 3 || k > 5) e.key_skills = `3 to 5 skills, one per line (you have ${k}).`;
  if (!a.geography.trim()) e.geography = "Required.";
  return e;
}

/** Shape sent to POST /api/setup. */
export function toPayload(a: SetupAnswers) {
  return {
    career_goals: a.career_goals.trim(),
    excites: a.excites.trim(),
    deal_breakers: a.deal_breakers.trim() || undefined,
    languages: lines(a.languages).map((l) => { const [language, ...rest] = l.split(":"); return { language: language.trim(), level: rest.join(":").trim() }; }),
    location: a.location.trim(),
    target_titles: lines(a.target_titles),
    key_skills: lines(a.key_skills),
    geography: a.geography.trim(),
  };
}

const FIELDS: { key: keyof SetupAnswers; label: string; rows?: number; placeholder: string; input?: boolean }[] = [
  { key: "career_goals", label: "Career goals and target role types", rows: 2, placeholder: "Where you want to be in two years, and the kind of roles that get you there" },
  { key: "excites", label: "What excites you in the next role", rows: 2, placeholder: "The work, team or problems that energise you" },
  { key: "deal_breakers", label: "Deal-breakers and must-haves (optional)", rows: 2, placeholder: "Anything that rules a posting out, or that must be there" },
  { key: "languages", label: "Languages you work in, one per line", rows: 3, placeholder: "[Language]: [level]\n[Language]: [level]" },
  { key: "location", label: "Location and commute constraints", placeholder: "[City, Country]; commute limit; remote or hybrid preference", input: true },
  { key: "geography", label: "Target geography", placeholder: "[Countries or regions to search], remote", input: true },
  { key: "target_titles", label: "Job titles to search for (3–8, one per line)", rows: 4, placeholder: "[Job title]\n[Job title]\n[Job title]" },
  { key: "key_skills", label: "Key skills as search terms (3–5, one per line)", rows: 3, placeholder: "[Skill]\n[Skill]\n[Skill]" },
];

export function AnswersForm({ value, onChange, errors }: {
  value: SetupAnswers; onChange: (v: SetupAnswers) => void; errors: Partial<Record<keyof SetupAnswers, string>>;
}) {
  return (
    <div className="grid gap-x-12 gap-y-6 sm:grid-cols-2">
      {FIELDS.map((f) => {
        const err = errors[f.key];
        const id = `ans-${f.key}`;
        const common = {
          id, value: value[f.key], "aria-invalid": !!err || undefined, "aria-describedby": err ? `${id}-err` : undefined,
          placeholder: f.placeholder, onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange({ ...value, [f.key]: e.target.value }),
        };
        return (
          <div key={f.key} className="grid gap-1.5">
            <Label htmlFor={id}>{f.label}</Label>
            {f.input ? <Input {...common} /> : <Textarea rows={f.rows} {...common} />}
            {err && <p id={`${id}-err`} role="alert" className="text-xs text-destructive">{err}</p>}
          </div>
        );
      })}
    </div>
  );
}
