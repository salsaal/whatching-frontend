import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const nextConfig: NextConfig = {
  reactStrictMode: true,
  trailingSlash: false,
  sassOptions: {
    includePaths: [path.join(__dirname, "styles")]
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com"
      }
    ]
  },
  compress: true,
  compiler: {
    removeConsole: false
    // removeConsole: process.env.NODE_ENV === "production"
  },
  typescript: { ignoreBuildErrors: false },
  async redirects() {
    return [
      // /bot has no page of its own; Flows is the default tab.
      { source: "/bot", destination: "/bot/flows", permanent: false },
      // Flows moved under the Bot section. /settings/ai is handled by its
      // own page, since its #hash target never reaches the server.
      { source: "/flows", destination: "/bot/flows", permanent: true },
      {
        source: "/flows/:canvasId",
        destination: "/bot/flows/:canvasId",
        permanent: true
      }
    ];
  }
};

export default nextConfig;
