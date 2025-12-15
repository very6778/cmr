import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // Disable unused variable rule for specific files
      "@typescript-eslint/no-unused-vars": [
        "warn", // Change to 'warn' to not error out, or 'off' to disable completely
        {
          argsIgnorePattern: "^_", // Ignore variables starting with '_'
        },
      ],
      // Allow 'any' type explicitly in these files
      "@typescript-eslint/no-explicit-any": "off", // Disable the rule completely for now
      "@typescript-eslint/ban-ts-comment": [
        "warn", // Change to 'warn' to allow @ts-ignore with a warning
        { "ts-ignore": "allow-with-description" },
      ],
    },
  },
];

export default eslintConfig;
