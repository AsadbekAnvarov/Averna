/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === "production";

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // Strip noisy console.* from production bundles (keep errors/warnings).
  compiler: {
    removeConsole: isProd ? { exclude: ["error", "warn"] } : false,
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
