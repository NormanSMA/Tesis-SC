import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/**/*.{ts,tsx}", "prisma/seed/**/*.ts", "tests/**/*.ts", "e2e/**/*.ts"],
    rules: {
      "max-lines": ["error", { max: 500, skipBlankLines: true, skipComments: true }],
      "max-lines-per-function": [
        "error",
        { max: 50, skipBlankLines: true, skipComments: true, IIFEs: true },
      ],
      "max-params": ["warn", 3],
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
  {
    files: ["src/components/ui/**", "prisma/seed/datos/**", "tests/**", "e2e/**"],
    rules: { "max-lines-per-function": "off" },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "audit/**",
    "src/generated/**",
    // Íconos de lucide-animated (MIT) copiados tal cual: no se reformatean para poder actualizarlos.
    "src/components/iconos-animados/**",
  ]),
]);

export default eslintConfig;
