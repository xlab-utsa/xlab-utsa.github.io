import type { NextConfig } from "next";
import path from "path";

import { BASE_PATH } from "./lib/base-path";

// The repo `xlab-utsa/xlab-utsa.github.io` sits in an org whose name matches it, so
// GitHub Pages serves it as an organization ROOT site at https://xlab-utsa.github.io/ —
// BASE_PATH is "" and nothing needs a path prefix. These two keys are kept (rather than
// dropped) so that a future move back under a subpath is a one-line change in
// lib/base-path.ts, which is the only place the value is defined.
const nextConfig: NextConfig = {
  output: "export",
  basePath: BASE_PATH,
  assetPrefix: BASE_PATH,

  // Emit route/index.html instead of route.html so nested static routes
  // (e.g. /blog/<slug>) resolve unambiguously as directories on GitHub Pages.
  trailingSlash: true,

  // Static export can't use the default Next.js image optimization API (no
  // server to run it). Images are served as-is from public/.
  images: {
    unoptimized: true,
  },

  // Pin the workspace root to this directory. labbench/schema-visualizer has
  // its own package.json + lockfile, which would otherwise make Next.js guess
  // the wrong monorepo root and warn/misbehave.
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
