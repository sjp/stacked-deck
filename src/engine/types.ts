import type { Card } from "./cards.ts";

export type PileKind = "stock" | "waste" | "foundation" | "tableau" | "cell" | "reserve";
export type PileId = string;

export interface Pile {
  readonly id: PileId;
  readonly kind: PileKind;
  /** Bottom card first; the last card is the top of the pile. */
  readonly cards: readonly Card[];
}

export type OptionValue = string | number | boolean;
export type VariantOptions = Readonly<Record<string, OptionValue>>;

export interface GameState {
  readonly variant: string;
  readonly seed: number;
  readonly options: VariantOptions;
  readonly piles: readonly Pile[];
  readonly score: number;
  /** Variant-specific counters, such as stock passes or a TriPeaks chain. */
  readonly counters: Readonly<Record<string, number>>;
}

export type Move =
  /** Move `from.cards[index..]` onto `to`. */
  | { readonly kind: "move"; readonly from: PileId; readonly index: number; readonly to: PileId }
  /** Turn cards from the stock (or deal a row, in Spider). */
  | { readonly kind: "draw" }
  /** Turn the waste back over into the stock. */
  | { readonly kind: "recycle" }
  /** Turn the top card of a pile face up. */
  | { readonly kind: "flip"; readonly pile: PileId }
  /** Discard the top card of each listed pile (a Pyramid pair, or a lone King). */
  | { readonly kind: "remove"; readonly piles: readonly PileId[] };
