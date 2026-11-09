import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { klondike } from "../engine/variants/klondike/klondike.ts";
import { spider } from "../engine/variants/spider/spider.ts";
import { loadGame } from "./deals.ts";
import { saveGame } from "./gameStore.ts";
import { memoryStore } from "./storage.ts";
import type { Game } from "./useGame.ts";
import { currentState, gameReducer, newGame } from "./useGame.ts";

const AUTO = { safeToFoundation: true };

function withMove(game: Game): Game {
  const move = klondike.legalMoves(currentState(game))[0]!;
  return gameReducer(game, { type: "play", move, auto: AUTO });
}

describe("opening games and deal links", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", memoryStore());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("deals a link with the link's options, not the player's", () => {
    const opened = loadGame(spider, { seed: 7, params: { suits: "4" } }, { suits: 1 }, AUTO, true);
    expect(opened.game.seed).toBe(7);
    expect(opened.game.options).toEqual({ suits: 4 });
    expect(opened.pendingLink).toBeUndefined();
  });

  it("uses the player's options where the link has none or bad ones", () => {
    const opened = loadGame(spider, { seed: 7, params: { suits: "9" } }, { suits: 2 }, AUTO, true);
    expect(opened.game.options).toEqual({ suits: 2 });
  });

  it("keeps a game in progress and holds the link until the player confirms", () => {
    const inProgress = withMove(newGame(klondike, 1, { draw: 1 }, AUTO));
    saveGame(inProgress, { hints: 0, elapsedMs: 5000 });
    const opened = loadGame(klondike, { seed: 2, params: { draw: "3" } }, { draw: 1 }, AUTO, true);
    expect(opened.game.seed).toBe(1);
    expect(opened.elapsedMs).toBe(5000);
    expect(opened.pendingLink).toEqual({ seed: 2, options: { draw: 3 } });
  });

  it("resumes the saved game when the link is for the same deal", () => {
    const inProgress = withMove(newGame(klondike, 1, { draw: 3 }, AUTO));
    saveGame(inProgress, { hints: 1, elapsedMs: 0 });
    const opened = loadGame(klondike, { seed: 1, params: { draw: "3" } }, { draw: 1 }, AUTO, true);
    expect(opened.game.history.past).toHaveLength(1);
    expect(opened.pendingLink).toBeUndefined();
  });

  it("replaces a saved game with no moves without asking", () => {
    saveGame(newGame(klondike, 1, { draw: 1 }, AUTO), { hints: 0, elapsedMs: 0 });
    const opened = loadGame(klondike, { seed: 2, params: {} }, { draw: 1 }, AUTO, true);
    expect(opened.game.seed).toBe(2);
    expect(opened.pendingLink).toBeUndefined();
  });
});
