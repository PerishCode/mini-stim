import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./specs",
  testMatch: "**/*.spec.ts",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: process.env.CI ? "50%" : undefined,
  outputDir: "../.tmp/e2e-results",
  reporter: process.env.CI ? "github" : "list",
  use: {
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
});
