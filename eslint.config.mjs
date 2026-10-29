// ESLint flat config (ESLint CLI; `next lint` is removed in Next.js 16).
// eslint-config-next ships flat configs since Next.js 16.
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const config = defineConfig([
  ...nextVitals,
  ...nextTypescript,
  {
    // React Compiler rules added by eslint-plugin-react-hooks 7 (eslint-config-next 16).
    // The compiler is not enabled and existing components predate these rules; the other
    // compiler rules, rules-of-hooks and exhaustive-deps still apply.
    rules: {
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/purity": "off",
      "react-hooks/refs": "off",
      "react-hooks/preserve-manual-memoization": "off",
    },
  },
  // .claude/: local tool data (agent worktrees are full checkouts with their own builds).
  // petdex/ and public/ta-tua/game/: the vendored Petdex game, plain JavaScript with its own style.
  globalIgnores(["petdex/**", "public/ta-tua/game/**", ".claude/**", "node_modules/**", ".next/**", ".open-next/**", ".wrangler/**", ".wrangler-dry-run/**", ".release/**", "next-env.d.ts", "cloudflare-env.d.ts"]),
]);

export default config;
