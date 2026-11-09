import { describe, expect, it } from "vitest";
import { klondike } from "../engine/variants/klondike/klondike.ts";
import { spider } from "../engine/variants/spider/spider.ts";
import { tripeaks } from "../engine/variants/tripeaks/tripeaks.ts";
import { optionParams, optionsFromParams } from "./dealLink.ts";

describe("deal link options", () => {
  it("round-trips each variant's options", () => {
    for (const [variant, options] of [
      [klondike, { draw: 3 }],
      [spider, { suits: 4 }],
      [tripeaks, { wrap: false }],
    ] as const) {
      const params = optionParams(variant, options);
      expect(optionsFromParams(variant, params, variant.defaultOptions)).toEqual(options);
    }
  });

  it("falls back for missing or invalid values and ignores unknown keys", () => {
    expect(optionsFromParams(spider, { suits: "3", colour: "red" }, { suits: 2 })).toEqual({
      suits: 2,
    });
    expect(optionsFromParams(klondike, {}, { draw: 1 })).toEqual({ draw: 1 });
    expect(optionsFromParams(tripeaks, { wrap: "yes" }, { wrap: true })).toEqual({ wrap: true });
  });
});
