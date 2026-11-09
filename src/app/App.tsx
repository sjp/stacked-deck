import { lazy, Suspense } from "react";
import { getVariant, VARIANTS } from "../engine/variants/index.ts";
import { ErrorBoundary } from "./ErrorBoundary.tsx";
import { GameScreen } from "./GameScreen.tsx";
import { HomeScreen } from "./HomeScreen.tsx";
import { SettingsProvider } from "./SettingsProvider.tsx";
import { StatsScreen } from "./StatsScreen.tsx";
import { variantsInProgress } from "./gameStore.ts";
import { UpdateToast } from "./UpdateToast.tsx";
import { useDealLink, useRoute } from "./useRoute.ts";

const CardGallery = import.meta.env.DEV
  ? lazy(async () => {
      const module = await import("../ui/CardGallery.tsx");
      return { default: module.CardGallery };
    })
  : undefined;

function Screen() {
  const route = useRoute();
  const link = useDealLink(route);
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
      return (
        <GameScreen
          key={`${variant.id}:${link?.id ?? 0}`}
          variant={variant}
          link={link?.variant === variant.id ? link : undefined}
        />
      );
    }
  }
  if (route.name === "stats") {
    return <StatsScreen />;
  }
  return <HomeScreen inProgress={variantsInProgress(VARIANTS)} />;
}

export function App() {
  return (
    <ErrorBoundary>
      <SettingsProvider>
        <Screen />
        <UpdateToast />
      </SettingsProvider>
    </ErrorBoundary>
  );
}
