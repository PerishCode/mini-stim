import { readJsonResource, readTextResource, resourcePath, resourceUrl } from "@e2e/lib/resource";
import { expect, test } from "@playwright/test";

test("reads typed payload resources through the resource API", async () => {
  const payload = await readJsonResource<{
    content: Array<{ type: string; text: string }>;
  }>("payloads/send-text.json");

  expect(payload.content).toEqual([{ type: "text", text: "E2E_RESOURCE_PAYLOAD" }]);
});

test("resolves static resources without exposing spec-local paths", async () => {
  await expect(readTextResource("html/minimal.html")).resolves.toContain('data-fixture="minimal"');
  expect(resourcePath("html/minimal.html")).toContain("/e2e/resources/html/");
  expect(resourceUrl("html/minimal.html")).toMatch(/^file:\/\//);
});

test("rejects resource paths outside the resources directory", () => {
  expect(() => resourcePath("../package.json")).toThrow(/escapes resources root/);
  expect(() => resourcePath("/tmp/file.json")).toThrow(/relative POSIX paths/);
  expect(() => resourcePath("payloads\\send-text.json")).toThrow(/relative POSIX paths/);
});
