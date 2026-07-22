import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { PwaInstaller } from "@/components/pwa-installer";
import { CommandPalette } from "@/components/command-palette";
import { LiveNotifications } from "@/components/live-notifications";
import { AppShell } from "@/components/layout/app-sidebar";

const inter = Inter({ subsets: ["latin"], display: "swap" });

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXTAUTH_URL ?? "https://averna.vercel.app";

const SITE_DESCRIPTION =
  "Modern IELTS learning platform with AI-powered assessments, gamification, daily speaking practice, mock exams and real-time progress tracking.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Averna Learning Centre — IELTS Excellence Platform",
    template: "%s · Averna",
  },
  description: SITE_DESCRIPTION,
  keywords: ["IELTS", "English Learning", "IELTS preparation", "Education", "Gamification", "Mock exams"],
  applicationName: "Averna",
  authors: [{ name: "Averna Learning Centre" }],
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Averna", statusBarStyle: "black-translucent" },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/logo.png", type: "image/png" },
    ],
    apple: "/logo.png",
  },
  openGraph: {
    type: "website",
    siteName: "Averna Learning Centre",
    title: "Averna Learning Centre — IELTS Excellence Platform",
    description: SITE_DESCRIPTION,
    url: siteUrl,
    images: [{ url: "/logo.png", width: 512, height: 512, alt: "Averna Learning Centre" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Averna Learning Centre — IELTS Excellence Platform",
    description: SITE_DESCRIPTION,
    images: ["/logo.png"],
  },
  robots: { index: true, follow: true },
  other: {
    // Newer, non-deprecated equivalent of apple-mobile-web-app-capable
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: "#04070d",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        <Providers>
          <AppShell>{children}</AppShell>
          <CommandPalette />
        </Providers>
        <PwaInstaller />
        <LiveNotifications />
      </body>
    </html>
  );
}
