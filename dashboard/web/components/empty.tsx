import Link from "next/link";
import { Button } from "@/components/ui/button";

export function Empty({ message, action }: { message: string; action?: { href: string; label: string } }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-y border-dashed py-8 text-sm text-muted-foreground">
      <p>{message}</p>
      {action && (
        <Button variant="outline" size="sm" nativeButton={false} render={<Link href={action.href} />}>
          {action.label}
        </Button>
      )}
    </div>
  );
}
