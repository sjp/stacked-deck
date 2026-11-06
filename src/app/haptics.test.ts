import { describe, expect, it, vi } from "vitest";
import { createHaptics } from "./haptics.ts";

describe("haptics", () => {
  it("vibrates with each event's pattern when on", () => {
    const vibrate = vi.fn<(pattern: number | number[]) => boolean>(() => true);
    const haptics = createHaptics({ vibrate });
    haptics.play("pickup");
    expect(vibrate).not.toHaveBeenCalled();
    haptics.configure(true);
    haptics.play("pickup");
    haptics.play("invalid");
    haptics.play("drop");
    expect(vibrate.mock.calls).toEqual([[5], [[20, 40, 20]]]);
  });

  it("does nothing without the Vibration API, and survives errors", () => {
    const missing = createHaptics(undefined);
    missing.configure(true);
    expect(() => {
      missing.play("win");
    }).not.toThrow();
    const throwing = createHaptics({
      vibrate: () => {
        throw new Error("blocked");
      },
    });
    throwing.configure(true);
    expect(() => {
      throwing.play("win");
    }).not.toThrow();
  });
});
