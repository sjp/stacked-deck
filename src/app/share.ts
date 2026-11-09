import type { VariantOptions } from "../engine/types.ts";
import type { Variant } from "../engine/variant.ts";
import { optionParams } from "./dealLink.ts";
import { routeHash } from "./route.ts";

export type ShareResult = "shared" | "copied" | "cancelled" | "failed";

/** A link that opens this exact deal, with the options it was dealt with. */
export function dealUrl(variant: Variant, seed: number, options: VariantOptions): string {
  const { origin, pathname } = globalThis.location;
  const hash = routeHash({
    name: "play",
    variant: variant.id,
    seed,
    options: optionParams(variant, options),
  });
  return `${origin}${pathname}${hash}`;
}

async function copy(text: string): Promise<ShareResult> {
  try {
    await navigator.clipboard.writeText(text);
    return "copied";
  } catch (error) {
    console.warn("Copy failed", error);
    return "failed";
  }
}

/**
 * Shares text (and a link) with the Web Share API, or copies it to the clipboard where
 * sharing isn't available or fails. "cancelled" means the player closed the share sheet.
 */
export async function shareText(text: string, url?: string): Promise<ShareResult> {
  const data = url === undefined ? { text } : { text, url };
  const whole = url === undefined ? text : `${text} ${url}`;
  // Some browsers have share() without canShare().
  const canShare =
    typeof navigator.share === "function" &&
    (typeof navigator.canShare !== "function" || navigator.canShare(data));
  if (!canShare) {
    return copy(whole);
  }
  try {
    await navigator.share(data);
    return "shared";
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return "cancelled";
    }
    console.warn("Share failed", error);
    return copy(whole);
  }
}
