import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.{test,spec}.{js,jsx,ts,tsx,mjs,cjs}"],
    exclude: ["**/node_modules/**", "**/.venv/**", "**/dist/**"],
  },
});
