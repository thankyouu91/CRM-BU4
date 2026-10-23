// ESLint flat config (ESLint CLI; `next lint` is removed in Next.js 16).
// eslint-config-next ships flat configs since Next.js 16.
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const config = defineConfig([
  ...nextVitals,
  ...nextTypescript,
  // .claude/: local tool data (agent worktrees are full checkouts with their own builds).
  globalIgnores([".claude/**", "node_modules/**", ".next/**", ".open-next/**", ".wrangler/**", ".wrangler-dry-run/**", ".release/**", "next-env.d.ts", "cloudflare-env.d.ts"]),
]);

export default config;
