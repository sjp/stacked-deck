export type ThemePreference = "system" | "light" | "dark";
export const THEMES: readonly ThemePreference[] = ["system", "light", "dark"];

export function isThemePreference(value: unknown): value is ThemePreference {
  return THEMES.some((theme) => theme === value);
}

export type CardBack = "lattice" | "dots" | "stripes" | "plain";

/** Browser UI colours, matching the table felt in each theme. */
const THEME_COLOURS = { light: "#2f7a52", dark: "#133a26" } as const;

const darkQuery = (): MediaQueryList => globalThis.matchMedia("(prefers-color-scheme: dark)");

export function effectiveTheme(preference: ThemePreference): "light" | "dark" {
  if (preference !== "system") {
    return preference;
  }
  return darkQuery().matches ? "dark" : "light";
}

/** Sets data-theme on <html> and keeps the theme-color meta tags in step. */
export function applyTheme(preference: ThemePreference): void {
  const root = document.documentElement;
  if (preference === "system") {
    delete root.dataset["theme"];
  } else {
    root.dataset["theme"] = preference;
  }
  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    const media = meta.media.includes("dark") ? "dark" : "light";
    meta.content = THEME_COLOURS[preference === "system" ? media : preference];
  }
}

export function applyCardStyle(fourColour: boolean, back: CardBack): void {
  const root = document.documentElement;
  if (fourColour) {
    root.dataset["fourColour"] = "";
  } else {
    delete root.dataset["fourColour"];
  }
  root.dataset["cardBack"] = back;
}
