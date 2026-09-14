export const THEME_IDS = ["dark", "light", "sepia"] as const;
export type ThemeId = (typeof THEME_IDS)[number];
export const THEME_HINT_KEY = "story_theme_hint_v1";

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === "string" && (THEME_IDS as readonly string[]).includes(value);
}

export function readPresentedTheme(): ThemeId {
  if (typeof document === "undefined") return "dark";
  const value = document.documentElement.getAttribute("data-theme");
  return isThemeId(value) ? value : "dark";
}

/** Presentation cache only. Reader settings persistence remains behind settingsStore. */
export function applyPresentedTheme(theme: ThemeId): void {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", theme);
  try {
    window.localStorage.setItem(THEME_HINT_KEY, theme);
  } catch {
    // Storage is optional; applying the DOM theme is still sufficient for this paint.
  }
}

export const THEME_BOOTSTRAP_SCRIPT = `(()=>{try{const a=["dark","light","sepia"];let t=localStorage.getItem("${THEME_HINT_KEY}");if(!a.includes(t)){try{const s=JSON.parse(localStorage.getItem("story_reader_settings")||"null");t=s&&s.theme}catch{}}document.documentElement.dataset.theme=a.includes(t)?t:"dark"}catch{document.documentElement.dataset.theme="dark"}})()`;
