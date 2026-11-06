import type { Card } from "./cards.ts";
import type { GameState, Pile, PileId, PileKind } from "./types.ts";

export function findPile(state: GameState, id: PileId): Pile | undefined {
  return state.piles.find((pile) => pile.id === id);
}

export function getPile(state: GameState, id: PileId): Pile {
  const pile = findPile(state, id);
  if (pile === undefined) {
    throw new Error(`Unknown pile: ${id}`);
  }
  return pile;
}

export function pilesOfKind(state: GameState, kind: PileKind): Pile[] {
  return state.piles.filter((pile) => pile.kind === kind);
}

export function topCard(pile: Pile): Card | undefined {
  return pile.cards.at(-1);
}

/** Returns a new state with the cards of some piles replaced. */
export function withPiles(
  state: GameState,
  changes: Readonly<Record<PileId, readonly Card[]>>,
): GameState {
  return {
    ...state,
    piles: state.piles.map((pile) => {
      const cards = changes[pile.id];
      return cards === undefined ? pile : { ...pile, cards };
    }),
  };
}

export function withCounter(state: GameState, name: string, value: number): GameState {
  return { ...state, counters: { ...state.counters, [name]: value } };
}

export function counter(state: GameState, name: string): number {
  return state.counters[name] ?? 0;
}

export function addScore(state: GameState, points: number): GameState {
  return points === 0 ? state : { ...state, score: state.score + points };
}

export function makePile(id: PileId, kind: PileKind, cards: readonly Card[] = []): Pile {
  return { id, kind, cards };
}

/** A key identifying the arrangement of cards, ignoring score and counters. */
export function pilesKey(state: GameState): string {
  return state.piles
    .map((pile) => pile.cards.map((card) => (card.faceUp ? card.id : ~card.id)).join(","))
    .join("|");
}
