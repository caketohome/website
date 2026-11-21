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
  poweredByHeader: false,
  // Basic browser protections: HTTPS only, no framing by other sites, no MIME sniffing.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
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
