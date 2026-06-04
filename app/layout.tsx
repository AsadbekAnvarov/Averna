import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { PwaInstaller } from "@/components/pwa-installer";
import { CommandPalette } from "@/components/command-palette";
import { LiveNotifications } from "@/components/live-notifications";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Averna Learning Centre - IELTS Excellence Platform",
  description: "Modern educational platform for IELTS students with gamification, AI features, and real-time communication",
  keywords: ["IELTS", "English Learning", "Education", "Gamification"],
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Averna", statusBarStyle: "black-translucent" },
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
        <Providers>{children}</Providers>
        <CommandPalette />
        <PwaInstaller />
        <LiveNotifications />
      </body>
    </html>
  );
}
