import { describe, expect, it } from "vitest";
import { play, settle } from "./game.ts";
import type { HintLine } from "./hintLine.ts";
import { hintLine } from "./hintLine.ts";
import { SOLVER_AUTO, solve } from "./solver.ts";
import { findPile, withPiles } from "./state.ts";
import type { GameState, Move } from "./types.ts";
import type { AutoMoveOptions } from "./variant.ts";
import { freecell } from "./variants/freecell/freecell.ts";

const OFF = { safeToFoundation: false };

function lineFrom(
  seed: number,
  startAuto: AutoMoveOptions = SOLVER_AUTO,
): { start: GameState; moves: readonly Move[] } {
  const start = freecell.deal(seed, {});
  const result = solve(freecell, start, { maxNodes: 200_000, maxMs: 10_000 }, { startAuto });
  if (result.status !== "solved") {
    throw new Error(`FreeCell deal ${seed} wasn't solved`);
  }
  return { start, moves: result.moves };
}

/** Plays the line's moves for as long as it has one, returning where that ends. */
function follow(line: HintLine, start: GameState, auto: AutoMoveOptions): GameState {
  let state = start;
  for (let move = line.next(state); move !== undefined; move = line.next(state)) {
    const next = play(freecell, state, move, auto);
    if (next === undefined) {
      break;
    }
    state = next.state;
  }
  return state;
}

describe("hint lines", () => {
  it("serve each move in turn while the player follows the line, and nothing once won", () => {
    const { start, moves } = lineFrom(1);
    const line = hintLine(freecell, start, moves);
    let state = settle(freecell, start, SOLVER_AUTO).state;
    for (const move of moves) {
      expect(line.next(state)).toEqual(move);
      state = play(freecell, state, move, SOLVER_AUTO)!.state;
    }
    expect(freecell.isWon(state)).toBe(true);
    expect(line.next(state)).toBeUndefined();
  });

  it("serve the move again after going back to a position on the line", () => {
    const { start, moves } = lineFrom(1);
    const line = hintLine(freecell, start, moves);
    const first = settle(freecell, start, SOLVER_AUTO).state;
    const second = play(freecell, first, moves[0]!, SOLVER_AUTO)!.state;
    expect(line.next(second)).toEqual(moves[1]);
    expect(line.next(first)).toEqual(moves[0]);
  });

  it("serve nothing once the player leaves the line", () => {
    const { start, moves } = lineFrom(1);
    const line = hintLine(freecell, start, moves);
    const first = settle(freecell, start, SOLVER_AUTO).state;
    const other = freecell
      .legalMoves(first)
      .find((move) => JSON.stringify(move) !== JSON.stringify(moves[0]))!;
    expect(line.next(play(freecell, first, other, SOLVER_AUTO)!.state)).toBeUndefined();
  });

  it("serve nothing when the line's move would take different cards on screen", () => {
    const { start, moves } = lineFrom(1);
    const line = hintLine(freecell, start, moves);
    const first = settle(freecell, start, SOLVER_AUTO).state;
    expect(moves[0]).toMatchObject({ from: "t4", index: 5 });
    // Swapping two columns of the same length keeps the position's key, but the move now
    // picks up another card.
    const swapped = withPiles(first, {
      t4: findPile(first, "t5")!.cards,
      t5: findPile(first, "t4")!.cards,
    });
    expect(freecell.canMove(swapped, moves[0]!)).toBe(true);
    expect(line.next(swapped)).toBeUndefined();
  });

  it("serve a player with automatic moves off, while the line's move is legal on screen", () => {
    const { start, moves } = lineFrom(5);
    const line = hintLine(freecell, start, moves);
    const onScreen = settle(freecell, start, OFF).state;
    expect(settle(freecell, onScreen, SOLVER_AUTO).moves).not.toEqual([]);
    expect(line.next(onScreen)).toEqual(moves[0]);
  });

  it("serve the moves up first when the line's move waits for cards automatic moves left out", () => {
    const { start, moves } = lineFrom(2);
    const line = hintLine(freecell, start, moves);
    let onScreen = settle(freecell, start, OFF).state;
    const waiting = settle(freecell, onScreen, SOLVER_AUTO).moves;
    expect(freecell.canMove(onScreen, moves[0]!)).toBe(false);
    for (const move of waiting) {
      expect(line.next(onScreen)).toEqual(move);
      onScreen = play(freecell, onScreen, move, OFF)!.state;
    }
    expect(line.next(onScreen)).toEqual(moves[0]);
  });

  it("start from the position as the player's automatic moves left it", () => {
    const { start, moves } = lineFrom(2, OFF);
    const line = hintLine(freecell, start, moves, OFF);
    expect(line.next(settle(freecell, start, OFF).state)).toEqual(moves[0]);
  });

  it("lead a player with automatic moves off all the way to a win", () => {
    const { start, moves } = lineFrom(2, OFF);
    const line = hintLine(freecell, start, moves, OFF);
    const end = follow(line, settle(freecell, start, OFF).state, OFF);
    expect(freecell.isWon(end)).toBe(true);
  });
});
