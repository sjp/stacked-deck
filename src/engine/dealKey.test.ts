import { describe, expect, it } from "vitest";
import { allOptionSets, dealKey } from "./dealKey.ts";
import { freecell } from "./variants/freecell/freecell.ts";
import { golf } from "./variants/golf/golf.ts";
import { klondike } from "./variants/klondike/klondike.ts";

describe("deal keys", () => {
  it("names the variant and its deal options", () => {
    expect(dealKey(klondike, { draw: 3 })).toBe("klondike:draw=3");
    expect(dealKey(freecell, {})).toBe("freecell");
  });

  it("lists every option combination", () => {
    expect(allOptionSets(klondike)).toEqual([{ draw: 1 }, { draw: 3 }]);
    expect(allOptionSets(golf)).toHaveLength(4);
    expect(allOptionSets(freecell)).toEqual([{}]);
  });
});
