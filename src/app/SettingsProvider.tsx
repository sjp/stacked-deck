import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { Settings } from "./settings.ts";
import { SettingsContext } from "./settingsContext.ts";
import { applyPageSettings, loadSettings, saveSettings } from "./settingsStore.ts";
import { useFeedbackOutputs } from "./useFeedbackOutputs.ts";

interface Props {
  readonly children: ReactNode;
  readonly load?: () => Settings;
  readonly save?: (settings: Settings) => void;
}

/** Holds the settings, applies them to the page and saves every change. */
export function SettingsProvider({ children, load = loadSettings, save = saveSettings }: Props) {
  const [settings, setSettings] = useState(load);

  // main.tsx applies the stored settings before the first render; this keeps up with
  // changes, before the browser paints them.
  useLayoutEffect(() => {
    applyPageSettings(settings);
  }, [settings]);
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
