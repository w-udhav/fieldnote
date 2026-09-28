import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The desk is opened at 127.0.0.1. Next blocks dev assets from that host unless it is listed.
  allowedDevOrigins: ["127.0.0.1"],
  devIndicators: false,
};

export default nextConfig;
