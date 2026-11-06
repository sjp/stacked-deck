import type { Card, Rank, Suit } from "./cards.ts";
import { isRank } from "./cards.ts";
import type { GameState, Pile, PileKind, VariantOptions } from "./types.ts";
import type { Variant } from "./variant.ts";

const SUIT_CODES: Readonly<Record<string, Suit>> = {
  S: "spades",
  H: "hearts",
  D: "diamonds",
  C: "clubs",
};
const RANK_CODES: Readonly<Record<string, Rank>> = {
  A: 1,
  J: 11,
  Q: 12,
  K: 13,
};

let nextId = 1000;

/**
 * Parses card shorthand for tests: "QH" is the queen of hearts face up, "-7C" is the
 * 7 of clubs face down.
 */
export function card(code: string): Card {
  const faceUp = !code.startsWith("-");
  const body = faceUp ? code : code.slice(1);
  const suit = SUIT_CODES[body.slice(-1)];
  const rankCode = body.slice(0, -1);
  const rank = RANK_CODES[rankCode] ?? Number(rankCode);
  if (suit === undefined || !isRank(rank)) {
    throw new Error(`Bad card code: ${code}`);
  }
  nextId += 1;
  return { id: nextId, suit, rank, faceUp };
}

export function cards(shorthand: string): Card[] {
  return shorthand
    .split(/\s+/u)
    .filter((code) => code.length > 0)
    .map((code) => card(code));
}

export interface PileSpec {
  readonly id: string;
  readonly kind: PileKind;
  readonly cards?: string;
}

export function makeState(
  variant: string,
  piles: readonly PileSpec[],
  options: VariantOptions = {},
  counters: Readonly<Record<string, number>> = {},
): GameState {
  return {
    variant,
    seed: 0,
    options,
    score: 0,
    counters,
    piles: piles.map((spec): Pile => ({
      id: spec.id,
      kind: spec.kind,
      cards: cards(spec.cards ?? ""),
    })),
  };
}

/** Lists a pile as shorthand, for readable assertions. */
export function codes(pile: Pile | undefined): string {
  const letters: Readonly<Record<number, string>> = { 1: "A", 11: "J", 12: "Q", 13: "K" };
  return (pile?.cards ?? [])
    .map(
      (c) =>
        `${c.faceUp ? "" : "-"}${letters[c.rank] ?? String(c.rank)}${c.suit[0]?.toUpperCase() ?? ""}`,
    )
    .join(" ");
}

/**
 * Plays up to `steps` legal moves (picked by a fixed pattern) and returns every position
 * reached, for checking that a variant's move generator only offers legal moves.
 */
export function walk(variant: Variant, start: GameState, steps: number): GameState[] {
  const states = [start];
  let state = start;
  for (let i = 0; i < steps; i++) {
    const moves = variant.legalMoves(state);
    const move = moves[(i * 7) % Math.max(1, moves.length)];
    if (move === undefined) {
      break;
    }
    state = variant.applyMove(state, move);
    states.push(state);
  }
  return states;
}

/** Whether every move the variant offers in each position is legal. */
export function allOfferedMovesLegal(variant: Variant, states: readonly GameState[]): boolean {
  return states.every((state) =>
    variant.legalMoves(state).every((move) => variant.canMove(state, move)),
  );
}
