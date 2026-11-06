import { lazy, Suspense } from "react";
import { getVariant, VARIANTS } from "../engine/variants/index.ts";
import { GameScreen } from "./GameScreen.tsx";
import { HomeScreen } from "./HomeScreen.tsx";
import { SettingsProvider } from "./SettingsProvider.tsx";
import { variantsInProgress } from "./gameStore.ts";
import { UpdateToast } from "./UpdateToast.tsx";
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

export function App() {
  return (
    <SettingsProvider>
      <Screen />
      <UpdateToast />
    </SettingsProvider>
  );
}
