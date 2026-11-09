import { describe, expect, it, vi } from "vitest";
import { emitFeedback, onFeedback } from "./feedback.ts";

describe("feedback", () => {
  it("reaches every listener even when one throws", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {
      // Expected: the broken listener is reported.
    });
    const heard = vi.fn<(event: string) => void>();
    const stopBroken = onFeedback(() => {
      throw new Error("no audio");
    });
    const stopHeard = onFeedback(heard);
    expect(() => {
      emitFeedback("win");
    }).not.toThrow();
    expect(heard).toHaveBeenCalledWith("win");
    stopBroken();
    stopHeard();
  });
});
