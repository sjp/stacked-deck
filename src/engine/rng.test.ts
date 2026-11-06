import { describe, expect, it } from "vitest";
import { makeCards } from "./cards.ts";
import { hashString, mulberry32, normalizeSeed, shuffle } from "./rng.ts";

describe("mulberry32", () => {
  it("gives fixed outputs for a seed", () => {
    const random = mulberry32(1);
    const values = [random(), random(), random()].map((value) => value.toFixed(8));
    expect(values).toEqual(["0.62707394", "0.00273572", "0.52744704"]);
  });

  it("stays in [0, 1)", () => {
    const random = mulberry32(123_456);
    for (let i = 0; i < 10_000; i++) {
      const value = random();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe("shuffle", () => {
  it("is the same for the same seed", () => {
    const deck = makeCards();
    const a = shuffle(deck, mulberry32(42)).map((card) => card.id);
    const b = shuffle(deck, mulberry32(42)).map((card) => card.id);
    expect(a).toEqual(b);
    expect(a.slice(0, 8)).toEqual([41, 47, 14, 25, 51, 34, 6, 49]);
  });

  it("differs between seeds", () => {
    const deck = makeCards();
    const a = shuffle(deck, mulberry32(1)).map((card) => card.id);
    const b = shuffle(deck, mulberry32(2)).map((card) => card.id);
    expect(a).not.toEqual(b);
  });

  it.each([1, 2])("is a permutation of %i deck(s)", (decks) => {
    const deck = makeCards(undefined, decks);
    const shuffled = shuffle(deck, mulberry32(7));
    expect(shuffled).toHaveLength(52 * decks);
    expect(new Set(shuffled.map((card) => card.id)).size).toBe(52 * decks);
    expect(shuffled.map((card) => card.id).toSorted((a, b) => a - b)).toEqual(
      deck.map((card) => card.id),
    );
  });

  it("does not change its input", () => {
    const deck = makeCards();
    const ids = deck.map((card) => card.id);
    shuffle(deck, mulberry32(3));
    expect(deck.map((card) => card.id)).toEqual(ids);
  });
});

describe("seeds", () => {
  it("normalizes to an unsigned 32-bit integer", () => {
    expect(normalizeSeed(-1)).toBe(4_294_967_295);
    expect(normalizeSeed(2 ** 32 + 5)).toBe(5);
    expect(normalizeSeed(12.7)).toBe(12);
  });

  it("hashes strings stably", () => {
    expect(hashString("")).toBe(2_166_136_261);
    expect(hashString("2026-11-06klondike")).toBe(hashString("2026-11-06klondike"));
    expect(hashString("a")).not.toBe(hashString("b"));
  });
});
