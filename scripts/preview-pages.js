import { createReadStream, existsSync, statSync } from "node:fs";
import http from "node:http";
import path, { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import projectConfig from "../project.config.js";

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const docs = path.resolve(currentDirectory, "..", "docs");
const port = Number(process.env.PORT || 4173);
const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8"
};

function resolveRequest(pathname) {
  if (!pathname.startsWith(projectConfig.site.basePath)) return null;
  let relative;
  try {
    relative = decodeURIComponent(pathname.slice(projectConfig.site.basePath.length));
  } catch {
    return null;
  }
  const candidate = path.resolve(docs, relative || "index.html");
  const withinDocs = candidate === docs || candidate.startsWith(`${docs}${path.sep}`);
  if (!withinDocs) return null;
  if (existsSync(candidate) && statSync(candidate).isDirectory()) {
    return path.join(candidate, "index.html");
  }
  return candidate;
}

http
  .createServer((request, response) => {
    const file = resolveRequest(new URL(request.url || "/", "http://local").pathname);
    if (!file || !existsSync(file) || !statSync(file).isFile()) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }
    response.writeHead(200, {
      "Content-Type": contentTypes[path.extname(file)] || "application/octet-stream"
    });
    createReadStream(file).pipe(response);
  })
  .listen(port, "127.0.0.1", () => {
    console.log(`Pages preview: http://127.0.0.1:${port}${projectConfig.site.basePath}`);
  });
