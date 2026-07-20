import type { MetadataRoute } from "next";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXTAUTH_URL ?? "https://averna.vercel.app";

/**
 * Only public pages belong in the sitemap — authenticated app routes are
 * intentionally excluded (see robots.ts).
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const routes: { path: string; priority: number }[] = [
    { path: "", priority: 1 },
    { path: "/about", priority: 0.8 },
    { path: "/auth/signin", priority: 0.5 },
    { path: "/auth/signup", priority: 0.6 },
  ];

  return routes.map(({ path, priority }) => ({
    url: `${siteUrl}${path || "/"}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority,
  }));
}
