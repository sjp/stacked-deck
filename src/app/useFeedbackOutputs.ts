import { useEffect } from "react";
import { onFeedback } from "../ui/feedback.ts";
import { createHaptics } from "./haptics.ts";
import { createSoundPlayer } from "./sound.ts";

function isConstructor(value: unknown): value is typeof AudioContext {
  return typeof value === "function";
}

/** Older iOS Safari has only the prefixed constructor. */
function createAudioContext(): AudioContext {
  const prefixed: unknown = Reflect.get(globalThis, "webkitAudioContext");
  const Context = typeof AudioContext === "undefined" ? prefixed : AudioContext;
  if (!isConstructor(Context)) {
    throw new Error("Web Audio isn't supported");
  }
  return new Context();
}

const sound = createSoundPlayer(createAudioContext);
const haptics = createHaptics(typeof navigator === "undefined" ? undefined : navigator);

/** Plays sounds and haptics for game events, as the settings allow. */
export function useFeedbackOutputs(soundOn: boolean, volume: number, hapticsOn: boolean): void {
  useEffect(() => {
    sound.configure(soundOn, volume);
    haptics.configure(hapticsOn);
  }, [soundOn, volume, hapticsOn]);

  // Browsers only let audio start from a user gesture, so unlock it on the next one.
  useEffect(() => {
    if (!soundOn) {
      return undefined;
    }
    const unlock = () => {
      sound.unlock();
    };
    globalThis.addEventListener("pointerdown", unlock, { once: true });
    globalThis.addEventListener("keydown", unlock, { once: true });
    return () => {
      globalThis.removeEventListener("pointerdown", unlock);
      globalThis.removeEventListener("keydown", unlock);
    };
  }, [soundOn]);

  useEffect(
    () =>
      onFeedback((event) => {
        sound.play(event);
        haptics.play(event);
      }),
    [],
  );
}
