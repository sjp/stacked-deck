import { useEffect } from "react";
import { onFeedback } from "./feedback.ts";
import { createHaptics } from "./haptics.ts";
import { createSoundPlayer } from "./sound.ts";

const sound = createSoundPlayer(() => new AudioContext());
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
