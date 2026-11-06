import { describe, expect, it } from "vitest";
import { cardName, colourOf, makeCards, rankLabel } from "./cards.ts";

describe("makeCards", () => {
  it("makes one standard deck with unique ids", () => {
    const deck = makeCards();
    expect(deck).toHaveLength(52);
    expect(new Set(deck.map((card) => card.id)).size).toBe(52);
    expect(deck.every((card) => !card.faceUp)).toBe(true);
  });

  it("makes eight copies of one suit for two one-suit decks", () => {
    const deck = makeCards(["spades"], 8);
    expect(deck).toHaveLength(104);
    expect(new Set(deck.map((card) => card.id)).size).toBe(104);
    expect(deck.every((card) => card.suit === "spades")).toBe(true);
  });
});

describe("names", () => {
  it("names cards", () => {
    expect(cardName({ rank: 12, suit: "hearts" })).toBe("queen of hearts");
    expect(cardName({ rank: 7, suit: "clubs" })).toBe("7 of clubs");
    expect(rankLabel(1)).toBe("A");
    expect(rankLabel(10)).toBe("10");
  });

  it("knows suit colours", () => {
    expect(colourOf("hearts")).toBe("red");
    expect(colourOf("diamonds")).toBe("red");
    expect(colourOf("spades")).toBe("black");
    expect(colourOf("clubs")).toBe("black");
  });
});
