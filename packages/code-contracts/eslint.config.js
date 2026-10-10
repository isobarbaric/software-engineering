import eslint from "@eslint/js";

export default [
  eslint.configs.recommended,
  {
    files: ["bin/**/*.js", "src/**/*.js", "tests/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        process: "readonly",
        URL: "readonly",
      },
    },
    rules: {
      "no-console": "error",
    },
  },
];
