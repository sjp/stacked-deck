import { VARIANTS } from "../engine/variants/index.ts";
import type { KeyValueStore } from "./storage.ts";
import { removeStored } from "./storage.ts";

/**
 * Removes keys written by features that no longer exist: a results list and a second
 * saved-game slot per variant. Removing a missing key is harmless, so this runs on every
 * start rather than tracking whether it has run before.
 */
export function removeRetiredData(store?: KeyValueStore): void {
  for (const key of ["daily", ...VARIANTS.map((variant) => `game:${variant.id}:daily`)]) {
    removeStored(key, store);
  }
}
