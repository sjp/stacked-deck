import type { Card } from "./cards.ts";
import { colourOf, sameColour, SUITS, withFace } from "./cards.ts";
import type { GameState, Move, Pile } from "./types.ts";
import { findPile, pilesOfKind, topCard, withPiles } from "./state.ts";

/** Whether `card` can go on `onto` in a build-down, alternating-colour tableau. */
export function canStackAlternating(card: Card, onto: Card | undefined): boolean {
  return (
    onto !== undefined && onto.faceUp && onto.rank === card.rank + 1 && !sameColour(card, onto)
  );
}

/** Whether `cards[index..]` are face up and build down in alternating colours. */
export function isAlternatingRun(cards: readonly Card[], index: number): boolean {
  if (index < 0 || index >= cards.length) {
    return false;
  }
  for (let i = index; i < cards.length; i++) {
    const card = cards[i];
    if (card === undefined || !card.faceUp) {
      return false;
    }
    if (i > index && !canStackAlternating(card, cards[i - 1])) {
      return false;
    }
  }
  return true;
}

/** Whether `card` can go on a foundation built up by suit from the Ace. */
export function canAddToFoundation(card: Card, foundation: Pile): boolean {
  const top = topCard(foundation);
  return top === undefined ? card.rank === 1 : top.suit === card.suit && top.rank + 1 === card.rank;
}

/** The highest rank on the foundation for `suit` (0 if none). */
export function foundationRank(state: GameState, suit: Card["suit"]): number {
  let best = 0;
  for (const pile of pilesOfKind(state, "foundation")) {
    const top = topCard(pile);
    if (top?.suit === suit) {
      best = Math.max(best, top.rank);
    }
  }
  return best;
}

/**
 * A card is safe to send up when it can never be needed to hold another card: Aces and
 * 2s, or cards whose two opposite-colour suits are built at least to one rank below.
 */
export function isSafeForFoundation(state: GameState, card: Card): boolean {
  if (card.rank <= 2) {
    return true;
  }
  const colour = colourOf(card.suit);
  const opposite = SUITS.filter((suit) => colourOf(suit) !== colour);
  return opposite.every((suit) => foundationRank(state, suit) >= card.rank - 1);
}

export function cardsOnFoundations(state: GameState): number {
  return pilesOfKind(state, "foundation").reduce((sum, pile) => sum + pile.cards.length, 0);
}

/** Moves cards[index..] from one pile to another, returning the changed card lists. */
export function transfer(
  state: GameState,
  from: string,
  index: number,
  to: string,
): Record<string, readonly Card[]> {
  const source = findPile(state, from);
  const target = findPile(state, to);
  if (source === undefined || target === undefined) {
    return {};
  }
  return {
    [from]: source.cards.slice(0, index),
    [to]: [...target.cards, ...source.cards.slice(index)],
  };
}

/** Whether a tableau pile's top card is face down, waiting to be turned over. */
export function canFlip(state: GameState, id: string): boolean {
  const pile = findPile(state, id);
  const top = pile === undefined ? undefined : topCard(pile);
  return pile?.kind === "tableau" && top !== undefined && !top.faceUp;
}

/** Turns a pile's top card face up. */
export function flipTop(state: GameState, id: string): GameState {
  const cards = findPile(state, id)?.cards ?? [];
  const top = cards.at(-1);
  return top === undefined
    ? state
    : withPiles(state, { [id]: [...cards.slice(0, -1), withFace(top, true)] });
}

/** Turning over the first face-down top card in the tableau, if there is one. */
export function firstFlip(state: GameState): Move | undefined {
  const pile = pilesOfKind(state, "tableau").find((candidate) => canFlip(state, candidate.id));
  return pile === undefined ? undefined : { kind: "flip", pile: pile.id };
}
