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
        hostname: "*"
      }
    ]
  },
  compress: true,
  compiler: {
    removeConsole: false
    // removeConsole: process.env.NODE_ENV === "production"
  },
  env: {
    NEXT_APP_BASE_URL: process.env.NEXT_APP_BASE_URL,
    NEXT_APP_ENCRYPTION_KEY: process.env.NEXT_APP_ENCRYPTION_KEY,
    NEXT_APP_TOKEN_NAME: process.env.NEXT_APP_TOKEN_NAME,
    NEXT_APP_CLIENT_ID: process.env.NEXT_APP_CLIENT_ID,
    NEXT_APP_CLIENT_SECRET: process.env.NEXT_APP_CLIENT_SECRET,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET
  },
  typescript: { ignoreBuildErrors: false }
};

export default nextConfig;
