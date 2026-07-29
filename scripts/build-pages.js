import { cpSync, existsSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function buildPages({ rootDir = defaultRoot } = {}) {
  const site = path.join(rootDir, "site");
  const docs = path.join(rootDir, "docs");
  const index = path.join(site, "index.html");

  if (!existsSync(index)) throw new Error(`Missing Pages source: ${index}`);

  rmSync(docs, { recursive: true, force: true });
  cpSync(site, docs, { recursive: true });
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  buildPages();
}
