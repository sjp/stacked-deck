import type { Card } from "./cards.ts";
import { cardName } from "./cards.ts";
import { findPile } from "./state.ts";
import type { GameState, Move, PileId, PileKind } from "./types.ts";

/** A spoken name for a card: "7 of hearts", or "face-down card". */
export function cardLabel(card: Card): string {
  return card.faceUp ? cardName(card) : "face-down card";
}

/** What piles of each kind are called, unless a variant says otherwise. */
const NOUNS: Readonly<Partial<Record<PileKind, string>>> = {
  tableau: "column",
  cell: "free cell",
  foundation: "foundation",
};

/** Names a variant gives its piles instead, such as "card" for Pyramid's slots. */
export type PileNouns = Readonly<Partial<Record<PileKind, string>>>;

/**
 * A spoken name for a pile: "stock", "column 3", "free cell 2", "foundation 1". Piles are
 * numbered when there is more than one of their kind.
 */
export function pileName(state: GameState, id: PileId, nouns: PileNouns = {}): string {
  const pile = findPile(state, id);
  if (pile === undefined) {
    return id;
  }
  const noun = nouns[pile.kind] ?? NOUNS[pile.kind] ?? pile.kind;
  const same = state.piles.filter((other) => other.kind === pile.kind);
  return same.length > 1 ? `${noun} ${same.indexOf(pile) + 1}` : noun;
}

/** "Column 3, 5 cards, top: 7 of hearts". */
export function pileLabel(state: GameState, id: PileId, nouns: PileNouns = {}): string {
  const cards = findPile(state, id)?.cards ?? [];
  const name = pileName(state, id, nouns);
  const title = name.charAt(0).toUpperCase() + name.slice(1);
  const top = cards.at(-1);
  if (top === undefined) {
    return `${title}, empty`;
  }
  const count = cards.length === 1 ? "1 card" : `${cards.length} cards`;
  return `${title}, ${count}, top: ${cardLabel(top)}`;
}

/** Describes a move for screen readers, from the position before it was made. */
export function describeMove(state: GameState, move: Move, nouns: PileNouns = {}): string {
  if (move.kind === "draw") {
    return "Turned a card from the stock";
  }
  if (move.kind === "recycle") {
    return "Turned the waste back into the stock";
  }
  if (move.kind === "flip") {
    return `Turned over a card in ${pileName(state, move.pile, nouns)}`;
  }
  if (move.kind === "remove") {
    const cards = move.piles
      .map((id) => findPile(state, id)?.cards.at(-1))
      .filter((card) => card !== undefined)
      .map((card) => cardName(card));
    return `Removed ${cards.join(" and ")}`;
  }
  const cards = findPile(state, move.from)?.cards.slice(move.index) ?? [];
  const first = cards[0];
  const what =
    first === undefined
      ? "cards"
      : cards.length === 1
        ? cardName(first)
        : `${cardName(first)} and ${cards.length - 1} more`;
  return `Moved ${what} to ${pileName(state, move.to, nouns)}`;
}
