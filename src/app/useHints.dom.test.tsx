// @vitest-environment happy-dom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { play, settle } from "../engine/game.ts";
import { SOLVER_AUTO, solve } from "../engine/solver.ts";
import type { GameState, Move } from "../engine/types.ts";
import type { AutoMoveOptions } from "../engine/variant.ts";
import { freecell } from "../engine/variants/freecell/freecell.ts";
import { solverLine } from "./solverClient.ts";
import { highlightFor, useHints } from "./useHints.ts";

vi.mock("./solverClient.ts", () => ({ solverLine: vi.fn<typeof solverLine>() }));

/** What the solver worker answers. */
function lineFrom(state: GameState, auto: AutoMoveOptions): readonly Move[] | undefined {
  const result = solve(freecell, state, { maxNodes: 200_000, maxMs: 10_000 }, { startAuto: auto });
  return result.status === "solved" ? result.moves : undefined;
}

const START = settle(freecell, freecell.deal(1, {}), SOLVER_AUTO).state;
const LINE = lineFrom(START, SOLVER_AUTO) ?? [];

function renderHints(state: GameState) {
  return renderHook(({ at }) => useHints(freecell, at, SOLVER_AUTO, true), {
    initialProps: { at: state },
  });
}

describe("solver hints", () => {
  beforeEach(() => {
    vi.mocked(solverLine).mockReset();
    // Like the worker, answer on a later task.
    vi.mocked(solverLine).mockImplementation(async (_variant, state, auto) => {
      await new Promise((resolve) => {
        setTimeout(resolve, 0);
      });
      return lineFrom(state, auto);
    });
  });

  it("follow the kept line without searching again, including after an undo", async () => {
    const { result, rerender } = renderHints(START);
    act(() => {
      result.current.next();
    });
    await waitFor(() => {
      expect(result.current.highlight).toEqual(highlightFor(START, LINE[0]!));
    });

    const second = play(freecell, START, LINE[0]!, SOLVER_AUTO)!.state;
    rerender({ at: second });
    act(() => {
      result.current.next();
    });
    expect(result.current.highlight).toEqual(highlightFor(second, LINE[1]!));

    rerender({ at: START });
    act(() => {
      result.current.next();
    });
    expect(result.current.highlight).toEqual(highlightFor(START, LINE[0]!));
    expect(solverLine).toHaveBeenCalledTimes(1);
  });

  it("search again once the player leaves the line", async () => {
    const { result, rerender } = renderHints(START);
    act(() => {
      result.current.next();
    });
    await waitFor(() => {
      expect(result.current.highlight).toBeDefined();
    });

    const other = freecell
      .legalMoves(START)
      .find((move) => JSON.stringify(move) !== JSON.stringify(LINE[0]))!;
    const elsewhere = play(freecell, START, other, SOLVER_AUTO)!.state;
    rerender({ at: elsewhere });
    act(() => {
      result.current.next();
    });
    expect(solverLine).toHaveBeenCalledTimes(2);
    const fresh = lineFrom(elsewhere, SOLVER_AUTO)!;
    await waitFor(() => {
      expect(result.current.highlight).toEqual(highlightFor(elsewhere, fresh[0]!));
    });
  });
});
