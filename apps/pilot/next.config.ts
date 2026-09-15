import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@crux/formats", "@crux/schemas"],
};

export default nextConfig;
