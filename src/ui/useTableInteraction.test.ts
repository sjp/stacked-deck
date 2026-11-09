import { describe, expect, it } from "vitest";
import { getPile } from "../engine/state.ts";
import { makeState } from "../engine/testing.ts";
import type { GameState } from "../engine/types.ts";
import { freecell } from "../engine/variants/freecell/freecell.ts";
import { dropMoveOnto } from "./useTableInteraction.ts";

const RUN = "9S 8H 7C 6D";

function table(spec: { c?: string[]; f?: string[]; t?: string[] }): GameState {
  return makeState("freecell", [
    ...[0, 1, 2, 3].map((i) => ({ id: `c${i}`, kind: "cell" as const, cards: spec.c?.[i] ?? "" })),
    ...[0, 1, 2, 3].map((i) => ({
      id: `f${i}`,
      kind: "foundation" as const,
      cards: spec.f?.[i] ?? "",
    })),
    ...[0, 1, 2, 3, 4, 5, 6, 7].map((i) => ({
      id: `t${i}`,
      kind: "tableau" as const,
      cards: spec.t?.[i] ?? "KD",
    })),
  ]);
}

function drop(state: GameState, index: number, to: string) {
  return dropMoveOnto(freecell, state, { pile: "t0", index }, getPile(state, to));
}

describe("dropping a dragged run", () => {
  it("moves the tail that fits when a run is grabbed too deep for a column", () => {
    const state = table({ t: [RUN, "8D"] });
    expect(drop(state, 0, "t1")).toEqual({ kind: "move", from: "t0", index: 2, to: "t1" });
  });

  it("moves everything grabbed when it fits", () => {
    const state = table({ t: [RUN, "10D"] });
    expect(drop(state, 0, "t1")).toEqual({ kind: "move", from: "t0", index: 0, to: "t1" });
  });

  it("moves the longest tail there's room for into an empty column", () => {
    // One free cell and no other empty column: two cards at most.
    const state = table({ c: ["AS", "2S", "3S"], t: [RUN, ""] });
    expect(drop(state, 0, "t1")).toEqual({ kind: "move", from: "t0", index: 2, to: "t1" });
  });

  it("takes exactly what was grabbed onto other piles", () => {
    const state = table({ f: ["AD 2D 3D 4D 5D"], t: [RUN] });
    expect(drop(state, 2, "f0")).toBeUndefined();
    expect(drop(state, 3, "f0")).toEqual({ kind: "move", from: "t0", index: 3, to: "f0" });
    expect(drop(state, 2, "c0")).toBeUndefined();
  });

  it("refuses a column that no tail fits", () => {
    const state = table({ t: [RUN, "QS"] });
    expect(drop(state, 0, "t1")).toBeUndefined();
  });
});
