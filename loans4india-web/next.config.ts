import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Document uploads are up to 10 MB each; leave room for multipart overhead.
    proxyClientMaxBodySize: "12mb",
    // Staff attach evidence (portal screenshot, bank email PDF) to server actions; same 10 MB file limit.
    serverActions: { bodySizeLimit: "11mb" },
  },
};

export default nextConfig;
