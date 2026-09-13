import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import { Providers } from "@/components/providers";
import { TopBar } from "@/components/topbar";
import { RunBanner } from "@/components/run-banner";
import { RunDrawer } from "@/components/run-drawer";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { template: "%s · Jobs Pipeline", default: "Jobs Pipeline" },
  description: "Local job-hunting pipeline dashboard",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full">
        <Providers>
          <TopBar />
          <main className="mx-auto max-w-6xl px-5 pb-28 pt-10 md:px-8">{children}</main>
          <Suspense>
            <RunBanner />
            <RunDrawer />
          </Suspense>
        </Providers>
      </body>
    </html>
  );
}
