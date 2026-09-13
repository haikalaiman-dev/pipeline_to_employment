import type { ComponentType, SVGProps } from "react";
import { Upload, Search, Star, PageEdit, SendDiagonal, Microphone, Trophy } from "iconoir-react";
import type { Overview, RunKind } from "./types";

export type StageId = "import" | "hunt" | "recommend" | "tailor" | "apply" | "interview" | "outcome";

export interface Stage {
  n: string;
  id: StageId;
  href: string;
  label: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  unit: string;
  also?: string[];
  count: (o: Overview) => number;
}

/** Single source for the top bar, the home pipeline, page headers and run→stage mapping. */
export const STAGES: Stage[] = [
  { n: "01", id: "import", href: "/import", label: "Import", Icon: Upload, unit: "files", count: (o) => o.documents_total ?? 0 },
  { n: "02", id: "hunt", href: "/hunt", label: "Hunt", Icon: Search, unit: "new", also: ["/jobs"], count: (o) => o.seen.new },
  { n: "03", id: "recommend", href: "/recommend", label: "Recommend", Icon: Star, unit: "good fit+",
    count: (o) => o.ranked_bands["Strong Fit"] + o.ranked_bands["Good Fit"] },
  { n: "04", id: "tailor", href: "/tailor", label: "Tailor", Icon: PageEdit, unit: "drafted", also: ["/applications"], count: (o) => o.tracker.drafted },
  { n: "05", id: "apply", href: "/apply", label: "Apply", Icon: SendDiagonal, unit: "applied",
    count: (o) => o.tracker.applied + o.tracker.interview + o.tracker.offer + o.tracker.hired },
  { n: "06", id: "interview", href: "/interview", label: "Interview", Icon: Microphone, unit: "interviews",
    count: (o) => o.tracker.interview + o.tracker.offer + o.tracker.hired },
  { n: "07", id: "outcome", href: "/outcomes", label: "Outcome", Icon: Trophy, unit: "closed",
    count: (o) => o.tracker.hired + o.tracker.rejected + o.tracker.no_response + o.tracker.offer_declined + o.tracker.withdrawn },
];

export const NAV_EXTRA = [
  { href: "/roadmap", label: "Roadmap" },
  { href: "/system", label: "System" },
];

export const kindStage: Partial<Record<RunKind, StageId>> = {
  setup: "import", scrape: "hunt", "scrape-llm": "hunt", rank: "recommend", "apply-docs": "tailor",
  submit: "apply", login: "apply", interview: "interview", "outcome-run": "outcome",
};

export const isActive = (path: string, href: string, also: string[] = []) =>
  href === "/" ? path === "/" : [href, ...also].some((h) => path.startsWith(h));
