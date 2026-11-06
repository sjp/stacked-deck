import type { Card, Rank, Suit } from "../engine/cards.ts";
import type { Variant } from "../engine/variant.ts";
import { VARIANTS } from "../engine/variants/index.ts";
import { CardView } from "../ui/CardView.tsx";
import { showIosInstallHint, usePwa } from "./pwa.ts";
import { routeHash } from "./route.ts";

/** A few cards that hint at each game, drawn on its tile. */
const PREVIEWS: Readonly<Record<string, readonly (readonly [Rank, Suit])[]>> = {
  klondike: [
    [13, "spades"],
    [12, "hearts"],
    [11, "clubs"],
  ],
  spider: [
    [13, "spades"],
    [12, "spades"],
    [11, "spades"],
  ],
  freecell: [
    [1, "hearts"],
    [1, "spades"],
    [1, "diamonds"],
  ],
  pyramid: [
    [6, "clubs"],
    [7, "diamonds"],
    [13, "hearts"],
  ],
  tripeaks: [
    [8, "hearts"],
    [9, "spades"],
    [10, "diamonds"],
  ],
  golf: [
    [4, "clubs"],
    [5, "hearts"],
    [6, "spades"],
  ],
};

function Preview({ variant }: { readonly variant: Variant }) {
  const cards: Card[] = (PREVIEWS[variant.id] ?? []).map(([rank, suit], id) => ({
    id,
    rank,
    suit,
    faceUp: true,
  }));
  return (
    <div className="variant-preview" aria-hidden="true">
      {cards.map((card, index) => (
        <div key={card.id} className="variant-preview-card" style={{ "--i": index }}>
          <CardView card={card} compact />
        </div>
      ))}
    </div>
  );
}

function InstallButton() {
  const { install } = usePwa();
  if (install !== undefined) {
    return (
      <button type="button" className="button" onClick={install}>
        Install app
      </button>
    );
  }
  if (showIosInstallHint()) {
    return <p className="install-hint">Install: Share → Add to Home Screen</p>;
  }
  return undefined;
}

interface Props {
  /** Variants with a game in progress. */
  readonly inProgress?: ReadonlySet<string>;
}

const NONE: ReadonlySet<string> = new Set();

export function HomeScreen({ inProgress = NONE }: Props) {
  return (
    <main className="home">
      <header className="home-header">
        <h1>Stacked Deck</h1>
        <nav className="home-links" aria-label="More">
          <InstallButton />
          <a className="button" href={routeHash({ name: "daily" })}>
            Daily
          </a>
          <a className="button" href={routeHash({ name: "stats" })}>
            Stats
          </a>
        </nav>
      </header>
      <ul className="variant-list">
        {VARIANTS.map((variant) => (
          <li key={variant.id}>
            <a className="variant-tile" href={routeHash({ name: "play", variant: variant.id })}>
              <Preview variant={variant} />
              <span className="variant-name">{variant.name}</span>
              <span className="variant-description">{variant.description}</span>
              {inProgress.has(variant.id) ? <span className="badge">Continue</span> : undefined}
            </a>
          </li>
        ))}
      </ul>
    </main>
  );
}
