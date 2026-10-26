import { MockNavigationGuard } from "@/components/exam/mock-navigation-guard";
import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible, Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { PwaInstaller } from "@/components/pwa-installer";
import { CommandPalette } from "@/components/command-palette";
import { LiveNotifications } from "@/components/live-notifications";
import { AppShell } from "@/components/layout/app-sidebar";
import { GFX_TIER_SCRIPT } from "@/components/motion/gfx-tier";
import { THEME_COLORS, THEME_SCRIPT } from "@/components/theme/theme-script";
import { COMFORT_SCRIPT } from "@/components/comfort/comfort-script";

const inter = Inter({ subsets: ["latin"], display: "swap" });
// Settings → Reading comfort → Readable font (html.font-readable). Not preloaded:
// the files load only for people who switch it on.
const readable = Atkinson_Hyperlegible({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "700"],
  display: "swap",
  preload: false,
  variable: "--font-readable",
});

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

// No static theme colour here: the theme-color <meta> is rendered in <head> below so
// THEME_SCRIPT / ThemeProvider can switch it with the light/dark theme.
// viewportFit "cover" makes env(safe-area-inset-*) non-zero on notched devices.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning: the <head> scripts set html[data-gfx], the saved theme class and
    // the reading-comfort classes before React hydrates, so <html>'s attributes legitimately
    // differ from the server HTML.
    <html lang="en" className={`dark ${readable.variable}`} suppressHydrationWarning>
      <head>
        {/* Graphics tier (html[data-gfx]) before first paint — components/motion/gfx-tier.ts */}
        <script dangerouslySetInnerHTML={{ __html: GFX_TIER_SCRIPT }} />
        {/* Browser-chrome colour; THEME_SCRIPT (next) and ThemeProvider update it for the light theme */}
        <meta name="theme-color" content={THEME_COLORS.dark} suppressHydrationWarning />
        {/* Saved light/dark theme before first paint (no dark flash) — components/theme/theme-script.ts */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        {/* Saved text size, readable font, line spacing and contrast — components/comfort/comfort-script.ts */}
        <script dangerouslySetInnerHTML={{ __html: COMFORT_SCRIPT }} />
      </head>
      <body className={inter.className}>
        <Providers>
          <MockNavigationGuard><AppShell>{children}</AppShell>
          <CommandPalette /></MockNavigationGuard>
        </Providers>
        <PwaInstaller />
        <LiveNotifications />
      </body>
    </html>
  );
}
