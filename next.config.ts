import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
  // pdfjs-dist v6 uses ES module internals that Next.js bundler cannot process.
  // Listing it as a serverExternalPackage tells Next.js to require() it at
  // runtime (from node_modules) rather than bundling it, which is required for
  // the Node.js legacy build to work inside Route Handlers.
  serverExternalPackages: ["pdfjs-dist"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
