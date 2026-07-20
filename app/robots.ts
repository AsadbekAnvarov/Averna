import type { MetadataRoute } from "next";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXTAUTH_URL ?? "https://averna.vercel.app";

/**
 * Allow crawling of the public marketing/auth pages, but keep authenticated
 * app areas and the API out of search indexes.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/admin/",
        "/teacher/",
        "/dashboard",
        "/messages",
        "/notifications",
        "/settings",
        "/profile",
        "/billing",
      ],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
