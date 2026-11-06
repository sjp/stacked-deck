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
  return (
    <main className="app">
      <h1>Stacked Deck</h1>
    </main>
  );
}
