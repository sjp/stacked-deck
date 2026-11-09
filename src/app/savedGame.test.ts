import { describe, expect, it } from "vitest";
import { klondike } from "../engine/variants/klondike/klondike.ts";
import { parseSaved, restoreGame, toSaved } from "./savedGame.ts";
import { memoryStore, readStored, writeStored } from "./storage.ts";
import type { Game } from "./useGame.ts";
import { gameReducer, newGame } from "./useGame.ts";

const AUTO = { safeToFoundation: true };

function playSome(game: Game, count: number): Game {
  let current = game;
  for (let i = 0; i < count; i++) {
    const moves = klondike.legalMoves(current.history.present.state);
    const move = moves[i % moves.length]!;
    current = gameReducer(current, { type: "play", move, auto: AUTO });
  }
  return current;
}

describe("saved games", () => {
  it("rebuilds the same table, score and undo history", () => {
    let game = playSome(newGame(klondike, 77, { draw: 3 }, AUTO), 40);
    game = gameReducer(gameReducer(game, { type: "undo" }), { type: "undo" });
    const store = memoryStore();
    writeStored("game:klondike", toSaved(game, { hints: 2, elapsedMs: 61_000 }), store);

    const saved = parseSaved(readStored("game:klondike", store));
    expect(saved?.hints).toBe(2);
    expect(saved?.elapsedMs).toBe(61_000);
    const restored = restoreGame(klondike, saved!);
    expect(restored?.history.present.state).toEqual(game.history.present.state);
    expect(restored?.history.past.map((step) => step.state)).toEqual(
      game.history.past.map((step) => step.state),
    );
    expect(restored?.history.future).toHaveLength(2);
    expect(restored?.undos).toBe(2);

    const redone = gameReducer(gameReducer(restored!, { type: "redo" }), { type: "redo" });
    const original = gameReducer(gameReducer(game, { type: "redo" }), { type: "redo" });
    expect(redone.history.present.state).toEqual(original.history.present.state);
  });

  it("discards corrupt data", () => {
    expect(parseSaved(undefined)).toBeUndefined();
    expect(parseSaved({ variant: "klondike", seed: -1 })).toBeUndefined();
    const good = toSaved(newGame(klondike, 1, { draw: 1 }, AUTO), { hints: 0, elapsedMs: 0 });
    expect(parseSaved({ ...good, steps: [[{ kind: "teleport" }]] })).toBeUndefined();
    expect(parseSaved({ ...good, cursor: 5 })).toBeUndefined();
  });

  it("ignores fields it no longer uses", () => {
    const good = toSaved(newGame(klondike, 1, { draw: 1 }, AUTO), { hints: 0, elapsedMs: 0 });
    expect(parseSaved({ ...good, daily: "2026-11-06" })).toEqual(good);
  });

  it("rejects moves that no longer apply", () => {
    const good = toSaved(newGame(klondike, 1, { draw: 1 }, AUTO), { hints: 0, elapsedMs: 0 });
    const bad = {
      ...good,
      steps: [...good.steps, [{ kind: "move", from: "t0", index: 0, to: "f0" }]],
    };
    const parsed = parseSaved(bad);
    expect(parsed).toBeDefined();
    expect(restoreGame(klondike, parsed!)).toBeUndefined();
  });

  it("ignores data from another schema version", () => {
    const store = memoryStore();
    store.setItem("stacked-deck:x", JSON.stringify({ schemaVersion: 999, data: 1 }));
    store.setItem("stacked-deck:y", "{not json");
    expect(readStored("x", store)).toBeUndefined();
    expect(readStored("y", store)).toBeUndefined();
  });
});
