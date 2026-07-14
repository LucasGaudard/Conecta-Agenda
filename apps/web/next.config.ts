import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@conecta-agenda/ui", "@conecta-agenda/utils"],
  turbopack: {
    root: "C:/Users/Lucas/Projetos/Conecta_agenda",
  },
};

export default nextConfig;
