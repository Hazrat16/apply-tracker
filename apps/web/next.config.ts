import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Self-contained server bundle for the Docker image (apps/web/Dockerfile).
  output: 'standalone',
  // Monorepo: trace dependencies from the repository root (e.g. packages/shared).
  outputFileTracingRoot: fileURLToPath(new URL('../../', import.meta.url)),
  // `/api/*` is forwarded to the NestJS API by src/proxy.ts (at request time, so one build
  // works with any API_URL — next.config rewrites are fixed when the app is built).
};

export default nextConfig;
