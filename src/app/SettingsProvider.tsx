import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { Settings } from "./settings.ts";
import { defaultSettings, MOVE_MS } from "./settings.ts";
import { SettingsContext } from "./settingsContext.ts";
import { applyCardStyle, applyTheme } from "./theme.ts";

interface Props {
  readonly children: ReactNode;
  readonly load?: () => Settings;
  readonly save?: (settings: Settings) => void;
}

export function SettingsProvider({ children, load = defaultSettings, save }: Props) {
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
    save?.(settings);
  }, [save, settings]);

  const update = useCallback((changes: Partial<Settings>) => {
    setSettings((previous) => ({ ...previous, ...changes }));
  }, []);
  const value = useMemo(() => ({ settings, update }), [settings, update]);
  return <SettingsContext value={value}>{children}</SettingsContext>;
}
