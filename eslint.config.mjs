export default [
  {
    ignores: [
      ".output/**",
      ".nitro/**",
      ".tanstack/**",
      ".wrangler/**",
      ".vinxi/**",
      "dist/**",
      "dist-ssr/**",
      "node_modules/**",
      "src/routeTree.gen.ts",
    ],
  },
  {
    files: ["**/*.{js,mjs,cjs}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
    },
    rules: {
      "no-console": "off",
      "no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
    },
  },
];