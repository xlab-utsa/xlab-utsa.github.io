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
    ],
  },
];

export default eslintConfig;
