import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    ignores: [
      "**/node_modules/",
      "**/.next/",
      "**/dist/",
      "**/.convex/",
      "**/.expo/",
      "**/coverage/",
      "**/.turbo/",
      "**/convex/_generated/",
    ],
  },
);
