import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone server for the Docker image (WEB-07).
  output: "standalone",
  // The card images read the bundled fonts from disk (WEB-41d, src/server/cards/render.tsx): trace them into the
  // standalone build.
  outputFileTracingIncludes: {
    "/api/bot/v1/cards/[file]": ["./src/server/cards/fonts/*"],
  },
  experimental: {
    // The proxy (src/proxy.ts) sees a copy of each request body, cut at this size (Next.js default 10 MB), and the
    // route then only gets that much. Manual uploads go through the proxy and may be 25 MiB (MAX_UPLOAD_BYTES), plus
    // the multipart framing. The uploader and bot APIs skip the proxy (its matcher).
    proxyClientMaxBodySize: "30mb",
  },
};

export default nextConfig;
