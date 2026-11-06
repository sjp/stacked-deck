import { klondike } from "../engine/variants/klondike/klondike.ts";
import { GameScreen } from "./GameScreen.tsx";
import { lazy, Suspense } from "react";

const CardGallery = import.meta.env.DEV
  ? lazy(async () => {
      const module = await import("../ui/CardGallery.tsx");
      return { default: module.CardGallery };
    })
  : undefined;

export function App() {
  if (CardGallery !== undefined && globalThis.location.hash === "#/gallery") {
    return (
      <Suspense>
        <CardGallery />
      </Suspense>
    );
  }
  return <GameScreen variant={klondike} />;
}
