import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The end-to-end suite builds while a developer's `next dev` is usually
  // running, and both write to `.next` — which contends badly and can hang
  // the build indefinitely. Playwright sets NEXT_DIST_DIR so its build has
  // its own directory and the two never meet.
  //
  // Unset everywhere else, including on Vercel, where it must resolve to the
  // default `.next` or the platform will not find the build output.
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
}

export default nextConfig
