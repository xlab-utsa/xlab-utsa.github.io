import nextConfig from "eslint-config-next";

const eslintConfig = [
  ...nextConfig,
  {
    ignores: [
      "labbench/**",
      // Cloudflare Worker — targets the Workers runtime with its own tsconfig and
      // toolchain, same footing as labbench/. Never part of the root Next.js build.
      "workers/**",
      "out/**",
      ".next/**",
      // Editor/agent worktree copies of this repo that may sit inside it locally. Linting
      // them double-counts every file and reports problems that are not in this checkout.
      ".kilo/**",
      ".claude/**",
    ],
  },
];

export default eslintConfig;
