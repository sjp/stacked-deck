import type { Card, Suit } from "../../cards.ts";
import { withFace } from "../../cards.ts";
import { shuffledDeck } from "../../rng.ts";
import { transfer } from "../../rules.ts";
import {
  addScore,
  findPile,
  getPile,
  makePile,
  playKey,
  pilesOfKind,
  topCard,
  withPiles,
} from "../../state.ts";
import type { GameState, Move, PileId, VariantOptions } from "../../types.ts";
import type { LayoutContext, PileLayout, TableLayout, Variant } from "../../variant.ts";

const STOCK = "stock";
const TABLEAU = ["t0", "t1", "t2", "t3", "t4", "t5", "t6", "t7", "t8", "t9"] as const;
const FOUNDATIONS = ["f0", "f1", "f2", "f3", "f4", "f5", "f6", "f7"] as const;

export const SPIDER_POINTS = { start: 500, move: -1, run: 100 } as const;

const SUIT_SETS: Readonly<Record<number, readonly Suit[]>> = {
  1: ["spades"],
  2: ["spades", "hearts"],
  4: ["spades", "hearts", "diamonds", "clubs"],
};

function suitCount(options: VariantOptions): 1 | 2 | 4 {
  const suits = options["suits"];
  return suits === 2 || suits === 4 ? suits : 1;
}

function deal(seed: number, options: VariantOptions): GameState {
  const suits = suitCount(options);
  const set = SUIT_SETS[suits] ?? ["spades"];
  const { seed: normalized, cards: deck } = shuffledDeck(seed, set, 8 / set.length);
  let next = 0;
  const tableau = TABLEAU.map((id, column) => {
    const count = column < 4 ? 6 : 5;
    const cards = deck
      .slice(next, next + count)
      .map((card, row) => withFace(card, row === count - 1));
    next += count;
    return makePile(id, "tableau", cards);
  });
  return {
    variant: "spider",
    seed: normalized,
    options: { suits },
    piles: [
      makePile(STOCK, "stock", deck.slice(next)),
      ...FOUNDATIONS.map((id) => makePile(id, "foundation")),
      ...tableau,
    ],
    score: SPIDER_POINTS.start,
    counters: {},
  };
}

/** Whether `cards[index..]` is a face-up run of one suit, each card one below the last. */
export function isSuitedRun(cards: readonly Card[], index: number): boolean {
  if (index < 0 || index >= cards.length) {
    return false;
  }
  for (let i = index; i < cards.length; i++) {
    const card = cards[i];
    const below = cards[i - 1];
    if (card === undefined || !card.faceUp) {
      return false;
    }
    if (
      i > index &&
      (below === undefined || below.suit !== card.suit || below.rank !== card.rank + 1)
    ) {
      return false;
    }
  }
  return true;
}

/** The index where a complete King-to-Ace run starts on top of a column, if there is one. */
function completeRunStart(cards: readonly Card[]): number | undefined {
  const start = cards.length - 13;
  return start >= 0 && cards[start]?.rank === 13 && isSuitedRun(cards, start) ? start : undefined;
}

function canMoveCards(state: GameState, from: PileId, index: number, to: PileId): boolean {
  const source = findPile(state, from);
  const target = findPile(state, to);
  const card = source?.cards[index];
  if (source?.kind !== "tableau" || target === undefined || card === undefined || from === to) {
    return false;
  }
  if (!isSuitedRun(source.cards, index)) {
    return false;
  }
  if (target.kind === "foundation") {
    return target.cards.length === 0 && completeRunStart(source.cards) === index;
  }
  if (target.kind !== "tableau") {
    return false;
  }
  const top = topCard(target);
  return top === undefined || (top.faceUp && top.rank === card.rank + 1);
}

function canDeal(state: GameState): boolean {
  return (
    getPile(state, STOCK).cards.length > 0 &&
    pilesOfKind(state, "tableau").every((pile) => pile.cards.length > 0)
  );
}

function canMove(state: GameState, move: Move): boolean {
  if (move.kind === "draw") {
    return canDeal(state);
  }
  if (move.kind === "flip") {
    const pile = findPile(state, move.pile);
    const top = pile === undefined ? undefined : topCard(pile);
    return pile?.kind === "tableau" && top !== undefined && !top.faceUp;
  }
  return move.kind === "move" && canMoveCards(state, move.from, move.index, move.to);
}

function applyMove(state: GameState, move: Move): GameState {
  if (move.kind === "draw") {
    const stock = getPile(state, STOCK).cards;
    const dealt = stock.slice(-TABLEAU.length).toReversed();
    const changes: Record<string, readonly Card[]> = { [STOCK]: stock.slice(0, -TABLEAU.length) };
    TABLEAU.forEach((id, i) => {
      const card = dealt[i];
      if (card !== undefined) {
        changes[id] = [...getPile(state, id).cards, withFace(card, true)];
      }
    });
    return addScore(withPiles(state, changes), SPIDER_POINTS.move);
  }
  if (move.kind === "flip") {
    const cards = getPile(state, move.pile).cards;
    const top = cards.at(-1);
    return top === undefined
      ? state
      : withPiles(state, { [move.pile]: [...cards.slice(0, -1), withFace(top, true)] });
  }
  if (move.kind === "move") {
    const toFoundation = getPile(state, move.to).kind === "foundation";
    const moved = withPiles(state, transfer(state, move.from, move.index, move.to));
    return addScore(moved, toFoundation ? SPIDER_POINTS.run : SPIDER_POINTS.move);
  }
  return state;
}

/** Moves of `cards[index..]` onto other columns, trying only one of the empty ones. */
function tableauMoves(state: GameState, from: PileId, index: number): Move[] {
  const moves: Move[] = [];
  let triedEmpty = false;
  for (const target of pilesOfKind(state, "tableau")) {
    if (target.cards.length === 0) {
      if (triedEmpty || index === 0) {
        continue;
      }
      triedEmpty = true;
    }
    if (canMoveCards(state, from, index, target.id)) {
      moves.push({ kind: "move", from, index, to: target.id });
    }
  }
  return moves;
}

function legalMoves(state: GameState): Move[] {
  const moves: Move[] = [];
  const tableau = pilesOfKind(state, "tableau");
  for (const pile of tableau) {
    const top = topCard(pile);
    if (top !== undefined && !top.faceUp) {
      moves.push({ kind: "flip", pile: pile.id });
    }
    const start = completeRunStart(pile.cards);
    const free = FOUNDATIONS.find((id) => getPile(state, id).cards.length === 0);
    if (start !== undefined && free !== undefined) {
      moves.push({ kind: "move", from: pile.id, index: start, to: free });
    }
  }
  for (const pile of tableau) {
    for (let index = pile.cards.length - 1; index >= 0 && isSuitedRun(pile.cards, index); index--) {
      moves.push(...tableauMoves(state, pile.id, index));
    }
  }
  if (canDeal(state)) {
    moves.push({ kind: "draw" });
  }
  return moves;
}

/** Exposed cards turn over, and completed runs go up; neither is optional in Spider. */
function autoMove(state: GameState): Move | undefined {
  for (const pile of pilesOfKind(state, "tableau")) {
    const top = topCard(pile);
    if (top !== undefined && !top.faceUp) {
      return { kind: "flip", pile: pile.id };
    }
    const start = completeRunStart(pile.cards);
    const free = FOUNDATIONS.find((id) => getPile(state, id).cards.length === 0);
    if (start !== undefined && free !== undefined) {
      return { kind: "move", from: pile.id, index: start, to: free };
    }
  }
  return undefined;
}

function canPickUp(state: GameState, pileId: PileId, index: number): boolean {
  const pile = findPile(state, pileId);
  return pile?.kind === "tableau" && isSuitedRun(pile.cards, index);
}

function dropMove(state: GameState, from: PileId, index: number, to: PileId): Move | undefined {
  return canMoveCards(state, from, index, to) ? { kind: "move", from, index, to } : undefined;
}

function tapMoves(state: GameState, pileId: PileId, index: number): Move[] {
  const pile = findPile(state, pileId);
  if (pile?.kind === "stock") {
    return canDeal(state) ? [{ kind: "draw" }] : [];
  }
  const card = pile?.cards[index];
  if (pile === undefined || card === undefined || !canPickUp(state, pileId, index)) {
    return [];
  }
  // Same suit first (it keeps runs together), then any suit, then an empty column.
  const suited: Move[] = [];
  const other: Move[] = [];
  let empty: Move | undefined;
  for (const target of pilesOfKind(state, "tableau")) {
    const move = dropMove(state, pileId, index, target.id);
    const top = topCard(target);
    if (move === undefined) {
      continue;
    }
    if (top === undefined) {
      if (index > 0) {
        empty ??= move;
      }
    } else if (top.suit === card.suit) {
      suited.push(move);
    } else {
      other.push(move);
    }
  }
  return [...suited, ...other, ...(empty === undefined ? [] : [empty])];
}

const GAP = 0.1;
const STEP = 1 + GAP;

function layout(state: GameState, context: LayoutContext): TableLayout {
  const done = FOUNDATIONS.filter((id) => getPile(state, id).cards.length > 0);
  if (context.landscape) {
    const tableauX = GAP + STEP + 0.2;
    const width = tableauX + TABLEAU.length * STEP;
    const side = (x: number) => (context.leftHanded ? width - x - 1 : x);
    return {
      width,
      height: 3.4,
      piles: [
        { id: STOCK, x: side(GAP), y: GAP, fan: "none" },
        ...FOUNDATIONS.map((id, i): PileLayout => ({
          id,
          x: side(GAP),
          y: GAP + STEP + 0.05 + Math.min(i, Math.max(done.length - 1, 0)) * 0.12,
          fan: "none",
        })),
        ...TABLEAU.map((id, i): PileLayout => ({
          id,
          x: side(tableauX + i * STEP),
          y: GAP,
          fan: "down",
        })),
      ],
    };
  }
  const width = GAP + TABLEAU.length * STEP;
  const side = (x: number) => (context.leftHanded ? width - x - 1 : x);
  return {
    width,
    height: 4.6,
    piles: [
      { id: STOCK, x: side(GAP + 9 * STEP), y: GAP, fan: "none" },
      // Completed runs overlap, so the top row only needs room for a few cards.
      ...FOUNDATIONS.map((id, i): PileLayout => ({
        id,
        x: side(GAP + Math.min(i, Math.max(done.length - 1, 0)) * 0.45),
        y: GAP,
        fan: "none",
      })),
      ...TABLEAU.map((id, i): PileLayout => ({
        id,
        x: side(GAP + i * STEP),
        y: GAP + STEP + 0.05,
        fan: "down",
      })),
    ],
  };
}

export const spider: Variant = {
  id: "spider",
  name: "Spider",
  description: "Two decks. Build runs from King to Ace in one suit to clear them.",
  optionSpecs: [
    {
      key: "suits",
      label: "Suits",
      choices: [
        { value: 1, label: "1 suit" },
        { value: 2, label: "2 suits" },
        { value: 4, label: "4 suits" },
      ],
    },
  ],
  defaultOptions: { suits: 1 },
  scored: true,
  deal,
  layout,
  legalMoves,
  canMove,
  applyMove,
  autoMove,
  isWon: (state) => pilesOfKind(state, "foundation").every((pile) => pile.cards.length === 13),
  canPickUp,
  dropMove,
  tapMoves,
  stateKey: playKey,
};
