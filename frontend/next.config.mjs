/** @type {import('next').NextConfig} */
const nextConfig = {
  // Optional separate build folder (e.g. NEXT_DIST_DIR=.next-prod) so a local production
  // build can't collide with a running `next dev`. Unset on Render = default ".next".
  distDir: process.env.NEXT_DIST_DIR || ".next",
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  transpilePackages: ["@medusajs/ui"],
  staticPageGenerationTimeout: 180,
  experimental: {
    serverComponentsExternalPackages: ["exceljs", "pg"],
    optimizePackageImports: [
      "lucide-react",
      "@medusajs/ui",
      "@medusajs/icons",
      "recharts",
      "date-fns",
    ],
  },
  webpack: (config) => {
    config.watchOptions = {
      ...config.watchOptions,
      ignored: [
        "**/node_modules/**",
        "**/.git/**",
        "**/backend/**",
      ],
    };
    return config;
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
        port: "3001",
      },
      {
        protocol: "http",
        hostname: "localhost",
        port: "3000",
      },
      {
        protocol: "https",
        hostname: "robohash.org",
      },
      {
        protocol: "https",
        hostname: "caketohome.vercel.app",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: "/catalog",
        destination: "/products",
      },
      {
        source: "/terms-conditions",
        destination: "/terms-and-conditions",
      },
      {
        source: "/terms",
        destination: "/terms-and-conditions",
      },
      {
        source: "/privacy",
        destination: "/privacy-policy",
      },
    ];
  },
};

export default nextConfig;
