import { barColor, tone } from "@/lib/status";
import { cn } from "@/lib/utils";

export function ScoreBar({ score, verdict, className }: { score: number | null | undefined; verdict?: string | null; className?: string }) {
  if (score == null) return <span className="text-muted-foreground">–</span>;
  const t = verdict ? tone[verdict] ?? "neutral" : "neutral";
  return (
    <div className="flex items-center gap-2">
      <div role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={score} aria-label={`Score ${score}`}
        className={cn("h-2 w-16 rounded-sm bg-muted", className)}>
        <div className={cn("h-2 rounded-sm", barColor[t])} style={{ width: `${score}%` }} />
      </div>
      <span className="w-7 text-right text-sm tabular-nums">{score}</span>
    </div>
  );
}
