import { describe, expect, it } from "vitest";
import { MAX_AUTO_MOVES, nextFoundationMove, play, replay, settle } from "./game.ts";
import { makeState, walk } from "./testing.ts";
import { klondike } from "./variants/klondike/klondike.ts";
import { VARIANTS } from "./variants/index.ts";

describe("settle", () => {
  it.each(VARIANTS.map((variant) => [variant.id, variant] as const))(
    "stops well before its safety limit (%s)",
    (_, variant) => {
      const counts = [1, 2, 3].flatMap((seed) =>
        walk(variant, variant.deal(seed, variant.defaultOptions), 80).map(
          (state) => settle(variant, state, { safeToFoundation: true }).moves.length,
        ),
      );
      // Hitting the limit would mean a variant's automatic moves never settle.
      expect(Math.max(...counts)).toBeLessThan(MAX_AUTO_MOVES);
    },
  );
});

function klondikeTable(tableau: string, foundation = ""): ReturnType<typeof makeState> {
  return makeState(
    "klondike",
    [
      { id: "stock", kind: "stock" },
      { id: "waste", kind: "waste" },
      { id: "f0", kind: "foundation", cards: foundation },
      { id: "t0", kind: "tableau", cards: tableau },
      { id: "t1", kind: "tableau" },
    ],
    { draw: 1 },
  );
}

describe("play and replay", () => {
  it("refuse an illegal move", () => {
    const state = klondikeTable("5H");
    const illegal = { kind: "move", from: "t0", index: 0, to: "f0" } as const;
    expect(play(klondike, state, illegal, { safeToFoundation: true })).toBeUndefined();
    expect(() => replay(klondike, state, [[illegal]])).toThrow("Illegal move");
  });

  it("follow a move with its automatic moves", () => {
    const state = klondikeTable("2H AH");
    const step = play(
      klondike,
      state,
      { kind: "move", from: "t0", index: 1, to: "f0" },
      {
        safeToFoundation: true,
      },
    );
    expect(step?.moves).toHaveLength(2);
    expect(step?.state.piles.find((pile) => pile.id === "f0")?.cards).toHaveLength(2);
  });
});

describe("nextFoundationMove", () => {
  it("finds a card that can go up, or nothing", () => {
    expect(nextFoundationMove(klondike, klondikeTable("AH"))).toEqual({
      kind: "move",
      from: "t0",
      index: 0,
      to: "f0",
    });
    expect(nextFoundationMove(klondike, klondikeTable("5H"))).toBeUndefined();
  });
});
