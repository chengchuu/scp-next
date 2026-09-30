import {
  cpSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, URL } from "node:url";
import { describe, expect, it } from "vitest";

import projectConfig from "../project.config.js";
import { apiPageUrl, buildPages, transformApiHtml } from "../scripts/build-pages.js";

const typedocHtml = `<!doctype html>
<html><head><title>scp-next</title></head>
<body><header><div class="tsd-toolbar-contents container"></div></header>
<main><div class="tsd-page-title"><h2>scp-next</h2></div>
<h1>README</h1></main></body></html>`;

describe("website project configuration", () => {
  it("keeps stable routes and PWA scope below the Pages base", () => {
    expect(projectConfig.site.basePath).toBe("/scp-next/");
    expect(projectConfig.site.pages.examples.url).toBe(
      "https://chengchuu.github.io/scp-next/examples/"
    );
    expect(projectConfig.site.pages.api.url).toBe(
      "https://chengchuu.github.io/scp-next/api/"
    );
    expect(projectConfig.pwa.serviceWorkerUrl).toBe("/scp-next/service-worker.js");
    expect(Object.isFrozen(projectConfig.site)).toBe(true);
  });

  it("derives unique API subpage canonicals", () => {
    expect(apiPageUrl("classes/ScpNextClientImpl.html")).toBe(
      "https://chengchuu.github.io/scp-next/api/classes/ScpNextClientImpl.html"
    );
  });
});

describe("TypeDoc HTML transformation", () => {
  it("uses bundled README branding without rewriting external images", () => {
    const input = typedocHtml.replace(
      "</main>",
      '<img src="https://chengchuu.github.io/scp-next/images/scp-next-logo-512x512.png" width="96" height="96" alt="scp-next logo"><img src="https://example.com/badge.svg"></main>'
    );
    const once = transformApiHtml(input, "index.html");
    expect(once).toContain('src="/scp-next/images/scp-next-logo-512x512.png"');
    expect(once).toContain('src="https://example.com/badge.svg"');
    expect(transformApiHtml(once, "index.html")).toBe(once);
  });

  it("adds metadata, project links, PWA controls, and exactly one h1", () => {
    const transformed = transformApiHtml(typedocHtml, "index.html");

    expect(transformed).toContain(
      `<link rel="canonical" href="${projectConfig.site.pages.api.url}">`
    );
    expect(transformed).toContain('class="site-project-links"');
    expect(transformed).not.toMatch(/data-pwa-update|site-pwa-update/);
    expect(transformed.match(/<h1\b/g)).toHaveLength(1);
  });

  it("is idempotent", () => {
    const input = typedocHtml.replace(
      "</head>",
      '<link rel="apple-touch-icon" href="old.png"></head>'
    );
    const once = transformApiHtml(input, "index.html");
    expect(transformApiHtml(once, "index.html")).toBe(once);
    expect(once.match(/rel="apple-touch-icon"/g)).toHaveLength(1);
    expect(once.match(/rel="icon"/g)).toHaveLength(1);
    expect(once).toContain(
      `href="${projectConfig.assets.faviconUrl}" type="image/png" sizes="32x32"`
    );
    expect(once).toContain(
      `href="${projectConfig.assets.appleTouchIconUrl}" sizes="180x180"`
    );
    expect(once).toContain('property="og:image:type" content="image/jpeg"');
    expect(once).toContain(projectConfig.seo.openGraphImage.url);
  });
});

describe("Pages branding assets", () => {
  it("preserves supplied bytes, manifest mappings, and offline icon URLs", () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "scp-next-branding-"));
    const source = fileURLToPath(new URL("../", import.meta.url));
    const files = [
      "scp-next-logo-32x32.png",
      "scp-next-logo-192x192.png",
      "scp-next-logo-512x512.png",
      "scp-next-logo-maskable-512x512.png",
      "scp-next-logo-apple-touch-180x180.png",
      "scp-next-logo-open-graph-1200x630.jpg"
    ];
    try {
      for (const dir of [
        "dist-dev/assets",
        "dist-dev/images",
        "dist-dev/examples",
        ".pages-api",
        "site"
      ]) {
        mkdirSync(path.join(root, dir), { recursive: true });
      }
      for (const file of files)
        cpSync(
          path.join(source, "images", file),
          path.join(root, "dist-dev/images", file)
        );
      for (const file of [
        "shared.css",
        "shared.js",
        "home.js",
        "examples.js",
        "api.css",
        "api.js"
      ]) {
        writeFileSync(path.join(root, "dist-dev/assets", file), "");
      }
      for (const file of [
        "dist-dev/index.html",
        "dist-dev/examples/index.html",
        ".pages-api/index.html"
      ]) {
        writeFileSync(path.join(root, file), typedocHtml);
      }
      cpSync(
        path.join(source, "site/service-worker.js"),
        path.join(root, "site/service-worker.js")
      );
      buildPages({ rootDir: root });
      for (const file of files) {
        expect(readFileSync(path.join(root, "docs/images", file))).toEqual(
          readFileSync(path.join(source, "images", file))
        );
      }
      const manifest = JSON.parse(
        readFileSync(path.join(root, "docs/manifest.webmanifest"), "utf8")
      );
      expect(manifest.icons).toEqual([
        {
          src: "/scp-next/images/scp-next-logo-192x192.png",
          sizes: "192x192",
          type: "image/png",
          purpose: "any"
        },
        {
          src: "/scp-next/images/scp-next-logo-512x512.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "any"
        },
        {
          src: "/scp-next/images/scp-next-logo-maskable-512x512.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "maskable"
        }
      ]);
      const worker = readFileSync(path.join(root, "docs/service-worker.js"), "utf8");
      expect(worker).toContain(projectConfig.assets.faviconUrl);
      expect(worker).toContain(projectConfig.assets.appleTouchIconUrl);
      expect(worker).not.toContain("/images/logo.svg");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
