import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["docxtemplater", "pizzip"],
  allowedDevOrigins: [
    '192.168.233.128',
    'http://192.168.233.128:3000'
  ],
};

export default nextConfig;

