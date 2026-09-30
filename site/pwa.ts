import {
  isSafePWAEnv,
  isStandalonePWA,
  listenMediaQueryChanges,
  watchServiceWorkerUpdates
} from "mazey";

export interface SitePwaConfig {
  appName: string;
  enabled: boolean;
  scope: string;
  serviceWorkerUrl: string;
}

interface InstallChoice {
  outcome: "accepted" | "dismissed";
}

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<InstallChoice>;
}

interface WindowWithIdleCallback {
  requestIdleCallback?: (callback: () => void) => number;
}

function announce(documentRef: Document, message: string): void {
  documentRef.querySelectorAll<HTMLElement>("[data-pwa-status]").forEach((region) => {
    region.textContent = message;
  });
}

function setInstallVisibility(documentRef: Document, visible: boolean): void {
  documentRef
    .querySelectorAll<HTMLButtonElement>("[data-pwa-install]")
    .forEach((button) => {
      button.hidden = !visible;
      button.disabled = false;
      const container = button.closest<HTMLElement>("[data-pwa-install-container]");
      if (container) container.hidden = !visible;
    });
}

export function initializeInstallExperience(
  documentRef: Document = document,
  windowRef: Window = window
): () => void {
  let deferredPrompt: BeforeInstallPromptEvent | null = null;
  const installButtons = Array.from(
    documentRef.querySelectorAll<HTMLButtonElement>("[data-pwa-install]")
  );
  const standaloneQuery = windowRef.matchMedia("(display-mode: standalone)");
  const showInstalledState = () => {
    deferredPrompt = null;
    setInstallVisibility(documentRef, false);
    documentRef
      .querySelectorAll<HTMLElement>("[data-pwa-install-help]")
      .forEach((element) => {
        element.hidden = true;
      });
  };
  const handlePrompt = (event: Event) => {
    if (isStandalonePWA()) return;
    const prompt = event as BeforeInstallPromptEvent;
    prompt.preventDefault();
    deferredPrompt = prompt;
    setInstallVisibility(documentRef, true);
  };
  const handleInstall = async () => {
    if (!deferredPrompt) return;
    const prompt = deferredPrompt;
    deferredPrompt = null;
    installButtons.forEach((button) => {
      button.disabled = true;
    });
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      announce(
        documentRef,
        choice.outcome === "accepted"
          ? "The documentation installation was accepted."
          : "Installation was dismissed. You can use the browser install menu later."
      );
    } catch {
      announce(
        documentRef,
        "The installation prompt could not be opened. Use the browser install menu instead."
      );
    } finally {
      setInstallVisibility(documentRef, false);
    }
  };
  const handleInstalled = () => {
    showInstalledState();
    announce(documentRef, "The scp-next documentation was installed.");
  };
  const handleDisplayMode = () => {
    if (isStandalonePWA()) showInstalledState();
  };
  const handleInstallClick = () => {
    void handleInstall();
  };

  if (isStandalonePWA()) showInstalledState();
  installButtons.forEach((button) =>
    button.addEventListener("click", handleInstallClick)
  );
  windowRef.addEventListener("beforeinstallprompt", handlePrompt);
  windowRef.addEventListener("appinstalled", handleInstalled);
  const stopDisplayMode = listenMediaQueryChanges(standaloneQuery, handleDisplayMode);

  return () => {
    installButtons.forEach((button) =>
      button.removeEventListener("click", handleInstallClick)
    );
    windowRef.removeEventListener("beforeinstallprompt", handlePrompt);
    windowRef.removeEventListener("appinstalled", handleInstalled);
    stopDisplayMode();
  };
}

export async function registerSiteServiceWorker(
  config: SitePwaConfig
): Promise<ServiceWorkerRegistration | null> {
  if (!config.enabled || !isSafePWAEnv({ scope: config.scope })) return null;

  try {
    const registration = await navigator.serviceWorker.register(config.serviceWorkerUrl, {
      scope: config.scope
    });
    const notice = document.querySelector<HTMLElement>("[data-pwa-update]");
    const updateButton = document.querySelector<HTMLButtonElement>(
      "[data-pwa-update-now]"
    );
    let reloadRequested = false;
    const watcher = watchServiceWorkerUpdates(registration, navigator.serviceWorker, {
      onUpdateAvailable() {
        if (notice) notice.hidden = false;
        announce(
          document,
          `A new version of the ${config.appName} website is available.`
        );
      },
      onControllerChange() {
        if (notice) notice.hidden = true;
        if (reloadRequested) window.location.reload();
      }
    });
    updateButton?.addEventListener("click", () => {
      reloadRequested = watcher.activateWaiting();
      if (reloadRequested) {
        updateButton.disabled = true;
        announce(document, "Updating the website now.");
      }
    });
    return registration;
  } catch (error) {
    console.error(`Failed to register the ${config.appName} service worker.`, error);
    return null;
  }
}

export function initializeSitePwa(config: SitePwaConfig): void {
  if (
    typeof document === "undefined" ||
    typeof window === "undefined" ||
    typeof navigator === "undefined"
  ) {
    return;
  }
  const root = document.documentElement;
  if (root.dataset.pwaReady === "true") return;
  root.dataset.pwaReady = "true";
  initializeInstallExperience();
  if (!config.enabled || !isSafePWAEnv({ scope: config.scope })) return;

  const scheduleRegistration = () => {
    const idleWindow = window as unknown as WindowWithIdleCallback;
    if (idleWindow.requestIdleCallback) {
      idleWindow.requestIdleCallback(() => {
        void registerSiteServiceWorker(config);
      });
    } else {
      window.setTimeout(() => {
        void registerSiteServiceWorker(config);
      }, 0);
    }
  };
  if (document.readyState === "complete") scheduleRegistration();
  else window.addEventListener("load", scheduleRegistration, { once: true });
}
