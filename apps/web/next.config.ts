import type { NextConfig } from "next";
import path from "node:path";

const lightDevelopment =
  process.env.NODE_ENV === "development" && process.env.CONECTA_WEB_DEV_LIGHT === "1";

const nextConfig: NextConfig = {
  transpilePackages: ["@conecta-agenda/ui", "@conecta-agenda/utils"],
  turbopack: {
    root: path.resolve(__dirname, "../.."),
  },
  ...(lightDevelopment
    ? {
        // Retain fewer inactive routes; revisiting one may compile it again.
        onDemandEntries: { pagesBufferLength: 1 },
        webpack: (config, { dev }) => {
          // Reduce concurrent module work without imposing a heap limit.
          if (dev) config.parallelism = 1;
          return config;
        },
      }
    : {}),
};

export default nextConfig;
