import type { NextConfig } from 'next';
import path from 'node:path';

const API_URL = process.env.API_URL ?? 'http://127.0.0.1:4000';

const nextConfig: NextConfig = {
  // standalone only for Docker images (set DOCKER_BUILD=1 in the Dockerfile)
  output: process.env.DOCKER_BUILD === '1' ? 'standalone' : undefined,
  turbopack: {
    // npm-workspaces monorepo root (where the lockfile + node_modules live)
    root: path.resolve(import.meta.dirname, '../..'),
  },
  async rewrites() {
    // Proxy the API under the same origin: cookies stay simple,
    // and the browser never needs to know where the API lives.
    return [{ source: '/api/:path*', destination: `${API_URL}/api/:path*` }];
  },
};

export default nextConfig;
