import { lazy, Suspense } from "react";
import { getVariant, VARIANTS } from "../engine/variants/index.ts";
import { GameScreen } from "./GameScreen.tsx";
import { HomeScreen } from "./HomeScreen.tsx";
import type { Settings } from "./settings.ts";
import { parseSettings } from "./settings.ts";
import { SettingsProvider } from "./SettingsProvider.tsx";
import { readStored, writeStored } from "./storage.ts";
import { variantsInProgress } from "./useGameSession.ts";
import { useRoute } from "./useRoute.ts";

const CardGallery = import.meta.env.DEV
  ? lazy(async () => {
      const module = await import("../ui/CardGallery.tsx");
      return { default: module.CardGallery };
    })
  : undefined;

function Screen() {
  const route = useRoute();
  if (route.name === "gallery" && CardGallery !== undefined) {
    return (
      <Suspense>
        <CardGallery />
      </Suspense>
    );
  }
  if (route.name === "play") {
    const variant = getVariant(route.variant);
    if (variant !== undefined) {
      return <GameScreen key={variant.id} variant={variant} seed={route.seed} />;
    }
  }
  return <HomeScreen inProgress={variantsInProgress(VARIANTS)} />;
}

const loadSettings = (): Settings => parseSettings(readStored("settings"));
const saveSettings = (settings: Settings): void => {
  writeStored("settings", settings);
};

export function App() {
  return (
    <SettingsProvider load={loadSettings} save={saveSettings}>
      <Screen />
    </SettingsProvider>
  );
}
