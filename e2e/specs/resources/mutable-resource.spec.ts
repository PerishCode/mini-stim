import { readFile } from "node:fs/promises";
import { mutableResource, outputPath, testNamespace, writeOutput } from "@e2e/lib/resource";
import { expect, test } from "@playwright/test";

test("copies static resources into an isolated per-test output namespace", async ({
  request: _request,
}, testInfo) => {
  const copy = await mutableResource(testInfo, "payloads/send-text.json");
  const contents = await readFile(copy, "utf8");

  expect(contents).toContain("E2E_RESOURCE_PAYLOAD");
  expect(copy).toContain(testNamespace(testInfo));
  expect(copy).toContain("/.tmp/e2e-results/");
});

test("writes generated artifacts under the Playwright output directory", async ({
  request: _request,
}, testInfo) => {
  const artifact = await writeOutput(testInfo, "artifacts/result.txt", "ok");

  await expect(readFile(artifact, "utf8")).resolves.toBe("ok");
  expect(artifact).toBe(outputPath(testInfo, "artifacts/result.txt"));
});
