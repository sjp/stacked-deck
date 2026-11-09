import { withFace } from "../../cards.ts";
import { shuffledDeck } from "../../rng.ts";
import {
  addScore,
  counter,
  findPile,
  getPile,
  makePile,
  topCard,
  withCounter,
  withPiles,
} from "../../state.ts";
import type { GameState, Move, PileId, VariantOptions } from "../../types.ts";
import type { LayoutContext, PileLayout, TableLayout, Variant } from "../../variant.ts";
import {
  canPlayOnWaste,
  drawToWaste,
  playToWaste,
  wasteGameKey,
  wasteTop,
} from "../shared/waste.ts";

const STOCK = "stock";
const WASTE = "waste";
const SIZE = 28;
/** Rows from the peaks down: 3, 6, 9 and 10 cards. */
const ROW_STARTS = [0, 3, 9, 18] as const;

export const TRIPEAKS_POINTS = { chainStep: 1, peak: 15, allPeaks: 30 } as const;

const pileId = (index: number): PileId => `p${index}`;

/** The cards that overlap card `index` from the row below. */
export function coveringCards(index: number): number[] {
  if (index >= ROW_STARTS[3]) {
    return [];
  }
  if (index >= ROW_STARTS[2]) {
    const k = index - ROW_STARTS[2];
    return [ROW_STARTS[3] + k, ROW_STARTS[3] + k + 1];
  }
  if (index >= ROW_STARTS[1]) {
    const j = index - ROW_STARTS[1];
    const peak = Math.floor(j / 2);
    const offset = j % 2;
    return [ROW_STARTS[2] + 3 * peak + offset, ROW_STARTS[2] + 3 * peak + offset + 1];
  }
  return [ROW_STARTS[1] + 2 * index, ROW_STARTS[1] + 2 * index + 1];
}

/** Reads the options: wrapping from King to Ace is on unless turned off. */
function readOptions(options: VariantOptions): { readonly wrap: boolean } {
  return { wrap: options["wrap"] !== false };
}

function rules(state: GameState) {
  return { ...readOptions(state.options), onKing: true };
}

function deal(seed: number, options: VariantOptions): GameState {
  const { seed: normalized, cards: deck } = shuffledDeck(seed);
  const table = Array.from({ length: SIZE }, (_, i) => {
    const card = deck[i];
    return makePile(
      pileId(i),
      "tableau",
      card === undefined ? [] : [withFace(card, i >= ROW_STARTS[3])],
    );
  });
  const first = deck[SIZE];
  return {
    variant: "tripeaks",
    seed: normalized,
    options: { ...readOptions(options) },
    piles: [
      ...table,
      makePile(STOCK, "stock", deck.slice(SIZE + 1)),
      makePile(WASTE, "waste", first === undefined ? [] : [withFace(first, true)]),
    ],
    score: 0,
    counters: { chain: 0 },
  };
}

function isEmpty(state: GameState, index: number): boolean {
  return (findPile(state, pileId(index))?.cards.length ?? 0) === 0;
}

function isUncovered(state: GameState, index: number): boolean {
  return coveringCards(index).every((cover) => isEmpty(state, cover));
}

function tableIndex(id: PileId): number | undefined {
  const match = /^p(\d+)$/u.exec(id);
  return match === null ? undefined : Number(match[1]);
}

function canPlay(state: GameState, from: PileId): boolean {
  const index = tableIndex(from);
  const pile = findPile(state, from);
  const card = pile === undefined ? undefined : topCard(pile);
  return (
    index !== undefined &&
    card !== undefined &&
    isUncovered(state, index) &&
    canPlayOnWaste(card, wasteTop(state, WASTE), rules(state))
  );
}

function canMove(state: GameState, move: Move): boolean {
  if (move.kind === "draw") {
    return getPile(state, STOCK).cards.length > 0;
  }
  if (move.kind === "flip") {
    const index = tableIndex(move.pile);
    const pile = findPile(state, move.pile);
    const card = pile === undefined ? undefined : topCard(pile);
    return index !== undefined && card !== undefined && !card.faceUp && isUncovered(state, index);
  }
  // Each tableau slot holds one card, so the move must name it.
  return (
    move.kind === "move" &&
    move.to === WASTE &&
    move.index === (findPile(state, move.from)?.cards.length ?? 0) - 1 &&
    canPlay(state, move.from)
  );
}

function peaksCleared(state: GameState): number {
  return [0, 1, 2].filter((peak) => isEmpty(state, peak)).length;
}

function applyMove(state: GameState, move: Move): GameState {
  if (move.kind === "draw") {
    return withCounter(drawToWaste(state, STOCK, WASTE), "chain", 0);
  }
  if (move.kind === "flip") {
    const cards = getPile(state, move.pile).cards;
    const top = cards.at(-1);
    return top === undefined ? state : withPiles(state, { [move.pile]: [withFace(top, true)] });
  }
  if (move.kind !== "move") {
    return state;
  }
  const chain = counter(state, "chain") + 1;
  const played = withCounter(playToWaste(state, move.from, WASTE), "chain", chain);
  const newPeaks = peaksCleared(played) - peaksCleared(state);
  const allPeaks = peaksCleared(played) === 3 && newPeaks > 0 ? TRIPEAKS_POINTS.allPeaks : 0;
  return addScore(
    played,
    chain * TRIPEAKS_POINTS.chainStep + newPeaks * TRIPEAKS_POINTS.peak + allPeaks,
  );
}

function legalMoves(state: GameState): Move[] {
  const moves: Move[] = [];
  for (let i = 0; i < SIZE; i++) {
    if (canPlay(state, pileId(i))) {
      moves.push({ kind: "move", from: pileId(i), index: 0, to: WASTE });
    }
  }
  if (getPile(state, STOCK).cards.length > 0) {
    moves.push({ kind: "draw" });
  }
  return moves;
}

/** Cards turn face up as soon as both cards covering them are gone. */
function autoMove(state: GameState): Move | undefined {
  for (let i = 0; i < SIZE; i++) {
    const move: Move = { kind: "flip", pile: pileId(i) };
    if (canMove(state, move)) {
      return move;
    }
  }
  return undefined;
}

function tapMoves(state: GameState, pile: PileId, _index: number): Move[] {
  if (pile === STOCK) {
    return getPile(state, STOCK).cards.length > 0 ? [{ kind: "draw" }] : [];
  }
  return canPlay(state, pile) ? [{ kind: "move", from: pile, index: 0, to: WASTE }] : [];
}

const rowOf = (index: number): number => ROW_STARTS.findLastIndex((start) => index >= start);

const STEP_X = 1.05;
const ROW_Y = 0.38;

function layout(_state: GameState, context: LayoutContext): TableLayout {
  const xs: number[] = [];
  for (let k = 0; k < 10; k++) {
    xs[ROW_STARTS[3] + k] = 0.1 + k * STEP_X;
  }
  for (let k = 0; k < 9; k++) {
    xs[ROW_STARTS[2] + k] = 0.1 + STEP_X / 2 + k * STEP_X;
  }
  for (let j = 0; j < 6; j++) {
    const [left = 0] = coveringCards(ROW_STARTS[1] + j);
    xs[ROW_STARTS[1] + j] = (xs[left] ?? 0) + STEP_X / 2;
  }
  for (let p = 0; p < 3; p++) {
    const [left = 0] = coveringCards(p);
    xs[p] = (xs[left] ?? 0) + STEP_X / 2;
  }
  const width = 0.2 + 10 * STEP_X - 0.05;
  const bottomY = 0.1 + 3 * ROW_Y + 1.25;
  const piles: PileLayout[] = Array.from({ length: SIZE }, (_, i) => ({
    id: pileId(i),
    x: xs[i] ?? 0,
    y: 0.1 + rowOf(i) * ROW_Y,
    fan: "none",
  }));
  const centre = width / 2;
  const [stockX, wasteX] = context.leftHanded
    ? [centre + 0.1, centre - 1.1]
    : [centre - 1.1, centre + 0.1];
  piles.push(
    { id: STOCK, x: stockX, y: bottomY, fan: "none" },
    { id: WASTE, x: wasteX, y: bottomY, fan: "none" },
  );
  return { width, height: bottomY + 1.1, piles };
}

export const tripeaks: Variant = {
  id: "tripeaks",
  name: "TriPeaks",
  description: "Clear three peaks by playing cards one higher or lower than the waste.",
  optionSpecs: [
    {
      key: "wrap",
      label: "King and Ace",
      choices: [
        { value: true, label: "Wrap round" },
        { value: false, label: "Don't wrap" },
      ],
    },
  ],
  pileNouns: { tableau: "card" },
  defaultOptions: { wrap: true },
  scored: true,
  deal,
  layout,
  legalMoves,
  canMove,
  applyMove,
  autoMove,
  isWon: (state) => Array.from({ length: SIZE }, (_, i) => i).every((i) => isEmpty(state, i)),
  canPickUp: (state, pile) => canPlay(state, pile),
  dropMove: (state, from, _index, to) =>
    to === WASTE && canPlay(state, from) ? { kind: "move", from, index: 0, to } : undefined,
  tapMoves,
  stateKey: (state) => wasteGameKey(state, WASTE),
};
