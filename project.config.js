import { deepFreeze } from "mazey";
import { URL } from "node:url";

import pkg from "./package.json" with { type: "json" };
import { packageDetails, repositoryDetails } from "./scripts/project-config-utils.js";

const shortName = "scp-next";
const packageConfig = packageDetails(pkg);
const repository = repositoryDetails(pkg.repository);
const siteUrl = new URL(pkg.homepage);
siteUrl.pathname = siteUrl.pathname.endsWith("/")
  ? siteUrl.pathname
  : `${siteUrl.pathname}/`;
siteUrl.search = "";
siteUrl.hash = "";

const basePath = siteUrl.pathname;
const displayName = pkg.name;
const githubUrl = repository.url;
const npmUrl = `https://www.npmjs.com/package/${pkg.name}`;
const primary = {
  light: {
    base: "#176b49",
    hover: "#11553a",
    active: "#0c432d",
    soft: "#e3f3eb",
    rgb: "23, 107, 73",
    hoverRgb: "17, 85, 58"
  },
  dark: {
    base: "#73d6aa",
    hover: "#9be6c3",
    active: "#b9efd4",
    soft: "#183c2d",
    rgb: "115, 214, 170",
    hoverRgb: "155, 230, 195"
  }
};
const theme = {
  storageKey: `${packageConfig.bundleBaseName}-theme`,
  colorPrimary: primary.light.base,
  colorLight: "#f6f8f5",
  colorDark: "#0d1712",
  primary
};
const pages = {
  home: {
    title: `${displayName} - Secure SCP-style Transfers over SFTP`,
    description:
      "A TypeScript CLI and library for secure SSH file uploads and downloads using SFTP, typed configuration, reusable clients, and explicit local and remote paths.",
    url: siteUrl.href
  },
  examples: {
    title: `${displayName} Examples - Build CLI and TypeScript Transfers`,
    description:
      "Create accurate scp-next upload and download examples for the CLI or public TypeScript API without sending credentials or connecting to a server.",
    url: new URL("examples/", siteUrl).href
  },
  api: {
    title: `${displayName} API Documentation`,
    description:
      "TypeScript API documentation for scp-next uploads, downloads, reusable SFTP clients, transfer configuration, progress events, and typed errors.",
    url: new URL("api/", siteUrl).href
  }
};
const assets = {
  faviconFile: "scp-next-logo-32x32.png",
  faviconType: "image/png",
  faviconSizes: "32x32",
  appleTouchIconFile: "scp-next-logo-apple-touch-180x180.png",
  appleTouchIconSizes: "180x180",
  logoFile: "scp-next-logo-192x192.png",
  openGraphImageFile: "scp-next-logo-open-graph-1200x630.jpg"
};
const software = {
  "@type": "SoftwareSourceCode",
  name: displayName,
  description: pkg.description,
  url: pages.home.url,
  codeRepository: githubUrl,
  downloadUrl: npmUrl,
  license: `${githubUrl}/blob/main/LICENSE`,
  programmingLanguage: "TypeScript",
  runtimePlatform: "Node.js"
};

export default deepFreeze({
  package: packageConfig,
  repository,
  brand: {
    displayName,
    shortName
  },
  urls: {
    github: githubUrl,
    npm: npmUrl,
    license: `${githubUrl}/blob/main/LICENSE`,
    sitemap: new URL("sitemap.xml", siteUrl).href
  },
  assets: {
    ...assets,
    faviconUrl: `${basePath}images/${assets.faviconFile}`,
    appleTouchIconUrl: `${basePath}images/${assets.appleTouchIconFile}`,
    logoUrl: `${basePath}images/${assets.logoFile}`
  },
  site: {
    url: siteUrl.href,
    basePath,
    markerPrefix: packageConfig.bundleBaseName,
    pages,
    theme
  },
  seo: {
    software,
    openGraphImage: {
      file: assets.openGraphImageFile,
      url: new URL(`images/${assets.openGraphImageFile}`, siteUrl).href,
      width: 1200,
      height: 630,
      type: "image/jpeg",
      alt: "scp-next green transfer logo with white arrows on a white background."
    },
    rootJsonLd: {
      "@context": "https://schema.org",
      ...software
    },
    examplesJsonLd: {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: `${displayName} examples`,
      description: pages.examples.description,
      url: pages.examples.url,
      isPartOf: {
        "@type": "WebSite",
        name: displayName,
        url: pages.home.url
      },
      about: software
    }
  },
  pwa: {
    name: `${displayName} documentation`,
    shortName,
    display: "standalone",
    backgroundColor: theme.colorLight,
    themeColor: theme.colorPrimary,
    manifestUrl: `${basePath}manifest.webmanifest`,
    serviceWorkerUrl: `${basePath}service-worker.js`,
    cachePrefix: `${packageConfig.bundleBaseName}-site-`,
    description:
      "Installable project website, examples, and API documentation for scp-next.",
    icons: [
      {
        file: "scp-next-logo-192x192.png",
        src: `${basePath}images/scp-next-logo-192x192.png`,
        sizes: "192x192",
        type: "image/png",
        purpose: "any"
      },
      {
        file: "scp-next-logo-512x512.png",
        src: `${basePath}images/scp-next-logo-512x512.png`,
        sizes: "512x512",
        type: "image/png",
        purpose: "any"
      },
      {
        file: "scp-next-logo-maskable-512x512.png",
        src: `${basePath}images/scp-next-logo-maskable-512x512.png`,
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable"
      }
    ]
  }
});
