import { defineConfig } from "orval";

export default defineConfig({
  contracts: {
    input: {
      target: "./packages/contracts/openapi.json",
    },
    output: {
      target: "./packages/contracts/src/openapi.ts",
      client: "fetch",
      mode: "single",
      prettier: true,
    },
  },
});
