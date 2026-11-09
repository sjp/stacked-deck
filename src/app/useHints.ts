import { useEffect, useMemo, useRef, useState } from "react";
import type { HintLine } from "../engine/hintLine.ts";
import { hintLine } from "../engine/hintLine.ts";
import { hasUsefulMoves, rankHints } from "../engine/hints.ts";
import { findPile } from "../engine/state.ts";
import type { GameState, Move } from "../engine/types.ts";
import type { AutoMoveOptions, Variant } from "../engine/variant.ts";
import type { Highlight } from "../ui/Table.tsx";
import { solverLine } from "./solverClient.ts";

/** How long the solver may look for a winning line before the rule-based hint stands. */
const SOLVER_HINT_MS = 300;

/** What to light up for a suggested move. */
export function highlightFor(state: GameState, move: Move): Highlight {
  const top = (pile: string) => (findPile(state, pile)?.cards.length ?? 0) - 1;
  if (move.kind === "move") {
    return { from: { pile: move.from, index: move.index }, to: move.to };
  }
  if (move.kind === "flip") {
    return { from: { pile: move.pile, index: top(move.pile) } };
  }
  if (move.kind === "remove") {
    const [first, second] = move.piles;
    if (first === undefined) {
      return {};
    }
    return second === undefined
      ? { from: { pile: first, index: top(first) } }
      : { from: { pile: first, index: top(first) }, to: second };
  }
  const stock = state.piles.find((pile) => pile.kind === "stock");
  return stock === undefined ? {} : { from: { pile: stock.id, index: top(stock.id) } };
}

/**
 * Hints for the current position; pressing again cycles to the next suggestion. `auto` is
 * the player's automatic-move setting, which the solver needs to start from this position.
 *
 * The first hint for a position comes from the solver's winning line. The line is kept, so
 * while the player follows it (or undoes back onto it) the next hint is its next move,
 * found at once and never leading back to a position already passed; leaving the line
 * means a fresh search.
 */
export function useHints(
  variant: Variant,
  state: GameState,
  auto: AutoMoveOptions,
  active: boolean,
) {
  const hints = useMemo(() => rankHints(variant, state), [variant, state]);
  const stuck = useMemo(() => active && !hasUsefulMoves(variant, state), [active, variant, state]);
  const [shown, setShown] = useState<{ state: GameState; index: number }>();
  const [solved, setSolved] = useState<{ state: GameState; move: Move }>();
  const [dismissed, setDismissed] = useState<GameState>();
  // The solver request for the hint being worked out; dropped when the position changes.
  const request = useRef<{ state: GameState; controller: AbortController } | undefined>(undefined);
  const line = useRef<HintLine | undefined>(undefined);
  useEffect(() => {
    if (request.current !== undefined && request.current.state !== state) {
      request.current.controller.abort();
      request.current = undefined;
    }
  }, [state]);
  useEffect(
    () => () => {
      request.current?.controller.abort();
    },
    [],
  );

  const index = shown?.state === state ? shown.index : undefined;
  // The first hint for a position comes from the solver's line when it finds a win in time.
  const solverMove = index === 0 && solved?.state === state ? solved.move : undefined;
  const move =
    solverMove ?? (index === undefined ? undefined : hints[index % Math.max(1, hints.length)]);

  return {
    highlight: move === undefined ? undefined : highlightFor(state, move),
    /** Only stock cycling is left. */
    noUsefulMoves: stuck && dismissed !== state,
    /** Shows the next hint; returns false if there is none. */
    next: (): boolean => {
      if (hints.length === 0) {
        setDismissed(undefined);
        return false;
      }
      setShown({ state, index: index === undefined ? 0 : index + 1 });
      if (index === undefined) {
        request.current?.controller.abort();
        request.current = undefined;
        const kept = line.current?.variant === variant ? line.current.next(state) : undefined;
        if (kept !== undefined) {
          setSolved({ state, move: kept });
          return true;
        }
        const controller = new AbortController();
        request.current = { state, controller };
        const ask = async () => {
          const moves = await solverLine(
            variant.id,
            state,
            auto,
            SOLVER_HINT_MS,
            controller.signal,
          );
          if (moves === undefined) {
            return;
          }
          line.current = hintLine(variant, state, moves, auto);
          const found = moves[0];
          // A move that doesn't fit this position would point at the wrong cards.
          if (found !== undefined && variant.canMove(state, found)) {
            setSolved({ state, move: found });
          }
        };
        ask().catch((error: unknown) => {
          console.warn("Solver hint failed", error);
        });
      }
      return true;
    },
    dismiss: () => {
      setDismissed(state);
    },
  };
}
