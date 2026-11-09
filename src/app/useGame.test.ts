import { describe, expect, it } from "vitest";
import { mulberry32 } from "../engine/rng.ts";
import type { Move } from "../engine/types.ts";
import { klondike } from "../engine/variants/klondike/klondike.ts";
import type { Game } from "./useGame.ts";
import { currentState, gameReducer, hasStarted, newGame, redoable, undoable } from "./useGame.ts";

const AUTO = { safeToFoundation: true };

/** A tableau move that leaves a face-down card on top. */
function exposesCard(move: Move): boolean {
  return move.kind === "move" && move.index > 0 && move.from.startsWith("t");
}

describe("undo and redo", () => {
  it.each([
    [1, 1],
    [2, 3],
    [3, 1],
    [4, 3],
    [5, 1],
  ])("undo to the start and redo to the end (seed %i, draw %i)", (seed, draw) => {
    const random = mulberry32(seed);
    const start = newGame(klondike, seed, { draw }, AUTO);
    let game: Game = start;
    for (let i = 0; i < 80; i++) {
      const moves = klondike.legalMoves(currentState(game));
      const move = moves[Math.floor(random() * moves.length)]!;
      game = gameReducer(game, { type: "play", move, auto: AUTO });
    }
    const end = currentState(game);
    let undone = game;
    while (undoable(undone)) {
      undone = gameReducer(undone, { type: "undo" });
    }
    expect(currentState(undone)).toBe(currentState(start));
    let redone = undone;
    while (redoable(redone)) {
      redone = gameReducer(redone, { type: "redo" });
    }
    expect(currentState(redone)).toBe(end);
    expect(redone.undos).toBe(80);
  });

  it("clears the redo stack on a new move", () => {
    let game = newGame(klondike, 9, { draw: 1 }, AUTO);
    game = gameReducer(game, { type: "play", move: { kind: "draw" }, auto: AUTO });
    game = gameReducer(game, { type: "play", move: { kind: "draw" }, auto: AUTO });
    game = gameReducer(game, { type: "undo" });
    expect(redoable(game)).toBe(true);
    game = gameReducer(game, { type: "play", move: { kind: "draw" }, auto: AUTO });
    expect(redoable(game)).toBe(false);
  });

  it("undoes a move together with its automatic flip", () => {
    let game = newGame(klondike, 3, { draw: 1 }, AUTO);
    const before = currentState(game);
    const flipping = klondike.legalMoves(before).find((move) => exposesCard(move));
    expect(flipping).toBeDefined();
    game = gameReducer(game, { type: "play", move: flipping!, auto: AUTO });
    expect(game.history.present.moves.length).toBeGreaterThan(1);
    expect(currentState(gameReducer(game, { type: "undo" }))).toBe(before);
  });
});

describe("hasStarted", () => {
  it("stays true after undoing back to the deal", () => {
    const start = newGame(klondike, 3, { draw: 1 }, AUTO);
    expect(hasStarted(start)).toBe(false);
    const move = klondike.legalMoves(currentState(start))[0]!;
    const played = gameReducer(start, { type: "play", move, auto: AUTO });
    expect(hasStarted(played)).toBe(true);
    const undone = gameReducer(played, { type: "undo" });
    expect(undone.history.past).toHaveLength(0);
    expect(hasStarted(undone)).toBe(true);
  });
});
