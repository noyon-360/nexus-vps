import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["ssh2"],
  // allowedDevOrigins: ["http://[192.168.0.218:3000]", "http://localhost:3000"],
};

export default nextConfig;
