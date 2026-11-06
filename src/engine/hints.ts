import type { GameState, Move, Pile } from "./types.ts";
import { findPile, pilesKey } from "./state.ts";
import type { Variant } from "./variant.ts";

/** Hints below this are only stock moves or shuffles, which don't make progress. */
export const USEFUL = 100;

function isStockMove(move: Move): boolean {
  return move.kind === "draw" || move.kind === "recycle";
}

function hiddenBelow(pile: Pile, index: number): number {
  return pile.cards.slice(0, index).filter((card) => !card.faceUp).length;
}

/**
 * Scores a move for hints, roughly: foundation moves, then moves that turn over a hidden
 * card (more hidden cards first), then moves that empty a column, then other building
 * moves, then the stock. Moves between equivalent places score zero.
 */
export function hintScore(variant: Variant, state: GameState, move: Move): number {
  if (move.kind === "flip") {
    return 900;
  }
  if (move.kind === "remove") {
    return 800 + move.piles.length;
  }
  if (move.kind === "draw") {
    return 50;
  }
  if (move.kind === "recycle") {
    return 40;
  }
  const source = findPile(state, move.from);
  const target = findPile(state, move.to);
  const card = source?.cards[move.index];
  if (source === undefined || target === undefined || card === undefined) {
    return 0;
  }
  if (target.kind === "foundation") {
    return 1000 - card.rank;
  }
  if (target.kind === "waste") {
    // Golf and TriPeaks play everything to the waste.
    return 700 + hiddenBelow(source, source.cards.length);
  }
  if (source.kind === "foundation") {
    return 10;
  }
  const below = source.cards[move.index - 1];
  if (source.kind === "tableau" && below !== undefined && !below.faceUp) {
    return 500 + hiddenBelow(source, move.index);
  }
  if (source.kind === "tableau" && move.index === 0) {
    // Empties a column; pointless if it just moves to another empty one.
    return target.cards.length === 0 ? 0 : 300;
  }
  if (source.kind === "tableau" && below?.faceUp === true && below.rank === card.rank + 1) {
    // Moving a run off one valid parent onto another just shuffles it around, unless the
    // card underneath can then go somewhere useful.
    const after = variant.applyMove(state, move);
    const freed = variant
      .legalMoves(after)
      .some(
        (next) =>
          next.kind === "move" &&
          next.from === move.from &&
          next.index === move.index - 1 &&
          findPile(after, next.to)?.kind === "foundation",
      );
    return freed ? 450 : 0;
  }
  if (source.kind === "cell") {
    return target.cards.length === 0 ? 120 : 250;
  }
  if (target.kind === "cell") {
    return USEFUL;
  }
  // Building on a card of the same suit keeps runs together (it matters most in Spider).
  const top = target.cards.at(-1);
  return top?.suit === card.suit ? 260 : 200;
}

/** Legal moves worth suggesting, best first. Moves that make no progress are left out. */
export function rankHints(variant: Variant, state: GameState): Move[] {
  return variant
    .legalMoves(state)
    .map((move) => ({ move, score: hintScore(variant, state, move) }))
    .filter(({ score }) => score > 0)
    .toSorted((a, b) => b.score - a.score)
    .map(({ move }) => move);
}

/**
 * Whether anything useful can still be done: a useful move now, or one reachable by going
 * through the stock. False means only stock cycling is left.
 */
function usefulNow(variant: Variant, state: GameState): boolean {
  return variant
    .legalMoves(state)
    .some((move) => !isStockMove(move) && hintScore(variant, state, move) >= USEFUL);
}

/**
 * Whether anything useful can still be done: a useful move now, or one reachable by going
 * through the stock. False means only stock cycling is left.
 */
export function hasUsefulMoves(variant: Variant, state: GameState, limit = 200): boolean {
  const seen = new Set<string>();
  let current: GameState | undefined = state;
  // Stock moves are deterministic, so going through the stock is a single path.
  for (let step = 0; step < limit && current !== undefined; step++) {
    const key = variant.stateKey?.(current) ?? pilesKey(current);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    if (usefulNow(variant, current)) {
      return true;
    }
    const stockMove: Move | undefined = variant
      .legalMoves(current)
      .find((move) => isStockMove(move));
    current = stockMove === undefined ? undefined : variant.applyMove(current, stockMove);
  }
  return false;
}
