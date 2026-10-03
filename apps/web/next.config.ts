import type { NextConfig } from 'next';

// Server-side address of the NestJS API. The browser never calls it directly:
// `/api/*` is proxied, so auth cookies are first-party and no CORS is needed.
const API_URL = process.env.API_URL ?? 'http://localhost:4000';

const nextConfig: NextConfig = {
  reactCompiler: true,
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${API_URL}/api/:path*` }];
  },
};

export default nextConfig;
