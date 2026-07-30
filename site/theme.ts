import {
  listenMediaQueryChanges,
  resolveThemePreference,
  setThemePreference
} from "mazey";
import type { ResolvedTheme, ThemePreference } from "mazey";

const systemThemeQuery = "(prefers-color-scheme: dark)";

export function initializeThemeControls(storageKey: string): () => void {
  const root = document.documentElement;
  if (root.dataset.themeControlsReady === "true") return () => undefined;

  let media: MediaQueryList | null = null;
  try {
    media = window.matchMedia(systemThemeQuery);
  } catch {
    // Mazey supplies a light fallback when system detection is unavailable.
  }

  const resolveSelectedTheme = (preference: ThemePreference): ResolvedTheme =>
    preference === "system" ? (media?.matches ? "dark" : "light") : preference;
  const apply = (preference: ThemePreference, resolvedTheme: ResolvedTheme) => {
    root.dataset.bsTheme = resolvedTheme;
    root.dataset.theme = resolvedTheme;
    root.style.colorScheme = resolvedTheme;
    const themeColor = document.querySelector<HTMLMetaElement>(
      'meta[name="theme-color"][data-theme-color]'
    );
    if (themeColor) {
      themeColor.content =
        resolvedTheme === "dark"
          ? (themeColor.dataset.themeColorDark ?? themeColor.content)
          : (themeColor.dataset.themeColorLight ?? themeColor.content);
    }
    try {
      window.localStorage.setItem(
        "tsd-theme",
        preference === "system" ? "os" : preference
      );
    } catch {
      // TypeDoc synchronization is optional when storage is unavailable.
    }
    document
      .querySelectorAll<HTMLSelectElement>("[data-theme-select]")
      .forEach((control) => {
        if (control.value !== preference) control.value = preference;
      });
  };

  const initialTheme = resolveThemePreference(storageKey);
  let selectedPreference: ThemePreference =
    initialTheme.label === "System" ? "system" : initialTheme.value;
  const handleChange = (event: Event) => {
    const control = event.target;
    if (
      !(control instanceof HTMLSelectElement) ||
      !control.matches("[data-theme-select]")
    ) {
      return;
    }
    const preference = control.value as ThemePreference;
    setThemePreference(storageKey, preference);
    selectedPreference = preference;
    apply(preference, resolveSelectedTheme(preference));
  };
  const handleSystemTheme = () => {
    if (selectedPreference === "system") {
      apply("system", resolveSelectedTheme("system"));
    }
  };

  root.dataset.themeControlsReady = "true";
  apply(selectedPreference, initialTheme.value);
  document.addEventListener("change", handleChange);
  const stopListening = listenMediaQueryChanges(media, handleSystemTheme);
  return () => {
    document.removeEventListener("change", handleChange);
    stopListening();
    delete root.dataset.themeControlsReady;
  };
}
