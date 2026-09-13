"use client";

import { ThemeProvider } from "next-themes";
import { SWRConfig } from "swr";
import { fetcher } from "@/lib/api";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <SWRConfig value={{ fetcher, refreshInterval: 10_000, keepPreviousData: true, revalidateOnFocus: false }}>
        {children}
      </SWRConfig>
    </ThemeProvider>
  );
}
