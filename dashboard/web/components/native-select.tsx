import { cn } from "@/lib/utils";

/** Native <select>: accessible, keyboard-complete, zero JS. Used for filters and status pickers. */
export function NativeSelect({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "h-8 rounded-md border border-input bg-background px-2 text-sm shadow-xs outline-none",
        "focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}
