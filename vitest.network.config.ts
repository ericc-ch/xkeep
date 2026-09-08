import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    include: ["**/*.network.test.ts"],
  },
})
