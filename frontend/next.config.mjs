/** @type {import('next').NextConfig} */
const nextConfig = {
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
