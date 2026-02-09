import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/client/creem-api.ts", "src/types.ts"],
      exclude: [
        "src/**/*.test.ts",
        "src/__tests__/**",
        "src/component/**",
        "src/react/**",
        "src/client/index.ts",
      ],
    },
  },
});
