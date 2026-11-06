import { describe, expect, it } from "vitest";
import type { Card } from "../engine/cards.ts";
import { makeCards, withFace } from "../engine/cards.ts";
import { fanOffsets, fitCardWidth, MAX_CARD_WIDTH } from "./geometry.ts";

const cards = (up: number, down: number): Card[] =>
  makeCards()
    .slice(0, up + down)
    .map((card, index) => withFace(card, index >= down));

describe("fitCardWidth", () => {
  it("fits the narrower dimension", () => {
    const layout = { width: 7.8, height: 4, piles: [] };
    expect(fitCardWidth(layout, { width: 320, height: 1000 })).toBe(41);
    expect(fitCardWidth(layout, { width: 2000, height: 400 })).toBe(71);
  });

  it("caps the width on large screens", () => {
    const layout = { width: 7.8, height: 4, piles: [] };
    expect(fitCardWidth(layout, { width: 3840, height: 2160 })).toBe(MAX_CARD_WIDTH);
  });
});

describe("fanOffsets", () => {
  it("uses natural offsets when there is room", () => {
    const offsets = fanOffsets(cards(3, 2), 1000, 100, false);
    expect(offsets).toHaveLength(4);
    expect(offsets[0]).toBeCloseTo(12);
    expect(offsets[3]).toBeCloseTo(27);
  });

  it("squeezes face-down cards first", () => {
    const offsets = fanOffsets(cards(3, 6), 6 * 5 + 2 * 27, 100, false);
    expect(offsets[0]).toBeCloseTo(5);
    expect(offsets[7]).toBeCloseTo(27);
  });

  it("keeps face-up offsets above the readable minimum while it can", () => {
    const offsets = fanOffsets(cards(13, 0), 12 * 22, 100, false);
    expect(offsets[0]).toBeCloseTo(22);
  });

  it("always fits in the space available", () => {
    const offsets = fanOffsets(cards(20, 6), 150, 100, true);
    const total = offsets.reduce((sum, offset) => sum + offset, 0);
    expect(total).toBeLessThanOrEqual(150.0001);
  });
});
