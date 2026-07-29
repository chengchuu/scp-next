import { existsSync, readFileSync, readdirSync } from "node:fs";
import path, { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import projectConfig from "../project.config.js";

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const docs = path.resolve(currentDirectory, "..", "docs");
const failures = [];

function read(relativePath) {
  const file = path.join(docs, relativePath);
  if (!existsSync(file)) {
    failures.push(`Missing ${relativePath}`);
    return "";
  }
  return readFileSync(file, "utf8");
}

function count(html, pattern) {
  return [...html.matchAll(pattern)].length;
}

function walkFiles(directory, relative = "") {
  return readdirSync(path.join(directory, relative), { withFileTypes: true })
    .flatMap((entry) => {
      const next = path.join(relative, entry.name);
      return entry.isDirectory() ? walkFiles(directory, next) : [next];
    })
    .sort();
}

function validatePage(relativePath, page) {
  const html = read(relativePath);
  const checks = [
    [html.includes(`<title>${page.title}</title>`), "title"],
    [/<meta name="description" content="[^"]+">?/.test(html), "description"],
    [html.includes(`<link rel="canonical" href="${page.url}"`), "canonical"],
    [html.includes('property="og:type"'), "Open Graph type"],
    [html.includes('property="og:site_name"'), "Open Graph site name"],
    [html.includes('property="og:title"'), "Open Graph title"],
    [html.includes('property="og:description"'), "Open Graph description"],
    [html.includes(`property="og:url" content="${page.url}"`), "Open Graph URL"],
    [html.includes('name="twitter:card"'), "Twitter card"],
    [html.includes('type="application/ld+json"'), "JSON-LD"],
    [html.includes('rel="icon"'), "favicon"],
    [html.includes('rel="manifest"'), "manifest"],
    [html.includes('name="theme-color"'), "theme color"],
    [count(html, /<h1\b/gi) === 1, "exactly one h1"]
  ];
  checks.forEach(([passed, label]) => {
    if (!passed) failures.push(`${relativePath}: missing or invalid ${label}`);
  });
}

validatePage("index.html", projectConfig.site.pages.home);
validatePage("examples/index.html", projectConfig.site.pages.examples);
validatePage("api/index.html", projectConfig.site.pages.api);

const apiFiles = walkFiles(path.join(docs, "api"))
  .filter((file) => file.endsWith(".html"))
  .map((file) => path.join("api", file));
const canonicalUrls = [];
for (const relativePath of apiFiles) {
  const html = read(relativePath);
  const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
  if (!canonical) failures.push(`${relativePath}: canonical URL is missing`);
  else canonicalUrls.push(canonical);
  if (!/<title>[^<]+<\/title>/.test(html)) {
    failures.push(`${relativePath}: title is missing`);
  }
  if (!/<meta name="description" content="[^"]+">/.test(html)) {
    failures.push(`${relativePath}: description is missing`);
  }
  if (count(html, /<h1\b/gi) !== 1) {
    failures.push(`${relativePath}: expected exactly one h1`);
  }
}
if (new Set(canonicalUrls).size !== canonicalUrls.length) {
  failures.push("API documentation contains duplicate canonical URLs");
}

const robots = read("robots.txt");
if (!robots.includes(`Sitemap: ${projectConfig.urls.sitemap}`)) {
  failures.push("robots.txt: sitemap URL is missing or incorrect");
}

const sitemap = read("sitemap.xml");
if (
  !sitemap.startsWith('<?xml version="1.0" encoding="UTF-8"?>') ||
  !sitemap.includes('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"')
) {
  failures.push("sitemap.xml: invalid XML header or urlset");
}
const locations = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
const expectedLocations = Object.values(projectConfig.site.pages).map((page) => page.url);
if (
  locations.length !== expectedLocations.length ||
  new Set(locations).size !== locations.length ||
  expectedLocations.some((url) => !locations.includes(url))
) {
  failures.push("sitemap.xml: stable canonical routes are incomplete or duplicated");
}

for (const relativePath of ["index.html", "examples/index.html", ...apiFiles]) {
  const html = read(relativePath);
  const pageRoute = relativePath.replace(/index\.html$/, "");
  const pageUrl = new URL(pageRoute, projectConfig.site.url);
  const references = [...html.matchAll(/(?:href|src)="([^"]+)"/g)].map(
    (match) => match[1]
  );
  for (const reference of references) {
    if (
      !reference ||
      reference.startsWith("#") ||
      /^(?:data|mailto|tel|javascript):/.test(reference)
    ) {
      continue;
    }
    const target = new URL(reference, pageUrl);
    if (target.origin !== new URL(projectConfig.site.url).origin) continue;
    if (!target.pathname.startsWith(projectConfig.site.basePath)) {
      failures.push(`${relativePath}: path escapes Pages base: ${reference}`);
      continue;
    }
    let artifactPath = decodeURIComponent(
      target.pathname.slice(projectConfig.site.basePath.length)
    );
    if (!artifactPath || artifactPath.endsWith("/")) {
      artifactPath = path.join(artifactPath, "index.html");
    }
    if (!existsSync(path.join(docs, artifactPath))) {
      failures.push(`${relativePath}: unresolved local reference ${reference}`);
    }
  }
}

if (failures.length) {
  throw new Error(`SEO validation failed:\n- ${failures.join("\n- ")}`);
}

console.log("SEO validation passed for home, examples, API, robots, and sitemap.");
