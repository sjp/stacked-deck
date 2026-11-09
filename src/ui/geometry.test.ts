import { describe, expect, it } from "vitest";
import type { Card } from "../engine/cards.ts";
import { makeCards, withFace } from "../engine/cards.ts";
import type { GameState, Pile, PileId } from "../engine/types.ts";
import type { Variant } from "../engine/variant.ts";
import { freecell } from "../engine/variants/freecell/freecell.ts";
import { golf } from "../engine/variants/golf/golf.ts";
import { VARIANTS } from "../engine/variants/index.ts";
import { klondike } from "../engine/variants/klondike/klondike.ts";
import type { TableGeometry } from "./geometry.ts";
import { computeGeometry, fanOffsets, fitCardWidth, LIFT_Z, MAX_CARD_WIDTH } from "./geometry.ts";

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

  it("spreads face-up cards to a wider offset when one is given and there is room", () => {
    const offsets = fanOffsets(cards(3, 2), 1000, 100, false, 45);
    expect(offsets[0]).toBeCloseTo(12);
    expect(offsets[3]).toBeCloseTo(45);
  });

  it("always fits in the space available", () => {
    const offsets = fanOffsets(cards(20, 6), 150, 100, true);
    const total = offsets.reduce((sum, offset) => sum + offset, 0);
    expect(total).toBeLessThanOrEqual(150.0001);
  });
});

describe("computeGeometry", () => {
  it.each(VARIANTS.map((variant) => [variant.id, variant] as const))(
    "stacks every %s card below the lift for moving cards",
    (_id, variant) => {
      const state = variant.deal(1, variant.defaultOptions);
      const layout = variant.layout(state, { landscape: false, leftHanded: false });
      const { cards: placed } = computeGeometry(state, layout, { width: 400, height: 800 });
      expect(Math.max(...placed.map((placement) => placement.z))).toBeLessThan(LIFT_Z);
    },
  );
});

const PORTRAIT = { landscape: false, leftHanded: false };
const LANDSCAPE = { landscape: true, leftHanded: false };
const FREECELL_COLUMNS = ["t0", "t1", "t2", "t3", "t4", "t5", "t6", "t7"];

function geometryOf(
  variant: Variant,
  state: GameState,
  size: { width: number; height: number },
  landscape = false,
): TableGeometry {
  return computeGeometry(state, variant.layout(state, landscape ? LANDSCAPE : PORTRAIT), size);
}

/** The vertical steps between consecutive cards of a pile. */
function steps(geometry: TableGeometry, pile: PileId): number[] {
  const ys = geometry.cards.filter((card) => card.pile === pile).map((card) => card.y);
  return ys.slice(1).map((y, index) => y - (ys[index] ?? 0));
}

/** The lowest edge of a pile's cards. */
function bottomOf(geometry: TableGeometry, pile: PileId): number {
  const ys = geometry.cards.filter((card) => card.pile === pile).map((card) => card.y);
  return Math.max(...ys) + geometry.cardHeight;
}

const near = (expected: number) => (step: number | undefined) =>
  step !== undefined && Math.abs(step - expected) <= 1;

/** Replaces each pile's cards with what `update` returns for it. */
function mapPiles(state: GameState, update: (pile: Pile) => readonly Card[]): GameState {
  return { ...state, piles: state.piles.map((pile) => ({ ...pile, cards: update(pile) })) };
}

/** A FreeCell deal with `extra` cards moved from the other columns onto the first. */
function freecellWithLongColumn(extra: number): GameState {
  const state = freecell.deal(1, freecell.defaultOptions);
  const moved = state.piles
    .filter((pile) => pile.kind === "tableau" && pile.id !== "t0")
    .flatMap((pile) => pile.cards)
    .slice(0, extra);
  const ids = new Set(moved.map((card) => card.id));
  return mapPiles(state, (pile) =>
    pile.id === "t0" ? [...pile.cards, ...moved] : pile.cards.filter((card) => !ids.has(card.id)),
  );
}

/** A draw-three Klondike game with five cards drawn and two face-down cards per column. */
function klondikeMidGame(): GameState {
  const state = klondike.deal(1, { draw: 3 });
  const stock = state.piles.find((pile) => pile.id === "stock")?.cards ?? [];
  const drawn = stock.slice(-5).map((card) => withFace(card, true));
  return mapPiles(state, (pile) => {
    if (pile.kind === "waste") {
      return drawn;
    }
    if (pile.kind === "stock") {
      return pile.cards.slice(0, -5);
    }
    return pile.kind === "tableau"
      ? pile.cards.map((card, index) => withFace(card, index >= 2))
      : pile.cards;
  });
}

describe("computeGeometry tableau fan", () => {
  it("spreads face-up tableau cards up to 0.45 of the card height when there is room", () => {
    const geometry = geometryOf(freecell, freecell.deal(1, {}), { width: 390, height: 700 });
    expect(geometry.cardHeight).toBe(60);
    for (const pile of FREECELL_COLUMNS) {
      expect(steps(geometry, pile).every((step) => step === 27)).toBe(true);
    }
  });

  it("gives every tableau column the spacing the longest one has room for", () => {
    const size = { width: 390, height: 450 };
    const spacing = (state: GameState) => {
      const geometry = geometryOf(freecell, state, size);
      const all = FREECELL_COLUMNS.flatMap((pile) => steps(geometry, pile));
      expect(Math.max(...all) - Math.min(...all)).toBeLessThanOrEqual(1);
      expect(bottomOf(geometry, "t0")).toBeLessThanOrEqual(size.height);
      return Math.min(...all);
    };
    const thirteen = spacing(freecellWithLongColumn(6));
    const nineteen = spacing(freecellWithLongColumn(12));
    expect(thirteen).toBeLessThanOrEqual(27);
    expect(thirteen).toBeGreaterThan(nineteen);
    expect(nineteen).toBeGreaterThan(0.27 * 60);
  });

  it("shrinks only a column with no room for the usual spacing", () => {
    const geometry = geometryOf(freecell, freecellWithLongColumn(18), { width: 390, height: 450 });
    expect(Math.max(...steps(geometry, "t0"))).toBeLessThan(0.27 * 60);
    expect(bottomOf(geometry, "t0")).toBeLessThanOrEqual(450);
    const others = FREECELL_COLUMNS.slice(1).flatMap((pile) => steps(geometry, pile));
    expect(others.every(near(0.27 * 60))).toBe(true);
  });

  it("keeps face-down offsets and the draw-three waste fan at their usual size", () => {
    const geometry = geometryOf(klondike, klondikeMidGame(), { width: 844, height: 390 }, true);
    const height = geometry.cardHeight;
    const [hidden, under, ...fanned] = steps(geometry, "waste");
    expect([hidden, under]).toEqual([0, 0]);
    expect(fanned.every(near(0.27 * height))).toBe(true);
    const [down, ...rest] = steps(geometry, "t6");
    expect(near(0.12 * height)(down)).toBe(true);
    expect(rest.slice(1).every(near(0.45 * height))).toBe(true);
  });

  it("stops tableau columns short of a pile below them", () => {
    const geometry = geometryOf(golf, golf.deal(1, {}), { width: 390, height: 700 });
    const stockY = Math.min(
      ...geometry.cards.filter((card) => card.pile === "stock").map((card) => card.y),
    );
    for (const pile of ["t0", "t1", "t2", "t3", "t4", "t5", "t6"]) {
      expect(bottomOf(geometry, pile)).toBeLessThan(stockY);
    }
    expect(steps(geometry, "t3")[0]).toBeGreaterThan(0.27 * geometry.cardHeight + 1);
  });
});
