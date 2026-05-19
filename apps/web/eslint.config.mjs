import { FlatCompat } from "@eslint/eslintrc";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import tseslint from "typescript-eslint";

const compat = new FlatCompat({
  baseDirectory: dirname(fileURLToPath(import.meta.url))
});

export default tseslint.config(
  {
    ignores: [".next/**", "coverage/**"]
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  ...tseslint.configs.recommended
);
