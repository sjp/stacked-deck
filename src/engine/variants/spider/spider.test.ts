import { describe, expect, it } from "vitest";
import { play } from "../../game.ts";
import { findPile, getPile } from "../../state.ts";
import { allOfferedMovesLegal, codes, makeState, walk } from "../../testing.ts";
import type { GameState } from "../../types.ts";
import { spider } from "./spider.ts";

const COLUMNS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

function table(spec: { stock?: string; t?: string[]; done?: number }): GameState {
  return {
    ...makeState("spider", [
      { id: "stock", kind: "stock", cards: spec.stock ?? "" },
      ...[0, 1, 2, 3, 4, 5, 6, 7].map((i) => ({
        id: `f${i}`,
        kind: "foundation" as const,
        cards: i < (spec.done ?? 0) ? "KS QS JS 10S 9S 8S 7S 6S 5S 4S 3S 2S AS" : "",
      })),
      ...COLUMNS.map((i) => ({
        id: `t${i}`,
        kind: "tableau" as const,
        cards: spec.t?.[i] ?? "9D",
      })),
    ]),
    score: 500,
  };
}

describe("deal", () => {
  it.each([1, 2, 4])("deals 54 cards and leaves 50 in the stock (%i suits)", (suits) => {
    const state = spider.deal(8, { suits });
    const lengths = COLUMNS.map((i) => getPile(state, `t${i}`).cards.length);
    expect(lengths).toEqual([6, 6, 6, 6, 5, 5, 5, 5, 5, 5]);
    expect(getPile(state, "stock").cards).toHaveLength(50);
    const all = state.piles.flatMap((pile) => pile.cards);
    expect(new Set(all.map((card) => card.suit)).size).toBe(suits);
    expect(state.score).toBe(500);
  });
});

describe("moving runs", () => {
  it("moves a run of one suit, but not a mixed one", () => {
    const state = table({ t: ["-2C 9S 8S 7S", "10H", "9H 8S 7H", "10S"] });
    expect(spider.canMove(state, { kind: "move", from: "t0", index: 1, to: "t1" })).toBe(true);
    expect(spider.canMove(state, { kind: "move", from: "t2", index: 0, to: "t3" })).toBe(false);
    expect(spider.canMove(state, { kind: "move", from: "t2", index: 2, to: "t3" })).toBe(false);
    expect(spider.canPickUp(state, "t2", 0)).toBe(false);
    expect(spider.canPickUp(state, "t2", 2)).toBe(true);
  });

  it("builds down regardless of suit", () => {
    const state = table({ t: ["7H", "8S"] });
    const next = spider.applyMove(state, { kind: "move", from: "t0", index: 0, to: "t1" });
    expect(codes(findPile(next, "t1"))).toBe("8S 7H");
    expect(next.score).toBe(499);
  });
});

describe("completed runs", () => {
  it("go to a foundation automatically for 100 points", () => {
    const run = "KS QS JS 10S 9S 8S 7S 6S 5S 4S 3S 2S";
    const state = table({ t: ["-5D " + run, "AS"] });
    const step = play(
      spider,
      state,
      { kind: "move", from: "t1", index: 0, to: "t0" },
      {
        safeToFoundation: false,
      },
    )!;
    expect(step.moves.map((move) => move.kind)).toEqual(["move", "move", "flip"]);
    expect(getPile(step.state, "f0").cards).toHaveLength(13);
    expect(codes(findPile(step.state, "t0"))).toBe("5D");
    expect(step.state.score).toBe(500 - 1 + 100);
  });

  it("wins with all eight runs up", () => {
    expect(spider.isWon(table({ done: 8, t: COLUMNS.map(() => "") }))).toBe(true);
    expect(spider.isWon(table({ done: 7 }))).toBe(false);
  });
});

describe("dealing", () => {
  it("deals one card face up onto each column", () => {
    const stock = COLUMNS.map((i) => `-${i + 1}H`).join(" ");
    const next = spider.applyMove(table({ stock }), { kind: "draw" });
    expect(codes(findPile(next, "t0"))).toBe("9D 10H");
    expect(codes(findPile(next, "t9"))).toBe("9D AH");
    expect(getPile(next, "stock").cards).toHaveLength(0);
  });

  it("is not allowed while a column is empty", () => {
    const stock = COLUMNS.map(() => "-5C").join(" ");
    const t = ["9D", "9D", "9D", "", "9D", "9D", "9D", "9D", "9D", "9D"];
    expect(spider.canMove(table({ stock, t }), { kind: "draw" })).toBe(false);
    expect(spider.tapMoves(table({ stock, t }), "stock", 9)).toEqual([]);
    expect(spider.canMove(table({ stock }), { kind: "draw" })).toBe(true);
  });
});

describe("legal moves", () => {
  it.each([1, 2, 4])("are all legal (%i suits)", (suits) => {
    const states = walk(spider, spider.deal(4, { suits }), 200);
    expect(states.length).toBeGreaterThan(10);
    expect(allOfferedMovesLegal(spider, states)).toBe(true);
  });
});
