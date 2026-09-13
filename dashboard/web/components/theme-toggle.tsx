"use client";

import { useTheme } from "next-themes";
import { HalfMoon, SunLight } from "iconoir-react";
import { Button } from "@/components/ui/button";

/** Icon-only; the two icons are swapped by CSS (`dark:`), so no hydration mismatch and no mounted state. */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <Button variant="ghost" size="icon-sm" aria-label="Toggle colour theme" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>
      <SunLight className="hidden size-4 dark:block" aria-hidden />
      <HalfMoon className="size-4 dark:hidden" aria-hidden />
    </Button>
  );
}
