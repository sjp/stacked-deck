import type { Variant } from "../variant.ts";
import { freecell } from "./freecell/freecell.ts";
import { klondike } from "./klondike/klondike.ts";
import { spider } from "./spider/spider.ts";

/** Every playable variant, in the order shown on the home screen. */
export const VARIANTS: readonly Variant[] = [klondike, spider, freecell];

export const variants: Readonly<Record<string, Variant>> = Object.fromEntries(
  VARIANTS.map((variant) => [variant.id, variant]),
);

export function getVariant(id: string): Variant | undefined {
  return variants[id];
}
