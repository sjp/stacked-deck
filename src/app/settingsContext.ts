import { createContext, useContext } from "react";
import type { Settings } from "./settings.ts";
import { defaultSettings } from "./settings.ts";

export interface SettingsContextValue {
  readonly settings: Settings;
  readonly update: (changes: Partial<Settings>) => void;
}

export const SettingsContext = createContext<SettingsContextValue>({
  settings: defaultSettings(),
  update: () => {
    // No provider: settings are read-only defaults.
  },
});

export function useSettings(): SettingsContextValue {
  return useContext(SettingsContext);
}
