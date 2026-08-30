import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // The renderer is a local tool driven by Puppeteer, not a deployed site.
  reactStrictMode: false, // StrictMode double-invokes effects, which would run
                          // the measure->paginate->draw machine twice per render.
};

export default nextConfig;
