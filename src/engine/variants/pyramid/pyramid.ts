import type { Card } from "../../cards.ts";
import { withFace } from "../../cards.ts";
import { shuffledDeck } from "../../rng.ts";
import {
  addScore,
  counter,
  getPile,
  makePile,
  playKey,
  topCard,
  withCounter,
  withPiles,
} from "../../state.ts";
import type { GameState, Move, Pile, PileId, VariantOptions } from "../../types.ts";
import type { LayoutContext, PileLayout, TableLayout, Variant } from "../../variant.ts";

const ROWS = 7;
const SIZE = (ROWS * (ROWS + 1)) / 2;
const STOCK = "stock";
const WASTE = "waste";
const DISCARD = "f0";

export const PYRAMID_POINTS = { removal: 5, row: 25, cleared: 500 } as const;

export const pyramidId = (row: number, column: number): PileId =>
  `p${(row * (row + 1)) / 2 + column}`;
const POSITIONS = Array.from({ length: ROWS }, (_, row) =>
  Array.from({ length: row + 1 }, (__, column) => ({ row, column, id: pyramidId(row, column) })),
).flat();

interface PyramidOptions {
  readonly passes: 3 | "unlimited";
}

/** Reads the options; stored and linked deals keep unlimited passes as `passes: 0`. */
function readOptions(options: VariantOptions): PyramidOptions {
  return { passes: options["passes"] === 0 ? "unlimited" : 3 };
}

function passes(state: GameState): number {
  const { passes: allowed } = readOptions(state.options);
  return allowed === "unlimited" ? Number.POSITIVE_INFINITY : allowed;
}

function deal(seed: number, options: VariantOptions): GameState {
  const { seed: normalized, cards } = shuffledDeck(seed);
  const deck = cards.map((card) => withFace(card, true));
  const stock = deck.slice(SIZE).map((card, i, all) => withFace(card, i === all.length - 1));
  return {
    variant: "pyramid",
    seed: normalized,
    options: { passes: readOptions(options).passes === "unlimited" ? 0 : 3 },
    piles: [
      ...POSITIONS.map(({ id }, i) => makePile(id, "tableau", deck.slice(i, i + 1))),
      makePile(STOCK, "stock", stock),
      makePile(WASTE, "waste"),
      makePile(DISCARD, "foundation"),
    ],
    score: 0,
    counters: { recycles: 0 },
  };
}

/** The pyramid position of each pile, with the two piles overlapping it from below. */
const POSITION_BY_ID = new Map(
  POSITIONS.map(({ row, column, id }) => [
    id,
    {
      row,
      covers: row === ROWS - 1 ? [] : [pyramidId(row + 1, column), pyramidId(row + 1, column + 1)],
    },
  ]),
);

type PileLookup = ReadonlyMap<PileId, Pile>;

const lookup = (state: GameState): PileLookup =>
  new Map(state.piles.map((pile) => [pile.id, pile]));

function isEmpty(piles: PileLookup, id: PileId): boolean {
  return (piles.get(id)?.cards.length ?? 0) === 0;
}

function exposed(piles: PileLookup, id: PileId): boolean {
  const position = POSITION_BY_ID.get(id);
  return (
    position !== undefined &&
    !isEmpty(piles, id) &&
    position.covers.every((cover) => isEmpty(piles, cover))
  );
}

/** A pyramid card is free once both cards overlapping it from the row below are gone. */
export function isExposed(state: GameState, id: PileId): boolean {
  return exposed(lookup(state), id);
}

/** Cards that can be paired: exposed pyramid cards and the tops of the stock and waste. */
function isFree(piles: PileLookup, id: PileId): boolean {
  if (id === STOCK || id === WASTE) {
    const pile = piles.get(id);
    return pile !== undefined && topCard(pile)?.faceUp === true;
  }
  return exposed(piles, id);
}

function isAvailable(state: GameState, id: PileId): boolean {
  return isFree(lookup(state), id);
}

function availablePiles(state: GameState): Pile[] {
  const piles = lookup(state);
  return state.piles.filter((pile) => pile.kind !== "foundation" && isFree(piles, pile.id));
}

function canRemove(state: GameState, piles: readonly PileId[]): boolean {
  const all = lookup(state);
  const cards = piles.map((id) => (isFree(all, id) ? all.get(id) : undefined));
  const ranks = cards.map((pile) => (pile === undefined ? undefined : topCard(pile)?.rank));
  if (ranks.some((rank) => rank === undefined)) {
    return false;
  }
  const [a, b] = ranks;
  if (piles.length === 1) {
    return a === 13;
  }
  return piles.length === 2 && piles[0] !== piles[1] && (a ?? 0) + (b ?? 0) === 13;
}

function canRecycle(state: GameState): boolean {
  return (
    getPile(state, STOCK).cards.length === 0 &&
    getPile(state, WASTE).cards.length > 0 &&
    counter(state, "recycles") < passes(state) - 1
  );
}

function canMove(state: GameState, move: Move): boolean {
  if (move.kind === "remove") {
    return canRemove(state, move.piles);
  }
  if (move.kind === "draw") {
    return getPile(state, STOCK).cards.length > 0;
  }
  return move.kind === "recycle" && canRecycle(state);
}

/** Turns the stock's new top card face up. */
function showStockTop(cards: readonly Card[]): Card[] {
  return cards.map((card, i) => withFace(card, i === cards.length - 1));
}

function rowsCleared(state: GameState): number {
  const piles = lookup(state);
  let rows = 0;
  for (let row = 0; row < ROWS; row++) {
    if (POSITIONS.every((item) => item.row !== row || isEmpty(piles, item.id))) {
      rows++;
    }
  }
  return rows;
}

function applyMove(state: GameState, move: Move): GameState {
  if (move.kind === "draw") {
    const stock = getPile(state, STOCK).cards;
    const top = stock.at(-1);
    if (top === undefined) {
      return state;
    }
    return withPiles(state, {
      [STOCK]: showStockTop(stock.slice(0, -1)),
      [WASTE]: [...getPile(state, WASTE).cards, withFace(top, true)],
    });
  }
  if (move.kind === "recycle") {
    const restocked = withPiles(state, {
      [STOCK]: showStockTop(getPile(state, WASTE).cards.toReversed()),
      [WASTE]: [],
    });
    return withCounter(restocked, "recycles", counter(state, "recycles") + 1);
  }
  if (move.kind !== "remove") {
    return state;
  }
  const changes: Record<string, readonly Card[]> = {};
  const removed: Card[] = [];
  for (const id of move.piles) {
    const cards = getPile(state, id).cards;
    const top = cards.at(-1);
    if (top !== undefined) {
      removed.push(top);
      changes[id] = id === STOCK ? showStockTop(cards.slice(0, -1)) : cards.slice(0, -1);
    }
  }
  changes[DISCARD] = [...getPile(state, DISCARD).cards, ...removed];
  const next = withPiles(state, changes);
  const rowsAfter = rowsCleared(next);
  const newRows = rowsAfter - rowsCleared(state);
  // Only the move that clears the last row earns the bonus; pairs after the win don't.
  const cleared = newRows > 0 && rowsAfter === ROWS ? PYRAMID_POINTS.cleared : 0;
  return addScore(next, PYRAMID_POINTS.removal + newRows * PYRAMID_POINTS.row + cleared);
}

function legalMoves(state: GameState): Move[] {
  const moves: Move[] = [];
  if (rowsCleared(state) === ROWS) {
    // The game is won; pairing what's left of the stock would only add points.
    return moves;
  }
  const available = availablePiles(state);
  // Every pile here is available, so a pair only has to add up to 13.
  const ranks = available.map((pile) => topCard(pile)?.rank ?? 0);
  available.forEach((pile, i) => {
    if (ranks[i] === 13) {
      moves.push({ kind: "remove", piles: [pile.id] });
      return;
    }
    for (let j = i + 1; j < available.length; j++) {
      const other = available[j];
      if (other !== undefined && (ranks[i] ?? 0) + (ranks[j] ?? 0) === 13) {
        moves.push({ kind: "remove", piles: [pile.id, other.id] });
      }
    }
  });
  if (getPile(state, STOCK).cards.length > 0) {
    moves.push({ kind: "draw" });
  } else if (canRecycle(state)) {
    moves.push({ kind: "recycle" });
  }
  return moves;
}

function canPickUp(state: GameState, pile: PileId, index: number): boolean {
  // Tapping the stock draws, so its top card is paired by selecting the other card first.
  return (
    pile !== STOCK && isAvailable(state, pile) && index === getPile(state, pile).cards.length - 1
  );
}

function dropMove(state: GameState, from: PileId, _index: number, to: PileId): Move | undefined {
  const move: Move = { kind: "remove", piles: to === DISCARD ? [from] : [from, to] };
  return canRemove(state, move.piles) ? move : undefined;
}

function tapMoves(state: GameState, pileId: PileId, _index: number): Move[] {
  if (pileId === STOCK) {
    const moves: Move[] = [{ kind: "draw" }, { kind: "recycle" }];
    return moves.filter((move) => canMove(state, move));
  }
  if (!isAvailable(state, pileId)) {
    return [];
  }
  if (canRemove(state, [pileId])) {
    return [{ kind: "remove", piles: [pileId] }];
  }
  // With exactly one possible partner the pair is obvious; otherwise the player chooses.
  const pairs = availablePiles(state)
    .map((pile) => pile.id)
    .filter((id) => canRemove(state, [pileId, id]));
  const [only] = pairs;
  return pairs.length === 1 && only !== undefined
    ? [{ kind: "remove", piles: [pileId, only] }]
    : [];
}

function layout(_state: GameState, context: LayoutContext): TableLayout {
  const rowStep = context.landscape ? 0.42 : 0.5;
  const pyramidX = context.landscape ? 1.4 : 0.1;
  const pyramid = POSITIONS.map(({ row, column, id }): PileLayout => ({
    id,
    x: pyramidX + (ROWS - 1 - row) * 0.55 + column * 1.1,
    y: 0.1 + row * rowStep,
    fan: "none",
  }));
  if (context.landscape) {
    const width = pyramidX + ROWS * 1.1 + 0.3 + 1.1;
    const side = (x: number) => (context.leftHanded ? width - x - 1 : x);
    return {
      width,
      height: 0.1 + (ROWS - 1) * rowStep + 1.1,
      piles: [
        ...pyramid,
        { id: STOCK, x: side(0.1), y: 0.1, fan: "none" },
        { id: WASTE, x: side(0.1), y: 1.25, fan: "none" },
        { id: DISCARD, x: side(width - 1.1), y: 0.1, fan: "none", emptyLabel: "K" },
      ],
    };
  }
  const width = 0.1 + ROWS * 1.1;
  const bottom = 0.1 + (ROWS - 1) * rowStep + 1.2;
  const side = (x: number) => (context.leftHanded ? width - x - 1 : x);
  return {
    width,
    height: bottom + 1.1,
    piles: [
      ...pyramid,
      { id: STOCK, x: side(0.1), y: bottom, fan: "none" },
      { id: WASTE, x: side(1.2), y: bottom, fan: "none" },
      { id: DISCARD, x: side(width - 1.1), y: bottom, fan: "none", emptyLabel: "K" },
    ],
  };
}

/**
 * The pyramid, stock and waste decide what is still possible (the discard pile follows
 * from them). With limited passes, the passes used matter too; with unlimited ones they
 * don't, and keying on them would make cycling the stock look like progress for ever.
 */
function stateKey(state: GameState): string {
  const table = playKey(state);
  return passes(state) === Number.POSITIVE_INFINITY
    ? table
    : `${table}#${counter(state, "recycles")}`;
}

export const pyramid: Variant = {
  id: "pyramid",
  name: "Pyramid",
  description: "Pair cards that add up to 13 to clear the pyramid. Kings go alone.",
  optionSpecs: [
    {
      key: "passes",
      label: "Stock",
      choices: [
        { value: 3, label: "3 passes" },
        { value: 0, label: "Unlimited" },
      ],
    },
  ],
  defaultOptions: { passes: 3 },
  pileNouns: { tableau: "card", foundation: "discard pile" },
  scored: true,
  deal,
  layout,
  legalMoves,
  canMove,
  applyMove,
  autoMove: () => undefined,
  isWon: (state) => rowsCleared(state) === ROWS,
  canPickUp,
  dropMove,
  tapMoves,
  stateKey,
};
