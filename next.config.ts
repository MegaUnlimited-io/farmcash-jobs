import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // No basePath — routes live under app/jobs/, so URLs are /jobs/* without it.
  // Cloudflare Worker proxies farmcash.app/jobs/* → farmcash-jobs.vercel.app/jobs/*
  cacheComponents: true,
};

export default nextConfig;
