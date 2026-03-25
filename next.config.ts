import type { NextConfig } from "next";

const isProductionDeployment = process.env.VERCEL_ENV === "production";

const nextConfig: NextConfig = {
  devIndicators: isProductionDeployment ? false : undefined,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },
};

export default nextConfig;
