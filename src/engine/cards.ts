export type Suit = "spades" | "hearts" | "diamonds" | "clubs";
export type Colour = "black" | "red";
export type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13;

export const SUITS: readonly Suit[] = ["spades", "hearts", "diamonds", "clubs"];
export const RANKS: readonly Rank[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];

export function isRank(value: number): value is Rank {
  return Number.isInteger(value) && value >= 1 && value <= 13;
}

export interface Card {
  /** Unique within a deal, even when several decks are in play. */
  readonly id: number;
  readonly suit: Suit;
  readonly rank: Rank;
  readonly faceUp: boolean;
}

export function colourOf(suit: Suit): Colour {
  return suit === "hearts" || suit === "diamonds" ? "red" : "black";
}

export function sameColour(a: Card, b: Card): boolean {
  return colourOf(a.suit) === colourOf(b.suit);
}

/**
 * Builds face-down cards: `copies` of every rank in each of `suits`, so one full deck is
 * all four suits with one copy, and two decks of spades only is one suit with eight copies.
 */
export function makeCards(suits: readonly Suit[] = SUITS, copies = 1): Card[] {
  const cards: Card[] = [];
  for (let copy = 0; copy < copies; copy++) {
    for (const suit of suits) {
      for (const rank of RANKS) {
        cards.push({ id: cards.length, suit, rank, faceUp: false });
      }
    }
  }
  return cards;
}

export function withFace(card: Card, faceUp: boolean): Card {
  return card.faceUp === faceUp ? card : { ...card, faceUp };
}

const RANK_NAMES: Readonly<Record<Rank, string>> = {
  1: "ace",
  2: "2",
  3: "3",
  4: "4",
  5: "5",
  6: "6",
  7: "7",
  8: "8",
  9: "9",
  10: "10",
  11: "jack",
  12: "queen",
  13: "king",
};

const RANK_LABELS: Readonly<Record<Rank, string>> = {
  1: "A",
  2: "2",
  3: "3",
  4: "4",
  5: "5",
  6: "6",
  7: "7",
  8: "8",
  9: "9",
  10: "10",
  11: "J",
  12: "Q",
  13: "K",
};

/** The short corner index: "A", "10", "K". */
export function rankLabel(rank: Rank): string {
  return RANK_LABELS[rank];
}

/** A spoken name such as "queen of hearts". */
export function cardName(card: Pick<Card, "rank" | "suit">): string {
  return `${RANK_NAMES[card.rank]} of ${card.suit}`;
}
