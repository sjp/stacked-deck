import { makeCards, withFace } from "../../cards.ts";
import { mulberry32, normalizeSeed, shuffle } from "../../rng.ts";
import { findPile, getPile, makePile, pilesOfKind, topCard } from "../../state.ts";
import type { GameState, Move, PileId, VariantOptions } from "../../types.ts";
import type { LayoutContext, PileLayout, TableLayout, Variant } from "../../variant.ts";
import type { WasteRules } from "../shared/waste.ts";
import {
  canPlayOnWaste,
  drawToWaste,
  playToWaste,
  wasteGameKey,
  wasteTop,
} from "../shared/waste.ts";

const STOCK = "stock";
const WASTE = "waste";
const COLUMNS = ["t0", "t1", "t2", "t3", "t4", "t5", "t6"] as const;
const DEPTH = 5;

function rules(state: GameState): WasteRules {
  return { wrap: state.options["wrap"] === true, onKing: state.options["onKing"] === true };
}

/**
 * Golf is scored like golf: the cards left in the columns, or once they're all cleared,
 * minus the cards left in the stock. Lower is better.
 */
export function golfScore(state: GameState): number {
  const left = pilesOfKind(state, "tableau").reduce((sum, pile) => sum + pile.cards.length, 0);
  return left > 0 ? left : -getPile(state, STOCK).cards.length;
}

function deal(seed: number, options: VariantOptions): GameState {
  const normalized = normalizeSeed(seed);
  const deck = shuffle(makeCards(), mulberry32(normalized)).map((card) => withFace(card, true));
  const tableau = COLUMNS.map((id, i) =>
    makePile(id, "tableau", deck.slice(i * DEPTH, (i + 1) * DEPTH)),
  );
  const used = COLUMNS.length * DEPTH;
  const state: GameState = {
    variant: "golf",
    seed: normalized,
    options: { wrap: options["wrap"] === true, onKing: options["onKing"] === true },
    piles: [
      ...tableau,
      makePile(
        STOCK,
        "stock",
        deck.slice(used + 1).map((card) => withFace(card, false)),
      ),
      makePile(WASTE, "waste", deck.slice(used, used + 1)),
    ],
    score: 0,
    counters: {},
  };
  return { ...state, score: golfScore(state) };
}

function canPlay(state: GameState, from: PileId): boolean {
  const pile = findPile(state, from);
  const card = pile?.kind === "tableau" ? topCard(pile) : undefined;
  return card !== undefined && canPlayOnWaste(card, wasteTop(state, WASTE), rules(state));
}

function canMove(state: GameState, move: Move): boolean {
  if (move.kind === "draw") {
    return getPile(state, STOCK).cards.length > 0;
  }
  // Only a column's top card plays.
  return (
    move.kind === "move" &&
    move.to === WASTE &&
    move.index === (findPile(state, move.from)?.cards.length ?? 0) - 1 &&
    canPlay(state, move.from)
  );
}

function applyMove(state: GameState, move: Move): GameState {
  let next = state;
  if (move.kind === "draw") {
    next = drawToWaste(state, STOCK, WASTE);
  } else if (move.kind === "move") {
    next = playToWaste(state, move.from, WASTE);
  }
  return { ...next, score: golfScore(next) };
}

function legalMoves(state: GameState): Move[] {
  const moves: Move[] = COLUMNS.filter((id) => canPlay(state, id)).map((id) => ({
    kind: "move",
    from: id,
    index: getPile(state, id).cards.length - 1,
    to: WASTE,
  }));
  if (getPile(state, STOCK).cards.length > 0) {
    moves.push({ kind: "draw" });
  }
  return moves;
}

function tapMoves(state: GameState, pile: PileId, _index: number): Move[] {
  if (pile === STOCK) {
    return getPile(state, STOCK).cards.length > 0 ? [{ kind: "draw" }] : [];
  }
  return canPlay(state, pile)
    ? [{ kind: "move", from: pile, index: getPile(state, pile).cards.length - 1, to: WASTE }]
    : [];
}

function layout(_state: GameState, context: LayoutContext): TableLayout {
  const width = 0.1 + COLUMNS.length * 1.1;
  const bottomY = 0.1 + 1 + (DEPTH - 1) * 0.27 + 0.35;
  const centre = width / 2;
  const [stockX, wasteX] = context.leftHanded
    ? [centre + 0.1, centre - 1.1]
    : [centre - 1.1, centre + 0.1];
  return {
    width,
    height: bottomY + 1.1,
    piles: [
      ...COLUMNS.map((id, i): PileLayout => ({ id, x: 0.1 + i * 1.1, y: 0.1, fan: "down" })),
      { id: STOCK, x: stockX, y: bottomY, fan: "none" },
      { id: WASTE, x: wasteX, y: bottomY, fan: "none" },
    ],
  };
}

export const golf: Variant = {
  id: "golf",
  name: "Golf",
  description: "Clear seven columns onto the waste, one rank up or down. Lowest score wins.",
  optionSpecs: [
    {
      key: "wrap",
      label: "King and Ace",
      choices: [
        { value: false, label: "Don't wrap" },
        { value: true, label: "Wrap round" },
      ],
    },
    {
      key: "onKing",
      label: "Play on a King",
      choices: [
        { value: false, label: "Not allowed" },
        { value: true, label: "Allowed" },
      ],
    },
  ],
  defaultOptions: { wrap: false, onKing: false },
  scored: true,
  lowScoreWins: true,
  deal,
  layout,
  legalMoves,
  canMove,
  applyMove,
  autoMove: () => undefined,
  isWon: (state) => pilesOfKind(state, "tableau").every((pile) => pile.cards.length === 0),
  canPickUp: (state, pile, index) =>
    canPlay(state, pile) && index === getPile(state, pile).cards.length - 1,
  dropMove: (state, from, _index, to) =>
    to === WASTE && canPlay(state, from)
      ? { kind: "move", from, index: getPile(state, from).cards.length - 1, to }
      : undefined,
  tapMoves,
  stateKey: (state) => wasteGameKey(state, WASTE),
};
