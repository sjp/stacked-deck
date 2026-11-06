import { describe, expect, it } from "vitest";
import { klondike } from "../engine/variants/klondike/klondike.ts";
import { defaultSettings, optionsFor, parseSettings } from "./settings.ts";

describe("parseSettings", () => {
  it("falls back to defaults for junk", () => {
    expect(parseSettings(undefined)).toEqual(defaultSettings());
    expect(parseSettings("nope")).toEqual(defaultSettings());
    expect(parseSettings([1, 2])).toEqual(defaultSettings());
  });

  it("keeps valid values and drops invalid ones", () => {
    const settings = parseSettings({
      theme: "dark",
      cardBack: "polka",
      volume: 3,
      smartTap: false,
      variantOptions: { klondike: { draw: 3, bad: { nested: true } } },
    });
    expect(settings.theme).toBe("dark");
    expect(settings.cardBack).toBe("lattice");
    expect(settings.volume).toBe(defaultSettings().volume);
    expect(settings.smartTap).toBe(false);
    expect(settings.variantOptions).toEqual({ klondike: { draw: 3 } });
  });
});

describe("optionsFor", () => {
  it("uses defaults for missing or invalid choices", () => {
    const settings = { ...defaultSettings(), variantOptions: { klondike: { draw: 7 } } };
    expect(optionsFor(settings, klondike)).toEqual({ draw: 1 });
    const three = { ...defaultSettings(), variantOptions: { klondike: { draw: 3 } } };
    expect(optionsFor(three, klondike)).toEqual({ draw: 3 });
  });
});
