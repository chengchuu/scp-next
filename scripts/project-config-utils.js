import { parseGitHubRepository } from "mazey";

export function packageDetails(pkg) {
  if (typeof pkg.name !== "string" || !pkg.name.trim()) {
    throw new Error("package.json must define a package name");
  }

  const bundleBaseName = pkg.name.split("/").filter(Boolean).at(-1);
  const author =
    typeof pkg.author === "string"
      ? { name: pkg.author }
      : pkg.author && typeof pkg.author === "object"
        ? { ...pkg.author }
        : { name: "" };

  return {
    name: pkg.name,
    version: pkg.version,
    description: pkg.description,
    license: pkg.license,
    author,
    bundleBaseName,
    installCommand: `npm install ${pkg.name}`
  };
}

export function repositoryDetails(repository) {
  const rawUrl = typeof repository === "string" ? repository : repository?.url;
  if (typeof rawUrl !== "string" || !rawUrl.trim()) {
    throw new Error("package.json must define a GitHub repository URL");
  }

  try {
    return parseGitHubRepository(rawUrl);
  } catch {
    throw new Error(`Cannot derive GitHub repository identity from ${rawUrl}`);
  }
}
