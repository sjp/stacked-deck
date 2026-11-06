import type { GameState, Move, OptionValue, PileId, VariantOptions } from "./types.ts";

export interface OptionChoice {
  readonly value: OptionValue;
  readonly label: string;
}

/** A variant option shown in settings, such as Klondike's Draw 1 / Draw 3. */
export interface OptionSpec {
  readonly key: string;
  readonly label: string;
  readonly choices: readonly OptionChoice[];
}

export type Fan = "none" | "down" | "right";

/** Where a pile sits, in card units: x in card widths, y in card heights. */
export interface PileLayout {
  readonly id: PileId;
  readonly x: number;
  readonly y: number;
  readonly fan: Fan;
  /** Only the top `fanCount` cards are fanned (Klondike's Draw 3 waste); the rest stack. */
  readonly fanCount?: number;
  /** Shown on an empty pile, such as "A" for a foundation or "K" for a Klondike column. */
  readonly emptyLabel?: string;
}

export interface TableLayout {
  /** Width of the table in card widths. */
  readonly width: number;
  /** Height of the table in card heights, including the minimum room for fanned piles. */
  readonly height: number;
  /** Drawn in this order, so later piles overlap earlier ones. */
  readonly piles: readonly PileLayout[];
}

export interface LayoutContext {
  readonly landscape: boolean;
  readonly leftHanded: boolean;
}

export interface AutoMoveOptions {
  /** Move cards to the foundations when that can never block a later move. */
  readonly safeToFoundation: boolean;
}

export interface Variant {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly optionSpecs: readonly OptionSpec[];
  readonly defaultOptions: VariantOptions;
  /** Whether this variant keeps a score (FreeCell shows moves and time only). */
  readonly scored: boolean;
  /** Lower scores are better (Golf). */
  readonly lowScoreWins?: boolean;

  deal(seed: number, options: VariantOptions): GameState;
  layout(state: GameState, context: LayoutContext): TableLayout;

  /** Every legal move, used by hints, the solver and stuck detection. */
  legalMoves(state: GameState): Move[];
  canMove(state: GameState, move: Move): boolean;
  /** Applies a legal move. Behaviour for an illegal move is undefined. */
  applyMove(state: GameState, move: Move): GameState;
  /** The next automatic move after a player's move (flips, completed runs, safe moves). */
  autoMove(state: GameState, options: AutoMoveOptions): Move | undefined;
  isWon(state: GameState): boolean;
  /** True once the game can be finished with foundation moves alone. */
  canFinish?(state: GameState): boolean;
  /** True when no move can help any more, so the game is lost. */
  isStuck?(state: GameState): boolean;

  /** Whether the player may pick up `pile.cards[index..]`. */
  canPickUp(state: GameState, pile: PileId, index: number): boolean;
  /** The move meant by dropping `from.cards[index..]` on `to`, if it is legal. */
  dropMove(state: GameState, from: PileId, index: number, to: PileId): Move | undefined;
  /** Legal moves for a tap on `pile.cards[index]` (or on an empty pile), best first. */
  tapMoves(state: GameState, pile: PileId, index: number): Move[];

  /** A key for the solver's seen-positions table. Defaults to the card arrangement. */
  stateKey?(state: GameState): string;
}
