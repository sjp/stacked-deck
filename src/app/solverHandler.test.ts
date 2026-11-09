import { describe, expect, it } from "vitest";
import { play, settle } from "../engine/game.ts";
import { klondike } from "../engine/variants/klondike/klondike.ts";
import type { Move } from "../engine/types.ts";
import { handle, respond } from "./solverHandler.ts";
import type { SolverResponse } from "./solverProtocol.ts";

const AUTO = { safeToFoundation: true };

const hintLine = (response: SolverResponse): readonly Move[] | undefined =>
  response.type === "hint" ? response.moves : undefined;
const dealSeed = (response: SolverResponse): number | undefined =>
  response.type === "deal" ? response.seed : undefined;

describe("solver worker requests", () => {
  it("answers a hint with a winning line from the position", () => {
    const state = klondike.deal(1, { draw: 1 });
    const response = handle({
      type: "hint",
      id: 1,
      variant: "klondike",
      state,
      auto: AUTO,
      budgetMs: 2000,
    });
    expect(response).toMatchObject({ type: "hint", id: 1 });
    const moves = hintLine(response)!;
    expect(klondike.canMove(state, moves[0]!)).toBe(true);
    let end = settle(klondike, state, AUTO).state;
    for (const move of moves) {
      end = play(klondike, end, move, AUTO)!.state;
    }
    expect(klondike.isWon(end)).toBe(true);
  });

  // Seeds are random, so the budget is generous: it returns as soon as one is won.
  it("finds a winnable deal", { timeout: 20_000 }, () => {
    const response = handle({
      type: "deal",
      id: 2,
      variant: "freecell",
      options: {},
      budgetMs: 15_000,
      perSeedMs: 3000,
    });
    expect(response).toMatchObject({ type: "deal", id: 2 });
    expect(dealSeed(response)).toBeTypeOf("number");
  });

  it("answers an unknown variant with nothing", () => {
    expect(
      handle({ type: "deal", id: 3, variant: "nope", options: {}, budgetMs: 10, perSeedMs: 10 }),
    ).toEqual({ type: "deal", id: 3, seed: undefined });
  });

  it("turns a request that throws into an error response", () => {
    const broken = { ...klondike.deal(1, { draw: 1 }), piles: [] };
    expect(
      respond({
        type: "hint",
        id: 4,
        variant: "klondike",
        state: broken,
        auto: AUTO,
        budgetMs: 10,
      }),
    ).toMatchObject({ type: "error", id: 4 });
  });
});
