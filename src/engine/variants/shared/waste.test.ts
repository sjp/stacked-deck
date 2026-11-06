import { describe, expect, it } from "vitest";
import { card } from "../../testing.ts";
import { canPlayOnWaste } from "./waste.ts";

const both = { wrap: true, onKing: true };
const classic = { wrap: false, onKing: false };

describe("canPlayOnWaste", () => {
  it("plays one rank up or down", () => {
    expect(canPlayOnWaste(card("5H"), card("6S"), classic)).toBe(true);
    expect(canPlayOnWaste(card("7H"), card("6S"), classic)).toBe(true);
    expect(canPlayOnWaste(card("8H"), card("6S"), classic)).toBe(false);
    expect(canPlayOnWaste(card("6H"), card("6S"), classic)).toBe(false);
  });

  it("wraps between King and Ace only when allowed", () => {
    expect(canPlayOnWaste(card("AH"), card("KS"), both)).toBe(true);
    expect(canPlayOnWaste(card("KH"), card("AS"), both)).toBe(true);
    expect(canPlayOnWaste(card("KH"), card("AS"), classic)).toBe(false);
  });

  it("blocks play onto a King unless allowed", () => {
    expect(canPlayOnWaste(card("QH"), card("KS"), classic)).toBe(false);
    expect(canPlayOnWaste(card("QH"), card("KS"), { wrap: false, onKing: true })).toBe(true);
    expect(canPlayOnWaste(card("KH"), card("QS"), classic)).toBe(true);
  });

  it("needs a face-up card and a waste card", () => {
    expect(canPlayOnWaste(card("-5H"), card("6S"), both)).toBe(false);
    expect(canPlayOnWaste(card("5H"), undefined, both)).toBe(false);
  });
});
