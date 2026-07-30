import { SITE_RUNTIME_CONFIG } from "./runtime-config";

const copyButton = document.querySelector<HTMLButtonElement>("[data-copy-install]");
const copyStatus = document.querySelector<HTMLElement>("[data-copy-status]");

async function copyInstallCommand(): Promise<void> {
  try {
    await navigator.clipboard.writeText(SITE_RUNTIME_CONFIG.installCommand);
    if (copyStatus) copyStatus.textContent = "Install command copied.";
  } catch {
    if (copyStatus) {
      copyStatus.textContent =
        "Copy was unavailable. Select the install command manually.";
    }
  }
}

copyButton?.addEventListener("click", () => {
  void copyInstallCommand();
});
