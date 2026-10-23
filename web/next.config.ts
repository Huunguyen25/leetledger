import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep Next.js dev from generating framework-specific agent instruction
  // files in this repository.
  agentRules: false,
};

export default nextConfig;
