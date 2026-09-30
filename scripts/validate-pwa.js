import { existsSync, readFileSync } from "node:fs";
import path, { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

import projectConfig from "../project.config.js";

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const docs = path.resolve(currentDirectory, "..", "docs");
const failures = [];

function read(relativePath) {
  const file = path.join(docs, relativePath);
  if (!existsSync(file)) {
    failures.push(`Missing ${relativePath}`);
    return Buffer.alloc(0);
  }
  return readFileSync(file);
}

export function pngDimensions(buffer) {
  if (buffer.length < 24 || buffer.toString("ascii", 1, 4) !== "PNG") {
    return null;
  }
  return [buffer.readUInt32BE(16), buffer.readUInt32BE(20)];
}

let manifest;
try {
  manifest = JSON.parse(read("manifest.webmanifest").toString("utf8"));
} catch {
  failures.push("manifest.webmanifest is not valid JSON");
}

if (manifest) {
  for (const field of ["id", "start_url", "scope"]) {
    if (manifest[field] !== projectConfig.site.basePath) {
      failures.push(`manifest ${field} does not match the Pages base path`);
    }
  }
  if (
    manifest.name !== projectConfig.pwa.name ||
    manifest.short_name !== projectConfig.pwa.shortName
  ) {
    failures.push("manifest identity does not match project configuration");
  }
  const required = new Map([
    ["192x192:any", [192, 192]],
    ["512x512:any", [512, 512]],
    ["512x512:maskable", [512, 512]]
  ]);
  for (const icon of manifest.icons ?? []) {
    const key = `${icon.sizes}:${icon.purpose}`;
    if (!required.has(key)) continue;
    const relativePath = icon.src.replace(projectConfig.site.basePath, "");
    const actual = pngDimensions(read(relativePath));
    const expected = required.get(key);
    if (!actual || actual[0] !== expected[0] || actual[1] !== expected[1]) {
      failures.push(`${relativePath} is not the expected PNG size`);
    }
    required.delete(key);
  }
  required.forEach((_dimensions, key) => {
    failures.push(`manifest is missing required icon ${key}`);
  });
}

for (const page of ["index.html", "examples/index.html", "api/index.html"]) {
  const html = read(page).toString("utf8");
  if (!html.includes(`href="${projectConfig.pwa.manifestUrl}"`)) {
    failures.push(`${page}: manifest link is missing`);
  }
  if (!html.includes('name="theme-color"')) {
    failures.push(`${page}: theme-color metadata is missing`);
  }
}

const worker = read("service-worker.js").toString("utf8");
try {
  new vm.Script(worker, { filename: "service-worker.js" });
} catch (error) {
  failures.push(`service-worker.js has invalid syntax: ${error.message}`);
}
if (/__(?:BASE_PATH|CACHE_PREFIX|CACHE_NAME|APP_SHELL)__/.test(worker)) {
  failures.push("service-worker.js contains unreplaced build tokens");
}
if (!worker.includes(`const PROJECT_BASE = "${projectConfig.site.basePath}"`)) {
  failures.push("service-worker.js scope guard does not match the Pages base");
}
if (!worker.includes('event.data?.type === "SKIP_WAITING"')) {
  failures.push("service-worker.js lacks explicit update activation handling");
}
if (!worker.includes("matchCurrentCache(PROJECT_BASE)")) {
  failures.push("service-worker.js navigation fallback is not the precached root");
}
const shellMatch = worker.match(/const APP_SHELL = (\[[^;]+\]);/);
let appShell = [];
try {
  appShell = JSON.parse(shellMatch?.[1] ?? "");
} catch {
  failures.push("service-worker.js app shell is missing or invalid");
}
for (const route of [
  projectConfig.site.basePath,
  `${projectConfig.site.basePath}examples/`,
  `${projectConfig.site.basePath}api/`
]) {
  if (!appShell.includes(route)) {
    failures.push(`service-worker.js app shell is missing ${route}`);
  }
}

if (failures.length) {
  throw new Error(`PWA validation failed:\n- ${failures.join("\n- ")}`);
}

console.log("PWA validation passed for manifest, icons, pages, and service worker.");
