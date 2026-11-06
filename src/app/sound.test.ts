import { describe, expect, it, vi } from "vitest";
import { createSoundPlayer } from "./sound.ts";

describe("sound", () => {
  it("creates no audio context while sound is off", () => {
    const factory = vi.fn<() => AudioContext>(() => {
      throw new Error("created");
    });
    const player = createSoundPlayer(factory);
    player.unlock();
    player.play("drop");
    player.play("win");
    player.configure(false, 1);
    player.play("invalid");
    expect(factory).not.toHaveBeenCalled();
    expect(player.hasContext()).toBe(false);
  });

  it("creates the context once sound is on", () => {
    const factory = vi.fn<() => AudioContext>(() => {
      throw new Error("created");
    });
    const player = createSoundPlayer(factory);
    player.configure(true, 0.5);
    expect(factory).not.toHaveBeenCalled();
    expect(() => {
      player.unlock();
    }).toThrow("created");
    expect(factory).toHaveBeenCalledTimes(1);
  });
});
