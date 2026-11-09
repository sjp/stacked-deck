// @vitest-environment happy-dom
import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { loadStats } from "./statsStore.ts";
import { gameOn, timerAt } from "./testing.ts";
import { useGameOutcome } from "./useGameOutcome.ts";

afterEach(() => {
  localStorage.clear();
});

describe("game outcome", () => {
  it("records a win once however often the screen re-renders", () => {
    const game = gameOn(true);
    const timer = timerAt(() => 90_000);
    const { rerender, result } = renderHook(() => useGameOutcome(game, 0, true, timer, 0));
    rerender();
    rerender();
    result.current.end("abandon");
    expect(loadStats()["klondike:draw=1"]).toMatchObject({ played: 1, won: 1, streak: 1 });
  });

  it("records an abandoned game once", () => {
    const game = gameOn(false);
    const { result } = renderHook(() =>
      useGameOutcome(
        game,
        0,
        false,
        timerAt(() => 0),
        0,
      ),
    );
    result.current.end("abandon");
    result.current.end("loss");
    expect(loadStats()["klondike:draw=1"]).toBeUndefined();
    expect(result.current.ended()).toBe(true);
  });
});
