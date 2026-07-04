import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow the application form (result-sheet + photo upload) through the server
  // action. Individual files are capped at 5 MB in lib/storage.ts.
  experimental: { serverActions: { bodySizeLimit: "8mb" } },
};

export default nextConfig;
