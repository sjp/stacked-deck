import type { OptionValue, VariantOptions } from "./types.ts";
import type { Variant } from "./variant.ts";

/** Identifies a variant and the options that change its deal, e.g. "klondike:draw=3". */
export function dealKey(variant: Variant, options: VariantOptions): string {
  // A missing option (say, from settings saved before it existed) counts as its default.
  const parts = variant.optionSpecs.map(
    (spec) => `${spec.key}=${String(options[spec.key] ?? variant.defaultOptions[spec.key])}`,
  );
  return [variant.id, ...parts].join(":");
}

/** Every combination of a variant's options, for generating deal lists. */
export function allOptionSets(variant: Variant): VariantOptions[] {
  let sets: Record<string, OptionValue>[] = [{}];
  for (const spec of variant.optionSpecs) {
    const next: Record<string, OptionValue>[] = [];
    for (const set of sets) {
      for (const choice of spec.choices) {
        next.push(Object.assign({}, set, { [spec.key]: choice.value }));
      }
    }
    sets = next;
  }
  return sets;
}
