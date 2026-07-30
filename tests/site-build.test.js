import { describe, expect, it } from "vitest";

import projectConfig from "../project.config.js";
import { apiPageUrl, transformApiHtml } from "../scripts/build-pages.js";

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
  it("adds metadata, project links, PWA controls, and exactly one h1", () => {
    const transformed = transformApiHtml(typedocHtml, "index.html");

    expect(transformed).toContain(
      `<link rel="canonical" href="${projectConfig.site.pages.api.url}">`
    );
    expect(transformed).toContain('class="site-project-links"');
    expect(transformed).toContain("data-pwa-update-now");
    expect(transformed.match(/<h1\b/g)).toHaveLength(1);
  });

  it("is idempotent", () => {
    const once = transformApiHtml(typedocHtml, "index.html");
    expect(transformApiHtml(once, "index.html")).toBe(once);
  });
});
