import { settle } from "./game.ts";
import { rankHints } from "./hints.ts";
import { priorityQueue } from "./priorityQueue.ts";
import { pilesKey } from "./state.ts";
import type { GameState, Move } from "./types.ts";
import type { AutoMoveOptions, Variant } from "./variant.ts";

export interface SolveLimits {
  /** Positions to expand before giving up. */
  readonly maxNodes: number;
  /** Wall-clock budget in milliseconds. */
  readonly maxMs: number;
}

export type SolveResult =
  | { readonly status: "solved"; readonly moves: readonly Move[]; readonly nodes: number }
  /**
   * Every position the search tries was visited without a win. For a variant with a
   * `solverEstimate` the search tries every legal move, so this is a proof that the deal
   * can't be won (with the given auto-moves). Otherwise it skips moves that score zero as
   * hints, so this is a proof only for variants where none of those could matter (Golf
   * and TriPeaks, for example).
   */
  | { readonly status: "exhausted"; readonly nodes: number }
  | { readonly status: "gave-up"; readonly nodes: number };

/** The solver plays with safe auto-moves on, as the game does by default. */
export const SOLVER_AUTO: AutoMoveOptions = { safeToFoundation: true };

export interface SolveOptions {
  /** Automatic moves after each move in the search. */
  readonly auto?: AutoMoveOptions;
  /**
   * Automatic moves applied to the start position before searching (defaults to `auto`).
   * A hint passes the player's own, so its first move is legal in the position on screen
   * even when the search itself uses safe auto-moves.
   */
  readonly startAuto?: AutoMoveOptions;
  readonly now?: () => number;
}

interface Frame {
  readonly state: GameState;
  readonly moves: readonly Move[];
  next: number;
}

interface Search {
  readonly variant: Variant;
  readonly limits: SolveLimits;
  readonly auto: AutoMoveOptions;
  readonly now: () => number;
  readonly deadline: number;
  readonly key: (state: GameState) => string;
}

/**
 * Searches for a win, remembering positions already seen. It searches with every card
 * known (for Klondike, that is how a "winnable" deal is usually defined). The returned
 * moves are player moves; automatic moves follow each one, as in play.
 *
 * A variant with a `solverEstimate` gets a best-first search, which tries the position
 * that looks closest to a win next; the others get a depth-first search in hint order.
 */
export function solve(
  variant: Variant,
  start: GameState,
  limits: SolveLimits,
  { auto = SOLVER_AUTO, startAuto = auto, now = () => Date.now() }: SolveOptions = {},
): SolveResult {
  const search: Search = {
    variant,
    limits,
    auto,
    now,
    deadline: now() + limits.maxMs,
    key: (state) => variant.stateKey?.(state) ?? pilesKey(state),
  };
  const first = settle(variant, start, startAuto).state;
  if (variant.isWon(first)) {
    return { status: "solved", moves: [], nodes: 0 };
  }
  return variant.solverEstimate === undefined
    ? depthFirst(search, first)
    : bestFirst(search, first, variant.solverEstimate.bind(variant));
}

/** Whether the search has used up its node or time budget after `nodes` moves tried. */
function outOfBudget({ limits, now, deadline }: Search, nodes: number): boolean {
  return nodes > limits.maxNodes || (nodes % 256 === 0 && now() > deadline);
}

/** Tries moves in hint order, deepest first. */
function depthFirst(search: Search, first: GameState): SolveResult {
  const { variant, auto, key } = search;
  const seen = new Set<string>([key(first)]);
  const path: Move[] = [];
  const stack: Frame[] = [{ state: first, moves: rankHints(variant, first), next: 0 }];
  let nodes = 0;

  while (stack.length > 0) {
    const frame = stack.at(-1);
    if (frame === undefined) {
      break;
    }
    const move = frame.moves[frame.next];
    frame.next += 1;
    if (move === undefined) {
      stack.pop();
      path.pop();
      continue;
    }
    nodes += 1;
    if (outOfBudget(search, nodes)) {
      return { status: "gave-up", nodes };
    }
    const next = settle(variant, variant.applyMove(frame.state, move), auto).state;
    if (variant.isWon(next)) {
      return { status: "solved", moves: [...path, move], nodes };
    }
    const nextKey = key(next);
    if (seen.has(nextKey)) {
      continue;
    }
    seen.add(nextKey);
    path.push(move);
    stack.push({ state: next, moves: rankHints(variant, next), next: 0 });
  }
  return { status: "exhausted", nodes };
}

/**
 * What each move along a line costs in the best-first search, against the estimate. A
 * little keeps the lines short and stops the search diving down one hopeless line; much
 * more and it spreads out level by level, like a breadth-first search.
 */
const DEPTH_WEIGHT = 0.5;

interface Node {
  readonly state: GameState;
  readonly depth: number;
  /** The position this one was reached from, and the move that reached it. */
  readonly from?: { readonly node: Node; readonly move: Move };
}

function lineTo(node: Node): Move[] {
  const moves: Move[] = [];
  for (let at = node.from; at !== undefined; at = at.node.from) {
    moves.push(at.move);
  }
  return moves.toReversed();
}

/**
 * Expands the most promising position first: the lowest estimate plus a small cost per
 * move, the earliest found on a tie. Every legal move is tried, not only useful hints.
 */
function bestFirst(
  search: Search,
  first: GameState,
  estimate: (state: GameState) => number,
): SolveResult {
  const { variant, auto, key } = search;
  const seen = new Set<string>([key(first)]);
  const queue = priorityQueue<Node>();
  queue.push(estimate(first), { state: first, depth: 0 });
  let nodes = 0;

  for (let node = queue.pop(); node !== undefined; node = queue.pop()) {
    for (const move of variant.legalMoves(node.state)) {
      nodes += 1;
      if (outOfBudget(search, nodes)) {
        return { status: "gave-up", nodes };
      }
      const next = settle(variant, variant.applyMove(node.state, move), auto).state;
      const child: Node = { state: next, depth: node.depth + 1, from: { node, move } };
      if (variant.isWon(next)) {
        return { status: "solved", moves: lineTo(child), nodes };
      }
      const nextKey = key(next);
      if (seen.has(nextKey)) {
        continue;
      }
      seen.add(nextKey);
      queue.push(estimate(next) + DEPTH_WEIGHT * child.depth, child);
    }
  }
  return { status: "exhausted", nodes };
}
