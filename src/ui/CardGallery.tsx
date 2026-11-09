import { useState } from "react";
import { makeCards, withFace } from "../engine/cards.ts";
import type { CardBack, ThemePreference } from "./theme.ts";
import { applyCardStyle, applyTheme, isThemePreference } from "./theme.ts";
import { CardView } from "./CardView.tsx";

const CARDS = makeCards().map((card) => withFace(card, true));
const BACK = makeCards()[0];
const SIZES = [40, 56, 72, 110] as const;
const BACKS: readonly CardBack[] = ["lattice", "dots", "stripes", "plain"];
const COMPACT_BELOW = 56;

/** Development-only page for checking every card face and back at several sizes. */
export function CardGallery() {
  const [theme, setTheme] = useState<ThemePreference>("system");
  const [fourColour, setFourColour] = useState(false);
  const [back, setBack] = useState<CardBack>("lattice");

  const update = (nextTheme: ThemePreference, nextFour: boolean, nextBack: CardBack) => {
    setTheme(nextTheme);
    setFourColour(nextFour);
    setBack(nextBack);
    applyTheme(nextTheme);
    applyCardStyle(nextFour, nextBack);
  };

  return (
    <div className="gallery">
      <h1>Card gallery</h1>
      <div className="gallery-controls">
        <label>
          Theme{" "}
          <select
            value={theme}
            onChange={(event) => {
              const value = event.target.value;
              if (isThemePreference(value)) {
                update(value, fourColour, back);
              }
            }}
          >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            checked={fourColour}
            onChange={(event) => {
              update(theme, event.target.checked, back);
            }}
          />{" "}
          Four-colour deck
        </label>
      </div>
      {SIZES.map((size) => (
        <section key={size}>
          <h2>{size}px</h2>
          <div className="gallery-row">
            {CARDS.map((card) => (
              <div
                key={card.id}
                className="gallery-card"
                style={{ width: size, height: (size * 7) / 5 }}
              >
                <CardView card={card} compact={size < COMPACT_BELOW} />
              </div>
            ))}
          </div>
        </section>
      ))}
      <h2>Backs</h2>
      <div className="gallery-row">
        {BACKS.map((name) => (
          <button
            key={name}
            type="button"
            className="gallery-card"
            aria-label={`${name} back`}
            aria-pressed={name === back}
            style={{ width: 72, height: 100.8 }}
            onClick={() => {
              update(theme, fourColour, name);
            }}
          >
            {BACK === undefined ? undefined : <CardView card={BACK} compact={false} />}
          </button>
        ))}
      </div>
    </div>
  );
}
