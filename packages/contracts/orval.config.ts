import { defineConfig } from "orval";

export default defineConfig({
  contracts: {
    input: {
      target: "./openapi.json",
    },
    output: {
      target: "./src/openapi.ts",
      client: "fetch",
      mode: "single",
    },
  },
});
