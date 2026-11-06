import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { Settings } from "./settings.ts";
import { MOVE_MS, parseSettings } from "./settings.ts";
import { SettingsContext } from "./settingsContext.ts";
import { readStored, writeStored } from "./storage.ts";
import { applyCardStyle, applyTheme } from "./theme.ts";
import { useFeedbackOutputs } from "./useFeedbackOutputs.ts";

const loadSettings = (): Settings => parseSettings(readStored("settings"));
const saveSettings = (settings: Settings): void => {
  writeStored("settings", settings);
};

interface Props {
  readonly children: ReactNode;
  readonly load?: () => Settings;
  readonly save?: (settings: Settings) => void;
}

/** Holds the settings, applies them to the page and saves every change. */
export function SettingsProvider({ children, load = loadSettings, save = saveSettings }: Props) {
  const [settings, setSettings] = useState(load);

  useEffect(() => {
    applyTheme(settings.theme);
  }, [settings.theme]);
  useEffect(() => {
    applyCardStyle(settings.fourColour, settings.cardBack);
  }, [settings.fourColour, settings.cardBack]);
  useEffect(() => {
    document.documentElement.style.setProperty("--move-ms", `${MOVE_MS[settings.animation]}ms`);
  }, [settings.animation]);
  useEffect(() => {
    save(settings);
  }, [save, settings]);

  useFeedbackOutputs(settings.sound, settings.volume, settings.haptics);

  const update = useCallback((changes: Partial<Settings>) => {
    setSettings((previous) => ({ ...previous, ...changes }));
  }, []);
  const value = useMemo(() => ({ settings, update }), [settings, update]);
  return <SettingsContext value={value}>{children}</SettingsContext>;
}
