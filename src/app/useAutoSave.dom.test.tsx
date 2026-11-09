// @vitest-environment happy-dom
import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { klondike } from "../engine/variants/klondike/klondike.ts";
import { loadSavedGame } from "./gameStore.ts";
import { gameOn, timerAt } from "./testing.ts";
import { useAutoSave } from "./useAutoSave.ts";

afterEach(() => {
  localStorage.clear();
});

describe("auto-save", () => {
  it("saves the time spent since the last move when the screen closes", () => {
    let now = 10_000;
    const game = gameOn(false);
    const { unmount } = renderHook(() =>
      useAutoSave(
        game,
        0,
        timerAt(() => now),
        () => false,
      ),
    );
    expect(loadSavedGame(klondike)?.elapsedMs).toBe(10_000);
    now = 130_000;
    unmount();
    expect(loadSavedGame(klondike)?.elapsedMs).toBe(130_000);
  });

  it("drops the save of a game whose outcome is recorded", () => {
    const game = gameOn(false);
    const { unmount } = renderHook(() =>
      useAutoSave(
        game,
        0,
        timerAt(() => 0),
        () => true,
      ),
    );
    unmount();
    expect(loadSavedGame(klondike)).toBeUndefined();
  });
});
