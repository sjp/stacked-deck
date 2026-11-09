import { withFace } from "../../cards.ts";
import type { Card } from "../../cards.ts";
import { shuffledDeck } from "../../rng.ts";
import {
  canAddToFoundation,
  canStackAlternating,
  cardsOnFoundations,
  isAlternatingRun,
  isSafeForFoundation,
  transfer,
} from "../../rules.ts";
import {
  addScore,
  counter,
  findPile,
  getPile,
  makePile,
  playKey,
  pilesOfKind,
  topCard,
  withCounter,
  withPiles,
} from "../../state.ts";
import type { GameState, Move, Pile, PileId, VariantOptions } from "../../types.ts";
import type {
  AutoMoveOptions,
  LayoutContext,
  PileLayout,
  TableLayout,
  Variant,
} from "../../variant.ts";

const STOCK = "stock";
const WASTE = "waste";
const FOUNDATIONS = ["f0", "f1", "f2", "f3"] as const;
const TABLEAU = ["t0", "t1", "t2", "t3", "t4", "t5", "t6"] as const;

/** Standard (Windows-style) scoring. */
export const KLONDIKE_POINTS = {
  wasteToTableau: 5,
  toFoundation: 10,
  turnOver: 5,
  foundationToTableau: -15,
  recycleDraw1: -100,
  recycleDraw3: -20,
  /** Draw 3 recycles are free for this many passes. */
  freeDraw3Recycles: 2,
} as const;

function drawCount(state: GameState): number {
  return state.options["draw"] === 3 ? 3 : 1;
}

function deal(seed: number, options: VariantOptions): GameState {
  const { seed: normalized, cards: deck } = shuffledDeck(seed);
  const piles: Pile[] = [];
  let next = 0;
  const tableau = TABLEAU.map((id, column) => {
    const cards = deck
      .slice(next, next + column + 1)
      .map((card, row) => withFace(card, row === column));
    next += column + 1;
    return makePile(id, "tableau", cards);
  });
  piles.push(
    makePile(STOCK, "stock", deck.slice(next)),
    makePile(WASTE, "waste"),
    ...FOUNDATIONS.map((id) => makePile(id, "foundation")),
    ...tableau,
  );
  return {
    variant: "klondike",
    seed: normalized,
    options: { draw: options["draw"] === 3 ? 3 : 1 },
    piles,
    score: 0,
    counters: { recycles: 0 },
  };
}

function canMoveCards(state: GameState, from: PileId, index: number, to: PileId): boolean {
  const source = findPile(state, from);
  const target = findPile(state, to);
  if (source === undefined || target === undefined || from === to) {
    return false;
  }
  const card = source.cards[index];
  if (card === undefined || !card.faceUp) {
    return false;
  }
  const single = index === source.cards.length - 1;
  switch (source.kind) {
    case "waste":
    case "foundation": {
      if (!single) {
        return false;
      }
      break;
    }
    case "tableau": {
      if (!isAlternatingRun(source.cards, index)) {
        return false;
      }
      break;
    }
    case "stock":
    case "cell":
    case "reserve": {
      return false;
    }
  }
  if (target.kind === "foundation") {
    return single && source.kind !== "foundation" && canAddToFoundation(card, target);
  }
  if (target.kind === "tableau") {
    const top = topCard(target);
    return top === undefined ? card.rank === 13 : canStackAlternating(card, top);
  }
  return false;
}

function canMove(state: GameState, move: Move): boolean {
  if (move.kind === "draw") {
    return getPile(state, STOCK).cards.length > 0;
  }
  if (move.kind === "recycle") {
    return getPile(state, STOCK).cards.length === 0 && getPile(state, WASTE).cards.length > 0;
  }
  if (move.kind === "flip") {
    const pile = findPile(state, move.pile);
    const top = pile === undefined ? undefined : topCard(pile);
    return pile?.kind === "tableau" && top !== undefined && !top.faceUp;
  }
  if (move.kind === "move") {
    return canMoveCards(state, move.from, move.index, move.to);
  }
  return false;
}

function moveScore(state: GameState, from: PileId, to: PileId): number {
  const fromKind = getPile(state, from).kind;
  const toKind = getPile(state, to).kind;
  if (toKind === "foundation") {
    return KLONDIKE_POINTS.toFoundation;
  }
  if (fromKind === "waste") {
    return KLONDIKE_POINTS.wasteToTableau;
  }
  if (fromKind === "foundation") {
    return KLONDIKE_POINTS.foundationToTableau;
  }
  return 0;
}

function applyMove(state: GameState, move: Move): GameState {
  if (move.kind === "draw") {
    const stock = getPile(state, STOCK).cards;
    const count = Math.min(drawCount(state), stock.length);
    const drawn = stock
      .slice(-count)
      .toReversed()
      .map((card) => withFace(card, true));
    return withPiles(state, {
      [STOCK]: stock.slice(0, -count),
      [WASTE]: [...getPile(state, WASTE).cards, ...drawn],
    });
  }
  if (move.kind === "recycle") {
    const recycles = counter(state, "recycles");
    const waste = getPile(state, WASTE).cards;
    const restocked = withPiles(state, {
      [STOCK]: waste.toReversed().map((card) => withFace(card, false)),
      [WASTE]: [],
    });
    const penalty =
      drawCount(state) === 1
        ? KLONDIKE_POINTS.recycleDraw1
        : recycles >= KLONDIKE_POINTS.freeDraw3Recycles
          ? KLONDIKE_POINTS.recycleDraw3
          : 0;
    return clampScore(addScore(withCounter(restocked, "recycles", recycles + 1), penalty));
  }
  if (move.kind === "flip") {
    const cards = getPile(state, move.pile).cards;
    const top = cards.at(-1);
    if (top === undefined) {
      return state;
    }
    const flipped = withPiles(state, { [move.pile]: [...cards.slice(0, -1), withFace(top, true)] });
    return addScore(flipped, KLONDIKE_POINTS.turnOver);
  }
  if (move.kind === "move") {
    const moved = withPiles(state, transfer(state, move.from, move.index, move.to));
    return clampScore(addScore(moved, moveScore(state, move.from, move.to)));
  }
  return state;
}

function clampScore(state: GameState): GameState {
  return state.score < 0 ? { ...state, score: 0 } : state;
}

/** Sources a single card can come from: the waste top and tableau tops. */
function topSources(state: GameState): { pile: Pile; index: number; card: Card }[] {
  const sources: { pile: Pile; index: number; card: Card }[] = [];
  for (const pile of [getPile(state, WASTE), ...pilesOfKind(state, "tableau")]) {
    const card = topCard(pile);
    if (card?.faceUp === true) {
      sources.push({ pile, index: pile.cards.length - 1, card });
    }
  }
  return sources;
}

function legalMoves(state: GameState): Move[] {
  const moves: Move[] = [];
  const foundations = pilesOfKind(state, "foundation");
  const tableau = pilesOfKind(state, "tableau");

  for (const pile of tableau) {
    const top = topCard(pile);
    if (top !== undefined && !top.faceUp) {
      moves.push({ kind: "flip", pile: pile.id });
    }
  }
  for (const { pile, index } of topSources(state)) {
    for (const foundation of foundations) {
      if (canMoveCards(state, pile.id, index, foundation.id)) {
        moves.push({ kind: "move", from: pile.id, index, to: foundation.id });
        break;
      }
    }
  }
  const sources: { pile: Pile; index: number }[] = [];
  const waste = getPile(state, WASTE);
  if (waste.cards.length > 0) {
    sources.push({ pile: waste, index: waste.cards.length - 1 });
  }
  for (const pile of tableau) {
    pile.cards.forEach((card, index) => {
      if (card.faceUp) {
        sources.push({ pile, index });
      }
    });
  }
  for (const foundation of foundations) {
    if (foundation.cards.length > 0) {
      sources.push({ pile: foundation, index: foundation.cards.length - 1 });
    }
  }
  for (const { pile, index } of sources) {
    let triedEmpty = false;
    for (const target of tableau) {
      if (target.cards.length === 0) {
        // Every empty column is equivalent, and moving a whole column to one is pointless.
        if (triedEmpty || (pile.kind === "tableau" && index === 0)) {
          continue;
        }
        triedEmpty = true;
      }
      if (canMoveCards(state, pile.id, index, target.id)) {
        moves.push({ kind: "move", from: pile.id, index, to: target.id });
      }
    }
  }
  if (getPile(state, STOCK).cards.length > 0) {
    moves.push({ kind: "draw" });
  } else if (waste.cards.length > 0) {
    moves.push({ kind: "recycle" });
  }
  return moves;
}

function autoMove(state: GameState, options: AutoMoveOptions): Move | undefined {
  for (const pile of pilesOfKind(state, "tableau")) {
    const top = topCard(pile);
    if (top !== undefined && !top.faceUp) {
      return { kind: "flip", pile: pile.id };
    }
  }
  if (!options.safeToFoundation) {
    return undefined;
  }
  for (const { pile, index, card } of topSources(state)) {
    if (!isSafeForFoundation(state, card)) {
      continue;
    }
    const foundation = pilesOfKind(state, "foundation").find((target) =>
      canAddToFoundation(card, target),
    );
    if (foundation !== undefined) {
      return { kind: "move", from: pile.id, index, to: foundation.id };
    }
  }
  return undefined;
}

function canFinish(state: GameState): boolean {
  return (
    getPile(state, STOCK).cards.length === 0 &&
    getPile(state, WASTE).cards.length === 0 &&
    pilesOfKind(state, "tableau").every((pile) => pile.cards.every((card) => card.faceUp))
  );
}

function canPickUp(state: GameState, pileId: PileId, index: number): boolean {
  const pile = findPile(state, pileId);
  if (pile?.kind === "tableau") {
    return isAlternatingRun(pile.cards, index);
  }
  if (pile?.kind === "waste" || pile?.kind === "foundation") {
    return index === pile.cards.length - 1 && index >= 0;
  }
  return false;
}

function dropMove(state: GameState, from: PileId, index: number, to: PileId): Move | undefined {
  const move: Move = { kind: "move", from, index, to };
  return canMove(state, move) ? move : undefined;
}

function tapMoves(state: GameState, pileId: PileId, index: number): Move[] {
  const pile = findPile(state, pileId);
  if (pile === undefined) {
    return [];
  }
  if (pile.kind === "stock") {
    const draw: Move = { kind: "draw" };
    const recycle: Move = { kind: "recycle" };
    return [draw, recycle].filter((move) => canMove(state, move));
  }
  const card = pile.cards[index];
  if (card === undefined) {
    return [];
  }
  if (!card.faceUp) {
    const flip: Move = { kind: "flip", pile: pileId };
    return index === pile.cards.length - 1 && canMove(state, flip) ? [flip] : [];
  }
  if (!canPickUp(state, pileId, index)) {
    return [];
  }
  const moves: Move[] = [];
  if (pile.kind !== "foundation") {
    for (const foundation of FOUNDATIONS) {
      const move = dropMove(state, pileId, index, foundation);
      if (move !== undefined) {
        moves.push(move);
        break;
      }
    }
  }
  const occupied: Move[] = [];
  let empty: Move | undefined;
  for (const target of TABLEAU) {
    const move = dropMove(state, pileId, index, target);
    if (move === undefined) {
      continue;
    }
    if (getPile(state, target).cards.length > 0) {
      occupied.push(move);
    } else if (!(pile.kind === "tableau" && index === 0)) {
      empty ??= move;
    }
  }
  moves.push(...occupied);
  if (empty !== undefined) {
    moves.push(empty);
  }
  return moves;
}

const GAP = 0.1;
const STEP = 1 + GAP;

function layout(state: GameState, context: LayoutContext): TableLayout {
  const wasteFan = drawCount(state) === 3 ? 3 : 1;
  if (context.landscape) {
    const tableauX = GAP + STEP + 0.2;
    const foundationX = tableauX + TABLEAU.length * STEP + 0.2;
    const width = foundationX + 2 * STEP;
    const side = (x: number) => (context.leftHanded ? width - x - 1 : x);
    const piles: PileLayout[] = [
      { id: STOCK, x: side(GAP), y: GAP, fan: "none" },
      { id: WASTE, x: side(GAP), y: GAP + STEP, fan: "down", fanCount: wasteFan },
      ...FOUNDATIONS.map((id, i): PileLayout => ({
        id,
        x: side(foundationX + (i % 2) * STEP),
        y: GAP + Math.floor(i / 2) * STEP,
        fan: "none",
        emptyLabel: "A",
      })),
      ...TABLEAU.map((id, i): PileLayout => ({
        id,
        x: side(tableauX + i * STEP),
        y: GAP,
        fan: "down",
        emptyLabel: "K",
      })),
    ];
    return { width, height: 3.2, piles };
  }
  const width = GAP + TABLEAU.length * STEP;
  const side = (x: number) => (context.leftHanded ? width - x - 1 : x);
  const wasteX = context.leftHanded ? GAP + STEP + (wasteFan - 1) * 0.32 : GAP + STEP;
  const piles: PileLayout[] = [
    { id: STOCK, x: side(GAP), y: GAP, fan: "none" },
    {
      id: WASTE,
      x: context.leftHanded ? width - wasteX - 1 : wasteX,
      y: GAP,
      fan: "right",
      fanCount: wasteFan,
    },
    ...FOUNDATIONS.map((id, i): PileLayout => ({
      id,
      x: side(GAP + (3 + i) * STEP),
      y: GAP,
      fan: "none",
      emptyLabel: "A",
    })),
    ...TABLEAU.map((id, i): PileLayout => ({
      id,
      x: side(GAP + i * STEP),
      y: GAP + STEP + 0.05,
      fan: "down",
      emptyLabel: "K",
    })),
  ];
  return { width, height: 4.2, piles };
}

export const klondike: Variant = {
  id: "klondike",
  name: "Klondike",
  description: "The classic. Build down in alternating colours and up by suit.",
  optionSpecs: [
    {
      key: "draw",
      label: "Draw",
      choices: [
        { value: 1, label: "Draw 1" },
        { value: 3, label: "Draw 3" },
      ],
    },
  ],
  defaultOptions: { draw: 1 },
  scored: true,
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
  stateKey: playKey,
};
