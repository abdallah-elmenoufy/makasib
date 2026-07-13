import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse (pdfjs) resolves its worker at runtime — keep it unbundled
  serverExternalPackages: ["pdf-parse"],
};

export default nextConfig;
