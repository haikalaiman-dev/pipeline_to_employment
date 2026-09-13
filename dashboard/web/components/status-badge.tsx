import { Badge } from "@/components/ui/badge";
import { label, tone, toneClass } from "@/lib/status";
import { cn } from "@/lib/utils";

export function StatusBadge({ value, className }: { value: string | null | undefined; className?: string }) {
  if (!value) return <span className="text-muted-foreground">–</span>;
  return (
    <Badge variant="outline" className={cn("capitalize", toneClass[tone[value] ?? "neutral"], className)}>
      {label(value)}
    </Badge>
  );
}
