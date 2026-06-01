/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.NEXT_DIST_DIR || (process.env.VERCEL ? ".next" : ".next-build"),
  transpilePackages: ["node-forge", "qrcode.react"],
  eslint: {
    ignoreDuringBuilds: false,
  },
};

export default nextConfig;
