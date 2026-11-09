import type { Card } from "../engine/cards.ts";
import type { GameState, Pile, PileId } from "../engine/types.ts";
import type { PileLayout, TableLayout } from "../engine/variant.ts";

export const CARD_RATIO = 7 / 5;
/** Below this width cards switch to the compact face. */
export const COMPACT_CARD_WIDTH = 60;
/** Cards never grow beyond this, so a large screen doesn't show huge cards. */
export const MAX_CARD_WIDTH = 120;
/** Above every resting card, so a card in motion never slides underneath one. */
export const LIFT_Z = 5000;

/** Fan offsets as fractions of the card height. */
const FAN = {
  up: 0.27,
  /** Tableau columns spread face-up cards up to this when the table has room. */
  upMax: 0.45,
  down: 0.12,
  /** The smallest face-up offset that still shows the corner index. */
  upMin: 0.2,
  upMinCompact: 0.25,
  downMin: 0.05,
  /** Horizontal fan, as a fraction of the card width. */
  right: 0.32,
} as const;

/** The space kept between a fanned pile and a pile below it, as a fraction of the card height. */
const PILE_GAP = 0.1;

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface CardPlacement {
  readonly card: Card;
  readonly pile: PileId;
  readonly index: number;
  readonly x: number;
  readonly y: number;
  /** Stacking order: piles in layout order, each from the bottom card up. */
  readonly z: number;
}

export interface TableGeometry {
  readonly cardWidth: number;
  readonly cardHeight: number;
  readonly compact: boolean;
  readonly cards: readonly CardPlacement[];
  /** Each pile's area, from its base to its top card, for hit testing. */
  readonly piles: ReadonlyMap<PileId, Rect>;
  /** The base of each pile, where an empty pile is drawn. */
  readonly bases: ReadonlyMap<PileId, Rect>;
}

export interface Size {
  readonly width: number;
  readonly height: number;
}

export function fitCardWidth(layout: TableLayout, size: Size): number {
  const byWidth = size.width / layout.width;
  const byHeight = size.height / (layout.height * CARD_RATIO);
  return Math.max(1, Math.floor(Math.min(MAX_CARD_WIDTH, byWidth, byHeight)));
}

/** How many of a fanned pile's gaps show a face-up card, and how many a face-down one. */
function fanGaps(cards: readonly Card[]): { ups: number; downs: number } {
  const gaps = cards.slice(0, -1);
  const ups = gaps.filter((card) => card.faceUp).length;
  return { ups, downs: gaps.length - ups };
}

/**
 * Offsets between consecutive cards of a pile fanned into `available` pixels. Face-up cards
 * are `up` apart when there is room. Face-down cards squeeze first, then face-up cards down
 * to the size that still shows the index; only then does everything shrink together.
 */
export function fanOffsets(
  cards: readonly Card[],
  available: number,
  cardHeight: number,
  compact: boolean,
  up = FAN.up * cardHeight,
): number[] {
  const { ups, downs } = fanGaps(cards);
  const down = FAN.down * cardHeight;
  const upMin = (compact ? FAN.upMinCompact : FAN.upMin) * cardHeight;
  const downMin = FAN.downMin * cardHeight;

  let upSize = up;
  let downSize = down;
  if (ups * up + downs * down > available) {
    downSize = Math.max(downMin, Math.min(down, (available - ups * up) / Math.max(1, downs)));
    if (ups > 0) {
      upSize = Math.max(upMin, Math.min(up, (available - downs * downSize) / ups));
    }
    const total = ups * upSize + downs * downSize;
    if (total > available && total > 0) {
      const scale = Math.max(0, available) / total;
      upSize *= scale;
      downSize *= scale;
    }
  }
  return cards.slice(0, -1).map((card) => (card.faceUp ? upSize : downSize));
}

/**
 * The face-up offset shared by every tableau column, so the columns look even: as wide as
 * the column with the least room allows, up to `FAN.upMax`. It is never below the usual
 * `FAN.up`; a column without room for that shrinks on its own in `fanOffsets`.
 */
function tableauUp(
  columns: readonly { cards: readonly Card[]; available: number }[],
  cardHeight: number,
): number {
  let up = FAN.upMax * cardHeight;
  for (const { cards, available } of columns) {
    const { ups, downs } = fanGaps(cards);
    if (ups > 0) {
      up = Math.min(up, (available - downs * FAN.down * cardHeight) / ups);
    }
  }
  return Math.max(FAN.up * cardHeight, up);
}

/** A down-fanned pile's spare height: to the next pile below it, or to the table's bottom. */
function roomBelow(
  layout: TableLayout,
  pileLayout: PileLayout,
  size: Size,
  cardHeight: number,
): number {
  let bottom = size.height;
  for (const other of layout.piles) {
    const below = other.y > pileLayout.y;
    const overlaps = other.x < pileLayout.x + 1 && other.x + 1 > pileLayout.x;
    if (below && overlaps) {
      bottom = Math.min(bottom, Math.round((other.y - PILE_GAP) * cardHeight));
    }
  }
  return bottom - Math.round(pileLayout.y * cardHeight) - cardHeight;
}

/** Tableau columns fanned down in full spread their face-up cards into spare height. */
function grows(pileLayout: PileLayout, pile: Pile): boolean {
  return pile.kind === "tableau" && pileLayout.fan === "down" && pileLayout.fanCount === undefined;
}

function placePile(
  pileLayout: PileLayout,
  cards: readonly Card[],
  base: Rect,
  available: number,
  up: number | undefined,
  cardHeight: number,
  compact: boolean,
): { x: number; y: number }[] {
  const fanned = pileLayout.fanCount ?? cards.length;
  const firstFanned = Math.max(0, cards.length - fanned);
  if (pileLayout.fan === "down") {
    const offsets = fanOffsets(cards.slice(firstFanned), available, cardHeight, compact, up);
    let y = base.y;
    return cards.map((_, index) => {
      const position = { x: base.x, y };
      y += index >= firstFanned ? (offsets[index - firstFanned] ?? 0) : 0;
      return position;
    });
  }
  if (pileLayout.fan === "right") {
    const step = FAN.right * base.width;
    return cards.map((_, index) => ({
      x: base.x + Math.max(0, index - firstFanned) * step,
      y: base.y,
    }));
  }
  return cards.map(() => ({ x: base.x, y: base.y }));
}

/** Works out where every card goes for a table of the given size. */
export function computeGeometry(state: GameState, layout: TableLayout, size: Size): TableGeometry {
  const cardWidth = fitCardWidth(layout, size);
  const cardHeight = Math.round(cardWidth * CARD_RATIO);
  const compact = cardWidth < COMPACT_CARD_WIDTH;
  const offsetX = Math.max(0, (size.width - layout.width * cardWidth) / 2);

  const placements: CardPlacement[] = [];
  const piles = new Map<PileId, Rect>();
  const bases = new Map<PileId, Rect>();
  const byId = new Map(state.piles.map((pile) => [pile.id, pile]));
  const shown = layout.piles.flatMap((pileLayout) => {
    const pile = byId.get(pileLayout.id);
    return pile === undefined
      ? []
      : [{ pileLayout, pile, available: roomBelow(layout, pileLayout, size, cardHeight) }];
  });
  const columns = shown
    .filter(({ pileLayout, pile }) => grows(pileLayout, pile))
    .map(({ pile, available }) => ({ cards: pile.cards, available }));
  const up = tableauUp(columns, cardHeight);

  shown.forEach(({ pileLayout, pile, available }) => {
    const base: Rect = {
      x: Math.round(offsetX + pileLayout.x * cardWidth),
      y: Math.round(pileLayout.y * cardHeight),
      width: cardWidth,
      height: cardHeight,
    };
    bases.set(pile.id, base);
    const pileUp = grows(pileLayout, pile) ? up : undefined;
    const positions = placePile(
      pileLayout,
      pile.cards,
      base,
      available,
      pileUp,
      cardHeight,
      compact,
    );
    let right = base.x + cardWidth;
    let bottom = base.y + cardHeight;
    pile.cards.forEach((card, index) => {
      const position = positions[index] ?? base;
      right = Math.max(right, position.x + cardWidth);
      bottom = Math.max(bottom, position.y + cardHeight);
      placements.push({
        card,
        pile: pile.id,
        index,
        x: Math.round(position.x),
        y: Math.round(position.y),
        z: placements.length + 1,
      });
    });
    piles.set(pile.id, { x: base.x, y: base.y, width: right - base.x, height: bottom - base.y });
  });

  return { cardWidth, cardHeight, compact, cards: placements, piles, bases };
}

export function overlapArea(a: Rect, b: Rect): number {
  const width = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const height = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return width > 0 && height > 0 ? width * height : 0;
}

export function containsPoint(rect: Rect, x: number, y: number): boolean {
  return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
}
