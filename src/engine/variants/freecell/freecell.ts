import { withFace } from "../../cards.ts";
import { shuffledDeck } from "../../rng.ts";
import {
  canAddToFoundation,
  canStackAlternating,
  cardsOnFoundations,
  isAlternatingRun,
  isSafeForFoundation,
  targetColumns,
  transfer,
} from "../../rules.ts";
import { findPile, getPile, makePile, pilesOfKind, topCard, withPiles } from "../../state.ts";
import type { GameState, Move, Pile, PileId, VariantOptions } from "../../types.ts";
import type {
  AutoMoveOptions,
  LayoutContext,
  PileLayout,
  TableLayout,
  Variant,
} from "../../variant.ts";

const CELLS = ["c0", "c1", "c2", "c3"] as const;
const FOUNDATIONS = ["f0", "f1", "f2", "f3"] as const;
const TABLEAU = ["t0", "t1", "t2", "t3", "t4", "t5", "t6", "t7"] as const;

function deal(seed: number, _options: VariantOptions): GameState {
  const { seed: normalized, cards } = shuffledDeck(seed);
  const deck = cards.map((card) => withFace(card, true));
  const columns = TABLEAU.map((): (typeof deck)[number][] => []);
  deck.forEach((card, index) => {
    columns[index % TABLEAU.length]?.push(card);
  });
  return {
    variant: "freecell",
    seed: normalized,
    options: {},
    piles: [
      ...CELLS.map((id) => makePile(id, "cell")),
      ...FOUNDATIONS.map((id) => makePile(id, "foundation")),
      ...TABLEAU.map((id, i) => makePile(id, "tableau", columns[i])),
    ],
    score: 0,
    counters: {},
  };
}

/**
 * The most cards that can move at once using free cells and empty columns as temporary
 * space: (1 + free cells) × 2^(empty columns), with one fewer empty column when the
 * destination is itself empty.
 */
export function maxMovable(state: GameState, toEmptyColumn: boolean): number {
  const freeCells = pilesOfKind(state, "cell").filter((pile) => pile.cards.length === 0).length;
  const emptyColumns = pilesOfKind(state, "tableau").filter(
    (pile) => pile.cards.length === 0,
  ).length;
  return (1 + freeCells) * 2 ** Math.max(0, emptyColumns - (toEmptyColumn ? 1 : 0));
}

type MoveCheck = { ok: true } | { ok: false; reason?: string };

function checkMove(state: GameState, from: PileId, index: number, to: PileId): MoveCheck {
  const source = findPile(state, from);
  const target = findPile(state, to);
  const card = source?.cards[index];
  if (source === undefined || target === undefined || card === undefined || from === to) {
    return { ok: false };
  }
  const count = source.cards.length - index;
  if (source.kind === "foundation") {
    return { ok: false };
  }
  if (source.kind === "tableau" ? !isAlternatingRun(source.cards, index) : count !== 1) {
    return { ok: false };
  }
  if (target.kind === "foundation") {
    return count === 1 && canAddToFoundation(card, target) ? { ok: true } : { ok: false };
  }
  if (target.kind === "cell") {
    return count === 1 && target.cards.length === 0 ? { ok: true } : { ok: false };
  }
  if (target.kind !== "tableau") {
    return { ok: false };
  }
  const top = topCard(target);
  if (top !== undefined && !canStackAlternating(card, top)) {
    return { ok: false };
  }
  const limit = maxMovable(state, top === undefined);
  if (count > limit) {
    return {
      ok: false,
      reason: `Not enough free space to move ${count} cards (${limit} at most)`,
    };
  }
  return { ok: true };
}

function canMove(state: GameState, move: Move): boolean {
  return move.kind === "move" && checkMove(state, move.from, move.index, move.to).ok;
}

function applyMove(state: GameState, move: Move): GameState {
  if (move.kind !== "move") {
    return state;
  }
  return withPiles(state, transfer(state, move.from, move.index, move.to));
}

function sources(state: GameState): { pile: Pile; index: number }[] {
  const result: { pile: Pile; index: number }[] = [];
  for (const pile of state.piles) {
    if (pile.kind === "cell" && pile.cards.length === 1) {
      result.push({ pile, index: 0 });
    }
    if (pile.kind === "tableau") {
      for (let index = pile.cards.length - 1; index >= 0; index--) {
        if (!isAlternatingRun(pile.cards, index)) {
          break;
        }
        result.push({ pile, index });
      }
    }
  }
  return result;
}

function legalMoves(state: GameState): Move[] {
  const moves: Move[] = [];
  for (const { pile, index } of sources(state)) {
    const single = index === pile.cards.length - 1;
    const targets: PileId[] = [];
    if (single) {
      const foundation = FOUNDATIONS.find((id) => checkMove(state, pile.id, index, id).ok);
      if (foundation !== undefined) {
        targets.push(foundation);
      }
    }
    const columns = TABLEAU.map((id) => getPile(state, id));
    for (const column of targetColumns(columns, pile.kind === "tableau" && index === 0)) {
      targets.push(column.id);
    }
    if (single && pile.kind === "tableau") {
      const cell = CELLS.find((id) => findPile(state, id)?.cards.length === 0);
      if (cell !== undefined) {
        targets.push(cell);
      }
    }
    for (const to of targets) {
      if (checkMove(state, pile.id, index, to).ok) {
        moves.push({ kind: "move", from: pile.id, index, to });
      }
    }
  }
  return moves;
}

function autoMove(state: GameState, options: AutoMoveOptions): Move | undefined {
  if (!options.safeToFoundation) {
    return undefined;
  }
  for (const pile of state.piles) {
    if (pile.kind !== "cell" && pile.kind !== "tableau") {
      continue;
    }
    const card = topCard(pile);
    if (card === undefined || !isSafeForFoundation(state, card)) {
      continue;
    }
    const foundation = FOUNDATIONS.find((id) => {
      const target = findPile(state, id);
      return target !== undefined && canAddToFoundation(card, target);
    });
    if (foundation !== undefined) {
      return { kind: "move", from: pile.id, index: pile.cards.length - 1, to: foundation };
    }
  }
  return undefined;
}

/**
 * Finishable once every column runs high to low: the lowest card left is then always on
 * top somewhere, and it is the next card its foundation needs.
 */
function canFinish(state: GameState): boolean {
  return pilesOfKind(state, "tableau").every((pile) =>
    pile.cards.every((card, i) => i === 0 || (pile.cards[i - 1]?.rank ?? 0) >= card.rank),
  );
}

function canPickUp(state: GameState, pileId: PileId, index: number): boolean {
  const pile = findPile(state, pileId);
  if (pile?.kind === "tableau") {
    return isAlternatingRun(pile.cards, index);
  }
  return pile?.kind === "cell" && index === 0 && pile.cards.length === 1;
}

function dropMove(state: GameState, from: PileId, index: number, to: PileId): Move | undefined {
  return checkMove(state, from, index, to).ok ? { kind: "move", from, index, to } : undefined;
}

function tapMoves(state: GameState, pileId: PileId, index: number): Move[] {
  if (!canPickUp(state, pileId, index)) {
    return [];
  }
  const pile = findPile(state, pileId);
  const single = pile !== undefined && index === pile.cards.length - 1;
  const moves: Move[] = [];
  const add = (to: PileId) => {
    const move = dropMove(state, pileId, index, to);
    if (move !== undefined) {
      moves.push(move);
    }
  };
  if (single) {
    const foundation = FOUNDATIONS.find((id) => dropMove(state, pileId, index, id) !== undefined);
    if (foundation !== undefined) {
      add(foundation);
    }
  }
  for (const id of TABLEAU) {
    if ((findPile(state, id)?.cards.length ?? 0) > 0) {
      add(id);
    }
  }
  if (!(pile?.kind === "tableau" && index === 0)) {
    const empty = TABLEAU.find((id) => findPile(state, id)?.cards.length === 0);
    if (empty !== undefined) {
      add(empty);
    }
  }
  if (single && pile.kind === "tableau") {
    const cell = CELLS.find((id) => findPile(state, id)?.cards.length === 0);
    if (cell !== undefined) {
      add(cell);
    }
  }
  return moves;
}

/** Free cells and columns are interchangeable, so sort them for the solver. */
function cardIds(pile: Pile): string {
  return pile.cards.map((card) => card.id).join(",");
}

function stateKey(state: GameState): string {
  const cells = pilesOfKind(state, "cell")
    .map((pile) => cardIds(pile))
    .toSorted()
    .join("|");
  const columns = pilesOfKind(state, "tableau")
    .map((pile) => cardIds(pile))
    .toSorted()
    .join("|");
  const foundations = pilesOfKind(state, "foundation")
    .map((pile) => pile.cards.length)
    .join(",");
  return `${cells}/${foundations}/${columns}`;
}

const GAP = 0.1;
const STEP = 1 + GAP;

function slot(id: string, x: number, y: number): PileLayout {
  return id.startsWith("f")
    ? { id, x, y, fan: "none", emptyLabel: "A" }
    : { id, x, y, fan: "none" };
}

function layout(_state: GameState, context: LayoutContext): TableLayout {
  const [left, right] = context.leftHanded ? [FOUNDATIONS, CELLS] : [CELLS, FOUNDATIONS];
  if (context.landscape) {
    const tableauX = GAP + 2 * STEP + 0.2;
    const rightX = tableauX + TABLEAU.length * STEP + 0.2;
    return {
      width: rightX + 2 * STEP,
      height: 3.2,
      piles: [
        ...left.map((id, i) => slot(id, GAP + (i % 2) * STEP, GAP + Math.floor(i / 2) * STEP)),
        ...right.map((id, i) => slot(id, rightX + (i % 2) * STEP, GAP + Math.floor(i / 2) * STEP)),
        ...TABLEAU.map((id, i): PileLayout => ({
          id,
          x: tableauX + i * STEP,
          y: GAP,
          fan: "down",
        })),
      ],
    };
  }
  return {
    width: GAP + TABLEAU.length * STEP,
    height: 4.4,
    piles: [
      ...left.map((id, i) => slot(id, GAP + i * STEP, GAP)),
      ...right.map((id, i) => slot(id, GAP + (4 + i) * STEP, GAP)),
      ...TABLEAU.map((id, i): PileLayout => ({
        id,
        x: GAP + i * STEP,
        y: GAP + STEP + 0.05,
        fan: "down",
      })),
    ],
  };
}

export const freecell: Variant = {
  id: "freecell",
  name: "FreeCell",
  description: "Every card face up. Use four free cells to untangle the columns.",
  optionSpecs: [],
  defaultOptions: {},
  scored: false,
  deal,
  layout,
  legalMoves,
  canMove,
  applyMove,
  autoMove,
  isWon: (state) => cardsOnFoundations(state) === 52,
  canFinish,
  canPickUp,
  dropMove,
  tapMoves,
  explainMove: (state, from, index, to) => {
    const check = checkMove(state, from, index, to);
    return check.ok ? undefined : check.reason;
  },
  stateKey,
};
