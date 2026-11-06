import type { Card } from "../engine/cards.ts";
import type { GameState, PileId } from "../engine/types.ts";
import type { PileLayout, TableLayout } from "../engine/variant.ts";

export const CARD_RATIO = 7 / 5;
/** Below this width cards switch to the compact face. */
export const COMPACT_CARD_WIDTH = 60;
/** Cards never grow beyond this, so a large screen doesn't show huge cards. */
export const MAX_CARD_WIDTH = 120;

/** Fan offsets as fractions of the card height. */
const FAN = {
  up: 0.27,
  down: 0.12,
  /** The smallest face-up offset that still shows the corner index. */
  upMin: 0.2,
  upMinCompact: 0.25,
  downMin: 0.05,
  /** Horizontal fan, as a fraction of the card width. */
  right: 0.32,
} as const;

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

/**
 * Offsets between consecutive cards of a pile fanned into `available` pixels. Face-down
 * cards squeeze first, then face-up cards down to the size that still shows the index;
 * only then does everything shrink together.
 */
export function fanOffsets(
  cards: readonly Card[],
  available: number,
  cardHeight: number,
  compact: boolean,
): number[] {
  const gaps = cards.slice(0, -1);
  const ups = gaps.filter((card) => card.faceUp).length;
  const downs = gaps.length - ups;
  const up = FAN.up * cardHeight;
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
  return gaps.map((card) => (card.faceUp ? upSize : downSize));
}

function placePile(
  pileLayout: PileLayout,
  cards: readonly Card[],
  base: Rect,
  size: Size,
  cardHeight: number,
  compact: boolean,
): { x: number; y: number }[] {
  const fanned = pileLayout.fanCount ?? cards.length;
  const firstFanned = Math.max(0, cards.length - fanned);
  if (pileLayout.fan === "down") {
    const available = size.height - base.y - cardHeight;
    const offsets = fanOffsets(cards.slice(firstFanned), available, cardHeight, compact);
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

  layout.piles.forEach((pileLayout, order) => {
    const pile = byId.get(pileLayout.id);
    if (pile === undefined) {
      return;
    }
    const base: Rect = {
      x: Math.round(offsetX + pileLayout.x * cardWidth),
      y: Math.round(pileLayout.y * cardHeight),
      width: cardWidth,
      height: cardHeight,
    };
    bases.set(pile.id, base);
    const positions = placePile(pileLayout, pile.cards, base, size, cardHeight, compact);
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
        z: order * 200 + index + 1,
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
