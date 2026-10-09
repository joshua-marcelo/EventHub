import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Local AI/design tooling folders (git-ignored, not app code):
    ".agent/**",
    ".agents/**",
    ".claude/**",
    ".codex/**",
    ".gemini/**",
    ".pixel-agents/**",
    ".impeccable/**",
  ]),
]);

export default eslintConfig;
