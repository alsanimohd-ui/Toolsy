/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.NEXT_DIST_DIR || ".next",
  transpilePackages: ["node-forge", "qrcode.react"],
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
