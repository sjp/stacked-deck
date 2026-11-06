import type { Card } from "../../cards.ts";
import { withFace } from "../../cards.ts";
import { getPile, topCard, withPiles } from "../../state.ts";
import type { GameState, PileId } from "../../types.ts";

export interface WasteRules {
  /** Kings and Aces count as adjacent. */
  readonly wrap: boolean;
  /** Whether a card may be played onto a King. */
  readonly onKing: boolean;
}

/** Whether `card` can be played onto `onto`: one rank above or below it. */
export function canPlayOnWaste(card: Card, onto: Card | undefined, rules: WasteRules): boolean {
  if (onto === undefined || !card.faceUp) {
    return false;
  }
  if (onto.rank === 13 && !rules.onKing) {
    return false;
  }
  const gap = Math.abs(card.rank - onto.rank);
  return gap === 1 || (rules.wrap && gap === 12);
}

export function wasteTop(state: GameState, waste: PileId): Card | undefined {
  return topCard(getPile(state, waste));
}

/** Moves a pile's top card onto the waste. */
export function playToWaste(state: GameState, from: PileId, waste: PileId): GameState {
  const cards = getPile(state, from).cards;
  const card = cards.at(-1);
  if (card === undefined) {
    return state;
  }
  return withPiles(state, {
    [from]: cards.slice(0, -1),
    [waste]: [...getPile(state, waste).cards, card],
  });
}

/** Turns the stock's top card onto the waste. */
export function drawToWaste(state: GameState, stock: PileId, waste: PileId): GameState {
  const cards = getPile(state, stock).cards;
  const card = cards.at(-1);
  if (card === undefined) {
    return state;
  }
  return withPiles(state, {
    [stock]: cards.slice(0, -1),
    [waste]: [...getPile(state, waste).cards, withFace(card, true)],
  });
}

/**
 * A solver key for waste-pile games: only the cards still in play, the stock size and
 * the waste's top card matter, not the order of cards buried in the waste.
 */
export function wasteGameKey(state: GameState, waste: PileId): string {
  const inPlay = state.piles
    .filter((pile) => pile.id !== waste)
    .map((pile) => pile.cards.map((card) => (card.faceUp ? card.id : ~card.id)).join(","));
  return `${inPlay.join("|")}#${wasteTop(state, waste)?.id ?? ""}`;
}
