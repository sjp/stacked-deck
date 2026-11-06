import { describe, expect, it } from "vitest";
import { withPiles } from "../engine/state.ts";
import { cards } from "../engine/testing.ts";
import { klondike } from "../engine/variants/klondike/klondike.ts";
import { moveCursor, settleCursor } from "./keyboardNav.ts";

const state = klondike.deal(4, { draw: 1 });
const layout = klondike.layout(state, { landscape: false, leftHanded: false });

describe("moveCursor", () => {
  it("starts on the first pile", () => {
    expect(moveCursor(state, layout, undefined, "right")).toEqual({ pile: "stock", index: 23 });
  });

  it("moves between neighbouring piles", () => {
    expect(moveCursor(state, layout, { pile: "stock", index: 23 }, "right")).toEqual({
      pile: "waste",
      index: -1,
    });
    expect(moveCursor(state, layout, { pile: "t2", index: 2 }, "right")).toEqual({
      pile: "t3",
      index: 3,
    });
    expect(moveCursor(state, layout, { pile: "t0", index: 0 }, "up")).toEqual({
      pile: "stock",
      index: 23,
    });
    expect(moveCursor(state, layout, { pile: "f0", index: -1 }, "down")).toMatchObject({
      pile: "t3",
    });
  });

  it("stays put at the edge", () => {
    expect(moveCursor(state, layout, { pile: "t6", index: 6 }, "right")).toEqual({
      pile: "t6",
      index: 6,
    });
  });

  it("moves along face-up cards of a fanned pile", () => {
    const fanned = withPiles(state, { t0: cards("-2C 9H 8S 7D") });
    expect(moveCursor(fanned, layout, { pile: "t0", index: 3 }, "up")).toEqual({
      pile: "t0",
      index: 2,
    });
    expect(moveCursor(fanned, layout, { pile: "t0", index: 1 }, "up")).toEqual({
      pile: "stock",
      index: 23,
    });
    expect(moveCursor(fanned, layout, { pile: "t0", index: 1 }, "down")).toEqual({
      pile: "t0",
      index: 2,
    });
    expect(settleCursor(fanned, layout, { pile: "t0", index: 0 })).toEqual({
      pile: "t0",
      index: 3,
    });
  });
});
