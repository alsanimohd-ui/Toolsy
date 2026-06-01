/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: ".next-build",
  transpilePackages: ["node-forge", "qrcode.react"],
  eslint: {
    ignoreDuringBuilds: false,
  },
};

export default nextConfig;
