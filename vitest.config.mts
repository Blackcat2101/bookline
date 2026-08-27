import path from "node:path";
import { defineConfig } from "vitest/config";
import { config as loadEnv } from "dotenv";

const root = import.meta.dirname;
const { parsed } = loadEnv({ path: path.resolve(root, ".env.test") });

export default defineConfig({
  test: {
    environment: "node",
    globalSetup: ["./tests/global-setup.ts"],
    env: parsed,
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(root, "."),
      "server-only": path.resolve(root, "tests/server-only-stub.ts"),
    },
  },
});
