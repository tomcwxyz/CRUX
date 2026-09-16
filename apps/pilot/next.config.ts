import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@crux/core",
    "@crux/formats",
    "@crux/instrumentation",
    "@crux/schemas",
  ],
};

export default nextConfig;
