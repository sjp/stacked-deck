import { describe, expect, it } from "vitest";
import { klondike } from "../engine/variants/klondike/klondike.ts";
import type { Move } from "../engine/types.ts";
import { handle, respond } from "./solverHandler.ts";
import type { SolverResponse } from "./solverProtocol.ts";

const AUTO = { safeToFoundation: true };

const hintMove = (response: SolverResponse): Move | undefined =>
  response.type === "hint" ? response.move : undefined;
const dealSeed = (response: SolverResponse): number | undefined =>
  response.type === "deal" ? response.seed : undefined;

describe("solver worker requests", () => {
  it("answers a hint with a legal move", () => {
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
    expect(klondike.canMove(state, hintMove(response)!)).toBe(true);
  });

  it("finds a winnable deal", () => {
    const response = handle({
      type: "deal",
      id: 2,
      variant: "freecell",
      options: {},
      budgetMs: 2000,
      perSeedMs: 500,
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
