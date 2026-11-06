import { findPile } from "../engine/state.ts";
import type { GameState, PileId } from "../engine/types.ts";
import type { PileLayout, TableLayout } from "../engine/variant.ts";
import type { CardRef } from "./useTableInteraction.ts";

export type Direction = "left" | "right" | "up" | "down";

/** The cards a cursor can rest on in a pile: face-up cards of a fanned pile, else the top. */
export function stops(state: GameState, layout: PileLayout): number[] {
  const cards = findPile(state, layout.id)?.cards ?? [];
  if (cards.length === 0) {
    return [-1];
  }
  if (layout.fan !== "down") {
    return [cards.length - 1];
  }
  const up = cards.flatMap((card, index) => (card.faceUp ? [index] : []));
  return up.length > 0 ? up : [cards.length - 1];
}

export function firstCursor(state: GameState, layout: TableLayout): CardRef | undefined {
  const [first] = layout.piles;
  return first === undefined
    ? undefined
    : { pile: first.id, index: stops(state, first).at(-1) ?? -1 };
}

/** The pile nearest to `from` in a direction, favouring piles in line with it. */
function nearestPile(
  piles: readonly PileLayout[],
  from: PileLayout,
  direction: Direction,
): PileLayout | undefined {
  let best: PileLayout | undefined;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const pile of piles) {
    const dx = pile.x - from.x;
    const dy = pile.y - from.y;
    const ahead =
      direction === "left"
        ? dx < -0.3
        : direction === "right"
          ? dx > 0.3
          : direction === "up"
            ? dy < -0.2
            : dy > 0.2;
    if (pile.id === from.id || !ahead) {
      continue;
    }
    const along = direction === "left" || direction === "right" ? Math.abs(dx) : Math.abs(dy);
    const across = direction === "left" || direction === "right" ? Math.abs(dy) : Math.abs(dx);
    const score = along + across * 3;
    if (score < bestScore) {
      bestScore = score;
      best = pile;
    }
  }
  return best;
}

/** Moves the keyboard cursor: within a fanned pile first, then to the nearest pile. */
export function moveCursor(
  state: GameState,
  layout: TableLayout,
  cursor: CardRef | undefined,
  direction: Direction,
): CardRef | undefined {
  const current = layout.piles.find((pile) => pile.id === cursor?.pile);
  if (cursor === undefined || current === undefined) {
    return firstCursor(state, layout);
  }
  const here = stops(state, current);
  const position = here.indexOf(cursor.index);
  if (direction === "up" && position > 0) {
    return { pile: current.id, index: here[position - 1] ?? cursor.index };
  }
  if (direction === "down" && position >= 0 && position < here.length - 1) {
    return { pile: current.id, index: here[position + 1] ?? cursor.index };
  }
  const target = nearestPile(layout.piles, current, direction);
  if (target === undefined) {
    return cursor;
  }
  return { pile: target.id, index: stops(state, target).at(-1) ?? -1 };
}

/** Keeps the cursor on a real card after the table changes. */
export function settleCursor(
  state: GameState,
  layout: TableLayout,
  cursor: CardRef | undefined,
): CardRef | undefined {
  const pile = layout.piles.find((item) => item.id === cursor?.pile);
  if (cursor === undefined || pile === undefined) {
    return cursor;
  }
  const here = stops(state, pile);
  return here.includes(cursor.index) ? cursor : { pile: pile.id, index: here.at(-1) ?? -1 };
}

export function samePile(a: CardRef | undefined, pile: PileId, index: number): boolean {
  return a?.pile === pile && a.index === index;
}
