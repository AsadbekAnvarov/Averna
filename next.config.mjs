/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === "production";

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Type and lint errors fail the build (and CI) instead of reaching production.
  // Strip noisy console.* from production bundles (keep errors/warnings).
  compiler: {
    removeConsole: isProd ? { exclude: ["error", "warn"] } : false,
  },
  // Pages merged into the Progress and Rankings hubs. Old links (bookmarks,
  // notifications already stored in the database) keep working.
  async redirects() {
    return [
      { source: "/analytics", destination: "/progress", permanent: true },
      { source: "/achievements", destination: "/progress/achievements", permanent: true },
      { source: "/leagues", destination: "/rankings/leagues", permanent: true },
      { source: "/team-challenge", destination: "/rankings/teams", permanent: true },
    ];
  },
  images: {
    // Serve modern, smaller image formats when next/image is used.
    formats: ["image/avif", "image/webp"],
  },
  experimental: {
    // Tree-shake big icon/animation barrels so each page ships far less JS.
    optimizePackageImports: ["lucide-react", "framer-motion"],
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
};

export default nextConfig;
