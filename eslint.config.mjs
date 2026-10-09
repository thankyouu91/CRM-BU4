// ESLint flat config (ESLint CLI; `next lint` is removed in Next.js 16).
// FlatCompat loads Next's shareable configs, which still ship in the eslintrc format.
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

const config = [
  { ignores: ["node_modules/**", ".next/**", ".open-next/**", ".wrangler/**", "next-env.d.ts", "cloudflare-env.d.ts"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
];

export default config;
