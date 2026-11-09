import { describe, expect, it } from "vitest";
import { nextFoundationMove, play, replay, settle } from "../../game.ts";
import { findPile, getPile, pilesOfKind } from "../../state.ts";
import { codes, makeState } from "../../testing.ts";
import type { GameState, Move } from "../../types.ts";
import { klondike } from "./klondike.ts";

const NO_AUTO = { safeToFoundation: false };

interface Spec {
  stock?: string;
  waste?: string;
  f?: readonly (string | undefined)[];
  t?: string[];
}

function table(spec: Spec, draw = 1, recycles = 0): GameState {
  return makeState(
    "klondike",
    [
      { id: "stock", kind: "stock", cards: spec.stock ?? "" },
      { id: "waste", kind: "waste", cards: spec.waste ?? "" },
      ...[0, 1, 2, 3].map((i) => ({
        id: `f${i}`,
        kind: "foundation" as const,
        cards: spec.f?.[i] ?? "",
      })),
      ...[0, 1, 2, 3, 4, 5, 6].map((i) => ({
        id: `t${i}`,
        kind: "tableau" as const,
        cards: spec.t?.[i] ?? "",
      })),
    ],
    { draw },
    { recycles },
  );
}

const pile = (state: GameState, id: string) => codes(findPile(state, id));

describe("deal", () => {
  it("deals 1–7 cards with the top face up and 24 in the stock", () => {
    const state = klondike.deal(123, klondike.defaultOptions);
    for (let i = 0; i < 7; i++) {
      const cards = getPile(state, `t${i}`).cards;
      expect(cards).toHaveLength(i + 1);
      expect(cards.map((card) => card.faceUp)).toEqual(cards.map((_, row) => row === i));
    }
    expect(getPile(state, "stock").cards).toHaveLength(24);
    expect(getPile(state, "stock").cards.every((card) => !card.faceUp)).toBe(true);
  });

  it("is the same for the same seed", () => {
    expect(klondike.deal(99, { draw: 1 })).toEqual(klondike.deal(99, { draw: 1 }));
    expect(klondike.deal(99, { draw: 1 })).not.toEqual(klondike.deal(100, { draw: 1 }));
  });
});

describe("tableau moves", () => {
  it("builds down in alternating colours", () => {
    const state = table({ t: ["8S", "9H", "9C"] });
    expect(klondike.canMove(state, { kind: "move", from: "t0", index: 0, to: "t1" })).toBe(true);
    expect(klondike.canMove(state, { kind: "move", from: "t0", index: 0, to: "t2" })).toBe(false);
  });

  it("moves a face-up run", () => {
    const state = table({ t: ["-2D 9H 8S 7D", "10C"] });
    const next = klondike.applyMove(state, { kind: "move", from: "t0", index: 1, to: "t1" });
    expect(pile(next, "t1")).toBe("10C 9H 8S 7D");
    expect(pile(next, "t0")).toBe("-2D");
  });

  it("only lets a King into an empty column", () => {
    const state = table({ t: ["QH", "KS QH", ""] });
    expect(klondike.canMove(state, { kind: "move", from: "t0", index: 0, to: "t2" })).toBe(false);
    expect(klondike.canMove(state, { kind: "move", from: "t1", index: 0, to: "t2" })).toBe(true);
  });

  it("does not move a broken run", () => {
    const state = table({ t: ["9H 8S 6D", "10C"] });
    expect(klondike.canMove(state, { kind: "move", from: "t0", index: 0, to: "t1" })).toBe(false);
  });
});

describe("foundations", () => {
  it("builds up by suit from the Ace", () => {
    const state = table({ t: ["AH", "2H", "2S"] });
    const ace = klondike.applyMove(state, { kind: "move", from: "t0", index: 0, to: "f0" });
    expect(klondike.canMove(ace, { kind: "move", from: "t1", index: 0, to: "f0" })).toBe(true);
    expect(klondike.canMove(ace, { kind: "move", from: "t2", index: 0, to: "f0" })).toBe(false);
    expect(ace.score).toBe(10);
  });

  it("moves a card back off a foundation for −15", () => {
    const state = { ...table({ f: ["AH 2H 3H 4H 5H 6H"], t: ["7S"] }), score: 50 };
    const move: Move = { kind: "move", from: "f0", index: 5, to: "t0" };
    expect(klondike.canMove(state, move)).toBe(true);
    const next = klondike.applyMove(state, move);
    expect(pile(next, "t0")).toBe("7S 6H");
    expect(next.score).toBe(35);
  });

  it("never lets the score go below zero", () => {
    const state = table({ f: ["AH 2H 3H 4H 5H 6H"], t: ["7S"] });
    expect(klondike.applyMove(state, { kind: "move", from: "f0", index: 5, to: "t0" }).score).toBe(
      0,
    );
  });
});

describe("stock", () => {
  it("draws one card face up", () => {
    const next = klondike.applyMove(table({ stock: "-AS -2S -3S" }), { kind: "draw" });
    expect(pile(next, "stock")).toBe("-AS -2S");
    expect(pile(next, "waste")).toBe("3S");
  });

  it("draws three, or what is left", () => {
    const three = klondike.applyMove(table({ stock: "-AS -2S -3S -4S" }, 3), { kind: "draw" });
    expect(pile(three, "waste")).toBe("4S 3S 2S");
    const rest = klondike.applyMove(three, { kind: "draw" });
    expect(pile(rest, "waste")).toBe("4S 3S 2S AS");
    expect(pile(rest, "stock")).toBe("");
  });

  it("recycles the waste in order", () => {
    const state = table({ waste: "AS 2S 3S" });
    expect(klondike.canMove(state, { kind: "recycle" })).toBe(true);
    const next = klondike.applyMove(state, { kind: "recycle" });
    expect(pile(next, "stock")).toBe("-3S -2S -AS");
    const drawn = klondike.applyMove(next, { kind: "draw" });
    expect(pile(drawn, "waste")).toBe("AS");
  });

  it("can't recycle while the stock has cards", () => {
    expect(klondike.canMove(table({ stock: "-AS", waste: "2S" }), { kind: "recycle" })).toBe(false);
  });

  it("charges 100 per Draw 1 recycle", () => {
    const state = { ...table({ waste: "AS" }), score: 150 };
    expect(klondike.applyMove(state, { kind: "recycle" }).score).toBe(50);
  });

  it("charges 20 per Draw 3 recycle after three passes", () => {
    let state: GameState = { ...table({ waste: "AS" }, 3), score: 100 };
    const scores: number[] = [];
    for (let i = 0; i < 4; i++) {
      state = klondike.applyMove(state, { kind: "recycle" });
      scores.push(state.score);
      state = klondike.applyMove(state, { kind: "draw" });
    }
    expect(scores).toEqual([100, 100, 80, 60]);
  });
});

describe("automatic moves", () => {
  it("flips an exposed card for 5 points", () => {
    const state = table({ t: ["-4C 9H", "10S"] });
    const step = play(klondike, state, { kind: "move", from: "t0", index: 1, to: "t1" }, NO_AUTO);
    expect(step?.moves).toEqual([
      { kind: "move", from: "t0", index: 1, to: "t1" },
      { kind: "flip", pile: "t0" },
    ]);
    expect(pile(step!.state, "t0")).toBe("4C");
    expect(step!.state.score).toBe(5);
  });

  it("sends safe cards up only when enabled", () => {
    const state = table({ f: ["AH", "AD"], t: ["2H", "3S"] });
    expect(settle(klondike, state, NO_AUTO).moves).toEqual([]);
    const settled = settle(klondike, state, { safeToFoundation: true });
    expect(pile(settled.state, "f0")).toBe("AH 2H");
    // The 3 of spades needs both red 2s up first.
    expect(pile(settled.state, "t1")).toBe("3S");
  });
});

describe("taps", () => {
  it("prefers the foundation, then a built column, then an empty one", () => {
    const state = table({ t: ["KS", "", "AH"] });
    expect(klondike.tapMoves(state, "t0", 0)).toEqual([]);
    const queen = table({ t: ["QH", "KS", "", "KC"] });
    expect(klondike.tapMoves(queen, "t0", 0)).toEqual([
      { kind: "move", from: "t0", index: 0, to: "t1" },
      { kind: "move", from: "t0", index: 0, to: "t3" },
    ]);
    expect(klondike.tapMoves(state, "t2", 0)[0]).toEqual({
      kind: "move",
      from: "t2",
      index: 0,
      to: "f0",
    });
  });

  it("draws or recycles from the stock", () => {
    expect(klondike.tapMoves(table({ stock: "-AS" }), "stock", 0)).toEqual([{ kind: "draw" }]);
    expect(klondike.tapMoves(table({ waste: "AS" }), "stock", -1)).toEqual([{ kind: "recycle" }]);
  });
});

describe("game", () => {
  it("wins when every card is on a foundation", () => {
    const suits = ["S", "H", "D", "C"] as const;
    const full = suits.map((suit) =>
      ["A", 2, 3, 4, 5, 6, 7, 8, 9, 10, "J", "Q", "K"].map((rank) => `${rank}${suit}`).join(" "),
    );
    const won = table({ f: full });
    expect(klondike.isWon(won)).toBe(true);
    expect(klondike.isWon(klondike.deal(1, { draw: 1 }))).toBe(false);
  });

  it("only offers legal moves", () => {
    let state = klondike.deal(7, { draw: 3 });
    for (let i = 0; i < 200; i++) {
      const moves = klondike.legalMoves(state);
      const current = state;
      expect(moves.every((move) => klondike.canMove(current, move))).toBe(true);
      state = klondike.applyMove(current, moves[i % moves.length]!);
    }
  });

  it("replays recorded moves to the same state", () => {
    const start = klondike.deal(5, { draw: 1 });
    let state = start;
    const steps: Move[][] = [];
    for (let i = 0; i < 60; i++) {
      const move = klondike.legalMoves(state).at(-(1 + (i % 3)))!;
      const step = play(klondike, state, move, { safeToFoundation: true })!;
      steps.push([...step.moves]);
      state = step.state;
    }
    expect(replay(klondike, start, steps).at(-1)).toEqual(state);
  });
});

describe("finishing", () => {
  it("can finish once everything is face up and the stock is empty", () => {
    const state = table({ f: ["AS", "AH"], t: ["-KD QS", "2S", "2H", "AD AC"] });
    expect(klondike.canFinish?.(state)).toBe(false);
    const ready = table({ f: ["AS", "AH", "AD", "AC"], t: ["2C", "2S", "2H 3S", "2D"] });
    expect(klondike.canFinish?.(ready)).toBe(true);
    expect(klondike.canFinish?.(table({ stock: "-KS", t: ["2C"] }))).toBe(false);
  });

  it("finishes with foundation moves alone", () => {
    let state = table({
      f: ["AS", "AH", "AD", "AC"],
      t: ["3H 2C", "3S 2D", "2H", "3D 2S", "3C"],
    });
    for (let i = 0; i < 8; i++) {
      const move = nextFoundationMove(klondike, state);
      state = klondike.applyMove(state, move!);
    }
    expect(nextFoundationMove(klondike, state)).toBeUndefined();
    expect(pilesOfKind(state, "tableau").every((column) => column.cards.length === 0)).toBe(true);
  });
});

/** The same position with two piles' cards swapped. */
function swapCards(state: GameState, first: string, second: string): GameState {
  const cardsOf = (id: string) => getPile(state, id).cards;
  const piles = state.piles.map((item) => {
    const from = item.id === first ? second : item.id === second ? first : undefined;
    return from === undefined ? item : { id: item.id, kind: item.kind, cards: cardsOf(from) };
  });
  return { ...state, piles };
}

describe("state keys", () => {
  it("ignore which foundation slot each suit went to", () => {
    const state = table({ f: ["AS 2S", "AH"], t: ["KD"] });
    expect(klondike.stateKey?.(swapCards(state, "f0", "f1"))).toBe(klondike.stateKey?.(state));
    expect(klondike.stateKey?.(swapCards(state, "f0", "t0"))).not.toBe(klondike.stateKey?.(state));
  });
});
