import { describe, expect, it } from "vitest";
import { commandFor } from "./shortcuts.ts";

const press = (
  key: string,
  mods: Partial<Record<"ctrl" | "meta" | "shift" | "alt", boolean>> = {},
) =>
  commandFor({
    key,
    ctrlKey: mods.ctrl ?? false,
    metaKey: mods.meta ?? false,
    shiftKey: mods.shift ?? false,
    altKey: mods.alt ?? false,
  });

describe("commandFor", () => {
  it("maps undo and redo", () => {
    expect(press("z", { ctrl: true })).toBe("undo");
    expect(press("z", { meta: true })).toBe("undo");
    expect(press("Z", { ctrl: true, shift: true })).toBe("redo");
    expect(press("z", { meta: true, shift: true })).toBe("redo");
    expect(press("y", { ctrl: true })).toBe("redo");
  });

  it("ignores other keys", () => {
    expect(press("z")).toBeUndefined();
    expect(press("y", { meta: true })).toBeUndefined();
    expect(press("z", { ctrl: true, alt: true })).toBeUndefined();
  });
});
