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
  // Development only: other hosts allowed to load the dev server's pages
  // and assets, such as a temporary HTTPS tunnel for testing inside
  // Shopify admin. Comma-separated, e.g. in .env.development.local.
  allowedDevOrigins: (process.env.DEV_ALLOWED_ORIGINS || "")
    .split(",")
    .map((host) => host.trim())
    .filter(Boolean),
  async redirects() {
    return [
      // /bot has no page of its own; Settings is the default tab.
      { source: "/bot", destination: "/bot/settings", permanent: false },
      // Knowledge was merged into the AI tab.
      {
        source: "/bot/knowledge",
        destination: "/bot/ai#knowledge",
        permanent: true
      },
      // Flows moved under the Bot section. /settings/ai is handled by its
      // own page, since its #hash target never reaches the server.
      { source: "/flows", destination: "/bot/flows", permanent: true },
      {
        source: "/flows/:canvasId",
        destination: "/bot/flows/:canvasId",
        permanent: true
      },
      // Profile and password moved out of the org into the account area.
      { source: "/profile", destination: "/account", permanent: true },
      {
        source: "/settings/security",
        destination: "/account/security",
        permanent: true
      }
    ];
  }
};

export default nextConfig;
