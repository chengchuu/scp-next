import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      ".pages-api/**",
      "dist/**",
      "dist-dev/**",
      "docs/**",
      "coverage/**",
      "lib/**",
      "node_modules/**",
      "temp/**",
      "scripts/**",
      "examples/commonjs/**"
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname
      }
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/consistent-type-imports": "error"
    }
  },
  {
    files: ["site/**/*.ts"],
    languageOptions: {
      parserOptions: {
        projectService: false,
        project: "./tsconfig.site.json",
        tsconfigRootDir: import.meta.dirname
      }
    }
  },
  {
    files: ["**/*.js"],
    extends: [tseslint.configs.disableTypeChecked]
  },
  {
    files: ["eslint.config.js"],
    extends: [tseslint.configs.disableTypeChecked]
  }
);
