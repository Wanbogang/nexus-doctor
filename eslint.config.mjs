export default [
  {
    files: ["**/*.js", "**/*.mjs"],
    ignores: ["**/node_modules/**", "**/*.bak", ".devcontainer/**", ".github/**"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module"
    },
    rules: {
      "no-var": "error",
      "prefer-const": "warn"
    }
  }
];
