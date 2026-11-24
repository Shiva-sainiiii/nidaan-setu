import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Every TestBridge screen is live data, so we run fully dynamic (no Cache Components).
  reactCompiler: true,
  serverExternalPackages: ["pg", "@electric-sql/pglite"],
  // db/*.sql is read at runtime (auto-creates the schema): make sure Vercel ships it.
  outputFileTracingIncludes: { "/**": ["./db/**/*.sql"] },
  // On Vercel: a tab opened before a redeploy reloads itself instead of
  // failing with "Failed to find Server Action".
  deploymentId: process.env.VERCEL_DEPLOYMENT_ID || undefined,
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
