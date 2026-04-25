import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // No basePath — routes live under app/jobs/, so URLs are /jobs/* without it.
  // Cloudflare Worker proxies farmcash.app/jobs/* → farmcash-jobs.vercel.app/jobs/*
  //
  // assetPrefix: Cloudflare only proxies /jobs/* — so /_next/static/* requests from
  // farmcash.app would 404 without this. Pointing assets at the Vercel origin directly
  // ensures CSS/JS load regardless of the Cloudflare routing rules.
  assetPrefix: "https://farmcash-jobs.vercel.app",
  cacheComponents: true,
};

export default nextConfig;
