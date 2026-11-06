import type { Card } from "./cards.ts";
import { colourOf, sameColour } from "./cards.ts";
import type { GameState, Move, Pile, PileKind } from "./types.ts";
import { findPile, pilesOfKind, topCard } from "./state.ts";

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
  const opposite = (["spades", "hearts", "diamonds", "clubs"] as const).filter(
    (suit) => colourOf(suit) !== colour,
  );
  return opposite.every((suit) => foundationRank(state, suit) >= card.rank - 1);
}

export function cardsOnFoundations(state: GameState): number {
  return pilesOfKind(state, "foundation").reduce((sum, pile) => sum + pile.cards.length, 0);
}

export function pileKindOf(state: GameState, id: string): PileKind | undefined {
  return findPile(state, id)?.kind;
}

/** The destination pile of a move, if it has one. */
export function moveTarget(move: Move): string | undefined {
  return move.kind === "move" ? move.to : undefined;
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
