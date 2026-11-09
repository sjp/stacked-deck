import { describe, expect, it } from "vitest";
import { makeState } from "../engine/testing.ts";
import type { GameState } from "../engine/types.ts";
import { klondike } from "../engine/variants/klondike/klondike.ts";
import { endingFor } from "./useGameOutcome.ts";

function klondikeTable(stock: string, waste: string, tableau: string): GameState {
  return makeState(
    "klondike",
    [
      { id: "stock", kind: "stock", cards: stock },
      { id: "waste", kind: "waste", cards: waste },
      ...[0, 1, 2, 3].map((i) => ({ id: `f${i}`, kind: "foundation" as const })),
      { id: "t0", kind: "tableau", cards: tableau },
      ...[1, 2, 3, 4, 5, 6].map((i) => ({ id: `t${i}`, kind: "tableau" as const })),
    ],
    { draw: 1 },
  );
}

describe("game endings", () => {
  it("counts a game with only stock cycling left as a loss", () => {
    expect(endingFor(klondike, klondikeTable("-9C -8C", "7C", "KS"))).toBe("loss");
  });

  it("counts a game with useful moves left as abandoned", () => {
    expect(endingFor(klondike, klondikeTable("-AH -9C -8C", "", "KS"))).toBe("abandon");
  });
});
