import { useState } from "react";
import type { Card } from "../engine/cards.ts";
import { pilesOfKind } from "../engine/state.ts";
import type { GameState } from "../engine/types.ts";

/** Foundation cards from the top down, taking one from each pile in turn. */
export function cardsForCelebration(state: GameState): Card[] {
  // Games without foundations (TriPeaks, Golf) throw their waste pile instead.
  const kind = pilesOfKind(state, "foundation").length > 0 ? "foundation" : "waste";
  const foundations = pilesOfKind(state, kind).map((pile) => pile.cards);
  const cards: Card[] = [];
  const depth = Math.max(0, ...foundations.map((pile) => pile.length));
  for (let level = 1; level <= depth; level++) {
    for (const pile of foundations) {
      const card = pile.at(-level);
      if (card !== undefined) {
        cards.push(card);
      }
    }
  }
  return cards;
}

/** Whether to skip straight to the win summary. */
export function prefersReducedMotion(): boolean {
  return globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export type WinPhase = "animating" | "dialog" | "closed";

/**
 * Tracks the win celebration. It belongs to the winning state, so undoing the last move
 * or dealing again ends it.
 */
export function useWinCelebration(won: boolean, state: GameState, animate: boolean) {
  const [win, setWin] = useState<{ state: GameState; phase: WinPhase }>();
  if (won && win?.state !== state) {
    setWin({ state, phase: animate && !prefersReducedMotion() ? "animating" : "dialog" });
  }
  return {
    phase: won && win?.state === state ? win.phase : undefined,
    setPhase: (phase: WinPhase) => {
      setWin({ state, phase });
    },
  };
}
