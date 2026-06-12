import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, normalize, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import type { TestInfo } from "@playwright/test";

const here = dirname(fileURLToPath(import.meta.url));

export const e2eRoot = resolve(here, "..");
export const repoRoot = resolve(e2eRoot, "..");
export const resourcesRoot = resolve(e2eRoot, "resources");

export function resourcePath(path: string): string {
  return containedPath(resourcesRoot, path);
}

export function resourceUrl(path: string): string {
  return pathToFileURL(resourcePath(path)).href;
}

export async function readTextResource(path: string): Promise<string> {
  return readFile(resourcePath(path), "utf8");
}

export async function readJsonResource<T>(path: string): Promise<T> {
  return JSON.parse(await readTextResource(path)) as T;
}

export function testNamespace(testInfo: TestInfo): string {
  return [
    testInfo.project.name,
    ...testInfo.titlePath.slice(1),
  ]
    .join("_")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 160);
}

export function outputPath(testInfo: TestInfo, path: string): string {
  return testInfo.outputPath(...path.split("/"));
}

export async function mutableResource(
  testInfo: TestInfo,
  sourcePath: string,
  outputName = sourcePath.split("/").at(-1) ?? "resource",
): Promise<string> {
  const destination = outputPath(
    testInfo,
    join("resources", testNamespace(testInfo), outputName),
  );
  await mkdir(dirname(destination), { recursive: true });
  await copyFile(resourcePath(sourcePath), destination);
  return destination;
}

export async function writeOutput(
  testInfo: TestInfo,
  path: string,
  contents: string,
): Promise<string> {
  const destination = outputPath(testInfo, path);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, contents);
  return destination;
}

function containedPath(root: string, path: string): string {
  if (path.startsWith("/") || path.includes("\\")) {
    throw new Error(`Resource paths must be relative POSIX paths: ${path}`);
  }
  const resolved = resolve(root, normalize(path));
  const rel = relative(root, resolved);
  if (rel === "" || (!rel.startsWith("..") && rel !== ".." && !rel.includes(`..${sep}`))) {
    return resolved;
  }
  throw new Error(`Resource path escapes resources root: ${path}`);
}
