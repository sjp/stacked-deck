import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VARIANTS } from "../engine/variants/index.ts";
import { klondike } from "../engine/variants/klondike/klondike.ts";
import { clearGame, loadSavedGame, saveGame, variantsInProgress } from "./gameStore.ts";
import { memoryStore, writeStored } from "./storage.ts";
import { currentState, gameReducer, newGame } from "./useGame.ts";

const AUTO = { safeToFoundation: true };

describe("saved games by variant", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", memoryStore());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("lists variants with a game that has moves", () => {
    const fresh = newGame(klondike, 1, { draw: 1 }, AUTO);
    saveGame(fresh, { hints: 0, elapsedMs: 0 });
    expect(variantsInProgress(VARIANTS)).toEqual(new Set());
    const move = klondike.legalMoves(currentState(fresh))[0]!;
    saveGame(gameReducer(fresh, { type: "play", move, auto: AUTO }), { hints: 0, elapsedMs: 0 });
    expect(variantsInProgress(VARIANTS)).toEqual(new Set(["klondike"]));
    clearGame("klondike");
    expect(variantsInProgress(VARIANTS)).toEqual(new Set());
  });

  it("ignores a malformed save", () => {
    writeStored("game:klondike", { variant: "klondike", seed: "x" });
    expect(loadSavedGame(klondike)).toBeUndefined();
    expect(variantsInProgress(VARIANTS)).toEqual(new Set());
  });
});
