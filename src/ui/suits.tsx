import type { Suit } from "../engine/cards.ts";
import { SUIT_PATHS } from "./suitPaths.ts";

interface SuitShapeProps {
  readonly suit: Suit;
  readonly x: number;
  readonly y: number;
  readonly size: number;
  readonly flip?: boolean;
}

/** A suit symbol centred on (x, y), for use inside a card's SVG. */
export function SuitShape({ suit, x, y, size, flip = false }: SuitShapeProps) {
  const scale = size / 100;
  const rotate = flip ? ` rotate(180 50 50)` : "";
  return (
    <g transform={`translate(${x - size / 2} ${y - size / 2}) scale(${scale})${rotate}`}>
      {SUIT_PATHS[suit].map((d) => (
        <path key={d} d={d} />
      ))}
    </g>
  );
}

/** A standalone suit icon, sized by CSS, for use in text such as a foundation label. */
export function SuitIcon({ suit }: { readonly suit: Suit }) {
  return (
    <svg className={`suit-icon suit-${suit}`} viewBox="0 0 100 100" aria-hidden="true">
      {SUIT_PATHS[suit].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
