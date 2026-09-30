import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync
} from "node:fs";
import path, { dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import zlib from "node:zlib";

import projectConfig from "../project.config.js";

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const defaultRoot = path.resolve(currentDirectory, "..");
const marker = projectConfig.site.markerPrefix;
const seoStart = `<!-- ${marker}-seo:start -->`;
const seoEnd = `<!-- ${marker}-seo:end -->`;
const pwaUiStart = `<!-- ${marker}-pwa-ui:start -->`;
const pwaUiEnd = `<!-- ${marker}-pwa-ui:end -->`;

function escapeAttribute(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function markerExpression(start, end) {
  return new RegExp(`${escapeRegExp(start)}[\\s\\S]*?${escapeRegExp(end)}`, "g");
}

function walkFiles(directory, relative = "") {
  return readdirSync(path.join(directory, relative), { withFileTypes: true })
    .flatMap((entry) => {
      const next = path.join(relative, entry.name);
      return entry.isDirectory() ? walkFiles(directory, next) : [next];
    })
    .sort();
}

export function apiPageUrl(relativeFile) {
  const route = relativeFile
    .split(path.sep)
    .join("/")
    .replace(/index\.html$/, "");
  return new URL(route, projectConfig.site.pages.api.url).href;
}

function apiTitle(html, relativeFile) {
  if (relativeFile === "index.html") return projectConfig.site.pages.api.title;
  const existing = html.match(/<title>([^<]+)<\/title>/i)?.[1]?.trim();
  if (!existing) throw new Error(`Missing TypeDoc title in ${relativeFile}`);
  const clean = existing.replace(/ \| .*$/, "").replace(/ API Reference$/, "");
  return `${clean} API Reference`;
}

function ensureOneH1(html, title) {
  let seen = false;
  let output = html.replace(
    /<h1(\b[^>]*)>([\s\S]*?)<\/h1>/gi,
    (_match, attributes, content) => {
      if (!seen) {
        seen = true;
        return `<h1${attributes}>${content}</h1>`;
      }
      return `<h2${attributes}>${content}</h2>`;
    }
  );
  if (!seen) {
    const pageTitleHeading =
      /(<div class="tsd-page-title"[^>]*>[\s\S]*?)<h([2-6])(\b[^>]*)>([\s\S]*?)<\/h\2>/i;
    if (pageTitleHeading.test(output)) {
      output = output.replace(pageTitleHeading, "$1<h1$3>$4</h1>");
    } else {
      output = output.replace(/(<main\b[^>]*>)/i, `$1<h1>${escapeAttribute(title)}</h1>`);
    }
  }
  return output;
}

export function transformApiHtml(html, relativeFile) {
  const { pages, theme } = projectConfig.site;
  const social = projectConfig.seo.openGraphImage;
  const title = apiTitle(html, relativeFile);
  const description =
    relativeFile === "index.html"
      ? pages.api.description
      : `TypeScript API reference for ${title.replace(/ API Reference$/, "")} in ${projectConfig.brand.displayName}.`;
  const url = apiPageUrl(relativeFile);
  const depth = relativeFile.split(path.sep).length;
  const assetPrefix = "../".repeat(depth);
  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "TechArticle",
    name: title,
    description,
    url,
    isPartOf: {
      "@type": "WebSite",
      name: projectConfig.brand.displayName,
      url: pages.home.url
    },
    about: projectConfig.seo.software
  });
  const themeScript = `<script>(()=>{try{const s=localStorage.getItem("${theme.storageKey}");const t=/^(light|dark)$/.test(s||"")?s:(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");document.documentElement.dataset.bsTheme=t;document.documentElement.style.colorScheme=t;localStorage.setItem("tsd-theme",t)}catch{}})()</script>`;
  const metadata = [
    seoStart,
    `<meta name="description" content="${escapeAttribute(description)}">`,
    `<link rel="canonical" href="${url}">`,
    `<link rel="icon" href="${projectConfig.assets.faviconUrl}" type="image/svg+xml">`,
    `<link rel="manifest" href="${projectConfig.pwa.manifestUrl}">`,
    `<meta name="theme-color" content="${theme.colorPrimary}" data-theme-color data-theme-color-light="${theme.colorLight}" data-theme-color-dark="${theme.colorDark}">`,
    `<style>:root{--project-theme-primary:${theme.colorPrimary};--project-theme-primary-hover:${theme.primary.light.hover};--project-theme-primary-active:${theme.primary.light.active};--project-theme-primary-soft:${theme.primary.light.soft};--project-theme-primary-rgb:${theme.primary.light.rgb};--project-theme-primary-hover-rgb:${theme.primary.light.hoverRgb};--project-theme-primary-dark:${theme.primary.dark.base};--project-theme-primary-dark-hover:${theme.primary.dark.hover};--project-theme-primary-dark-active:${theme.primary.dark.active};--project-theme-primary-dark-soft:${theme.primary.dark.soft};--project-theme-primary-dark-rgb:${theme.primary.dark.rgb};--project-theme-primary-dark-hover-rgb:${theme.primary.dark.hoverRgb};--project-theme-light:${theme.colorLight};--project-theme-dark:${theme.colorDark}}</style>`,
    themeScript,
    `<link rel="stylesheet" href="${assetPrefix}assets/api.css">`,
    '<meta property="og:type" content="website">',
    `<meta property="og:site_name" content="${escapeAttribute(projectConfig.brand.displayName)}">`,
    `<meta property="og:title" content="${escapeAttribute(title)}">`,
    `<meta property="og:description" content="${escapeAttribute(description)}">`,
    `<meta property="og:url" content="${url}">`,
    `<meta property="og:image" content="${social.url}">`,
    `<meta property="og:image:type" content="${social.type}">`,
    `<meta property="og:image:width" content="${social.width}">`,
    `<meta property="og:image:height" content="${social.height}">`,
    `<meta property="og:image:alt" content="${escapeAttribute(social.alt)}">`,
    '<meta name="twitter:card" content="summary_large_image">',
    `<meta name="twitter:title" content="${escapeAttribute(title)}">`,
    `<meta name="twitter:description" content="${escapeAttribute(description)}">`,
    `<meta name="twitter:image" content="${social.url}">`,
    `<meta name="twitter:image:alt" content="${escapeAttribute(social.alt)}">`,
    `<script type="application/ld+json">${jsonLd}</script>`,
    `<script src="${assetPrefix}assets/api.js" defer></script>`,
    seoEnd
  ].join("");

  let output = html
    .replace(markerExpression(seoStart, seoEnd), "")
    .replace(/<nav class="site-project-links"[\s\S]*?<\/nav>/g, "")
    .replace(markerExpression(pwaUiStart, pwaUiEnd), "")
    .replace(/<title>[^<]*<\/title>/i, `<title>${escapeAttribute(title)}</title>`)
    .replace(/<meta name="description"[^>]*>/i, "")
    .replace(/<link rel="canonical"[^>]*>/i, "")
    .replace(/<link rel="icon"[^>]*>/i, "")
    .replace(/<html\b(?![^>]*data-bs-theme)/i, '<html data-bs-theme="light"')
    .replace("</head>", `${metadata}</head>`);

  const toolbarPattern = /(<div class="tsd-toolbar-contents container"[^>]*>)/i;
  if (!toolbarPattern.test(output)) {
    throw new Error(`Missing TypeDoc toolbar in ${relativeFile}`);
  }
  const links = `<nav class="site-project-links" aria-label="Project links"><a href="${pages.home.url}">Project home</a><a href="${pages.api.url}">API overview</a><a href="${projectConfig.urls.github}">GitHub</a><a href="${projectConfig.urls.npm}">npm package</a><span class="site-pwa-status" role="status" aria-live="polite" data-pwa-status></span><label class="theme-control"><span>Theme</span><select data-theme-select aria-label="Choose API documentation theme"><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></label></nav>`;
  output = output.replace(toolbarPattern, `$1${links}`);
  const updateUi = [
    pwaUiStart,
    '<aside class="site-pwa-update" aria-label="Website update" data-pwa-update hidden>',
    `<span>A new version of the ${escapeAttribute(projectConfig.brand.displayName)} website is available.</span>`,
    '<button type="button" data-pwa-update-now>Update now</button>',
    "</aside>",
    pwaUiEnd
  ].join("");
  output = output.replace("</body>", `${updateUi}</body>`);
  return ensureOneH1(output, title);
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const output = Buffer.alloc(data.length + 12);
  output.writeUInt32BE(data.length, 0);
  typeBuffer.copy(output, 4);
  data.copy(output, 8);
  output.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), data.length + 8);
  return output;
}

function generatePng(width, height, painter) {
  const rowSize = width * 4 + 1;
  const raw = Buffer.alloc(rowSize * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * rowSize] = 0;
    for (let x = 0; x < width; x += 1) {
      const [red, green, blue, alpha = 255] = painter(x, y, width, height);
      const offset = y * rowSize + 1 + x * 4;
      raw[offset] = red;
      raw[offset + 1] = green;
      raw[offset + 2] = blue;
      raw[offset + 3] = alpha;
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0))
  ]);
}

function logoPixel(x, y, width, height, maskable) {
  const nx = x / width;
  const ny = y / height;
  const safe = maskable ? 0.1 : 0;
  if (nx < safe || ny < safe || nx > 1 - safe || ny > 1 - safe) {
    return [246, 248, 245, 255];
  }
  const line = 0.035;
  const upperHorizontal = ny > 0.32 - line && ny < 0.32 + line && nx > 0.23 && nx < 0.72;
  const lowerHorizontal = ny > 0.68 - line && ny < 0.68 + line && nx > 0.28 && nx < 0.77;
  const upperArrow =
    nx > 0.59 && nx < 0.75 && Math.abs(Math.abs(ny - 0.32) - (0.72 - nx)) < line;
  const lowerArrow =
    nx > 0.25 && nx < 0.41 && Math.abs(Math.abs(ny - 0.68) - (nx - 0.28)) < line;
  if (upperHorizontal || lowerHorizontal || upperArrow || lowerArrow) {
    return [255, 255, 255, 255];
  }
  return [23, 107, 73, 255];
}

function writeGeneratedImages(docs) {
  const images = path.join(docs, "images");
  mkdirSync(images, { recursive: true });
  for (const [file, size, maskable] of [
    ["icon-192.png", 192, false],
    ["icon-512.png", 512, false],
    ["icon-maskable-512.png", 512, true]
  ]) {
    writeFileSync(
      path.join(images, file),
      generatePng(size, size, (x, y, width, height) =>
        logoPixel(x, y, width, height, maskable)
      )
    );
  }
  writeFileSync(
    path.join(images, projectConfig.seo.openGraphImage.file),
    generatePng(1200, 630, (x, y, width, height) => {
      const nx = x / width;
      const ny = y / height;
      if (ny > 0.8) return [13, 23, 18, 255];
      if (nx > 0.22 && nx < 0.78 && ny > 0.08 && ny < 0.92) {
        return logoPixel(
          x - width * 0.22,
          y - height * 0.08,
          width * 0.56,
          height * 0.84,
          false
        );
      }
      return [23, 107, 73, 255];
    })
  );
}

function contentFingerprint(docs) {
  const hash = createHash("sha256");
  walkFiles(docs)
    .filter((file) => file !== "service-worker.js" && !file.endsWith(".map"))
    .forEach((file) => {
      hash.update(file);
      hash.update(readFileSync(path.join(docs, file)));
    });
  return hash.digest("hex").slice(0, 16);
}

function apiAppShellAssets(html) {
  const assets = new Set();
  for (const match of html.matchAll(/<(link|script|use)\b[^>]*>/gi)) {
    const reference = match[0].match(/\b(?:src|href)=["']([^"']+)["']/i)?.[1];
    if (!reference) continue;
    const url = new URL(reference, projectConfig.site.pages.api.url);
    if (
      url.origin === new URL(projectConfig.site.url).origin &&
      url.pathname.startsWith(projectConfig.site.basePath)
    ) {
      assets.add(`${url.pathname}${url.search}`);
    }
  }
  return [...assets].sort();
}

export function buildPages({ rootDir = defaultRoot } = {}) {
  const dist = path.join(rootDir, "dist-dev");
  const typedoc = path.join(rootDir, ".pages-api");
  const docs = path.join(rootDir, "docs");
  const workerSource = path.join(rootDir, "site", "service-worker.js");
  const required = [
    dist,
    typedoc,
    workerSource,
    path.join(rootDir, "images", projectConfig.assets.logoFile),
    path.join(dist, "index.html"),
    path.join(dist, "examples", "index.html"),
    path.join(dist, "assets", "api.css"),
    path.join(dist, "assets", "api.js")
  ];
  for (const target of required) {
    if (!existsSync(target))
      throw new Error(`Required Pages source is missing: ${target}`);
  }

  rmSync(docs, { recursive: true, force: true });
  cpSync(dist, docs, { recursive: true });
  cpSync(typedoc, path.join(docs, "api"), { recursive: true });
  writeGeneratedImages(docs);

  const api = path.join(docs, "api");
  rmSync(path.join(api, "sitemap.xml"), { force: true });
  walkFiles(api)
    .filter((file) => file.endsWith(".html"))
    .forEach((relativeFile) => {
      const file = path.join(api, relativeFile);
      writeFileSync(file, transformApiHtml(readFileSync(file, "utf8"), relativeFile));
    });

  const manifest = {
    name: projectConfig.pwa.name,
    short_name: projectConfig.pwa.shortName,
    description: projectConfig.pwa.description,
    id: projectConfig.site.basePath,
    start_url: projectConfig.site.basePath,
    scope: projectConfig.site.basePath,
    display: projectConfig.pwa.display,
    background_color: projectConfig.pwa.backgroundColor,
    theme_color: projectConfig.pwa.themeColor,
    icons: projectConfig.pwa.icons.map(({ file: _file, ...icon }) => icon)
  };
  writeFileSync(
    path.join(docs, "manifest.webmanifest"),
    `${JSON.stringify(manifest, null, 2)}\n`
  );
  writeFileSync(
    path.join(docs, "robots.txt"),
    `User-agent: *\nAllow: /\n\nSitemap: ${projectConfig.urls.sitemap}\n`
  );
  const routes = Object.values(projectConfig.site.pages).map((page) => page.url);
  writeFileSync(
    path.join(docs, "sitemap.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${routes.map((url) => `  <url><loc>${escapeAttribute(url)}</loc></url>`).join("\n")}\n</urlset>\n`
  );
  writeFileSync(path.join(docs, ".nojekyll"), "");

  const apiAssets = apiAppShellAssets(readFileSync(path.join(api, "index.html"), "utf8"));
  const shell = [
    projectConfig.site.basePath,
    `${projectConfig.site.basePath}examples/`,
    `${projectConfig.site.basePath}api/`,
    projectConfig.pwa.manifestUrl,
    `${projectConfig.site.basePath}assets/shared.css`,
    `${projectConfig.site.basePath}assets/shared.js`,
    `${projectConfig.site.basePath}assets/home.js`,
    `${projectConfig.site.basePath}assets/examples.js`,
    `${projectConfig.site.basePath}assets/api.css`,
    `${projectConfig.site.basePath}assets/api.js`,
    `${projectConfig.site.basePath}images/${projectConfig.assets.logoFile}`,
    ...projectConfig.pwa.icons.map((icon) => icon.src),
    ...apiAssets
  ];
  for (const asset of shell) {
    const url = new URL(asset, projectConfig.site.url);
    const relative = decodeURIComponent(
      url.pathname.slice(projectConfig.site.basePath.length)
    );
    if (relative && !existsSync(path.join(docs, relative))) {
      throw new Error(`Service worker app-shell asset is missing: ${asset}`);
    }
  }
  const worker = readFileSync(workerSource, "utf8")
    .replaceAll("__BASE_PATH__", projectConfig.site.basePath)
    .replaceAll("__CACHE_PREFIX__", projectConfig.pwa.cachePrefix)
    .replaceAll(
      "__CACHE_NAME__",
      `${projectConfig.pwa.cachePrefix}${contentFingerprint(docs)}`
    )
    .replace("__APP_SHELL__", JSON.stringify([...new Set(shell)]));
  writeFileSync(path.join(docs, "service-worker.js"), worker);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  buildPages();
}
