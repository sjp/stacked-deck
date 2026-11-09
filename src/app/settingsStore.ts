import type { Settings } from "./settings.ts";
import { MOVE_MS, parseSettings } from "./settings.ts";
import { readStored, writeStored } from "./storage.ts";
import { applyCardStyle, applyTheme } from "./theme.ts";

const KEY = "settings";

export function loadSettings(): Settings {
  return parseSettings(readStored(KEY));
}

export function saveSettings(settings: Settings): void {
  writeStored(KEY, settings);
}

/** Puts the settings that change how the page looks onto <html>. */
export function applyPageSettings(settings: Settings): void {
  applyTheme(settings.theme);
  applyCardStyle(settings.fourColour, settings.cardBack);
  document.documentElement.style.setProperty("--move-ms", `${MOVE_MS[settings.animation]}ms`);
}
