import type { OptionValue, VariantOptions } from "../engine/types.ts";
import type { Variant } from "../engine/variant.ts";

/** A deal's options as link parameters, such as `{ draw: "3" }`. */
export function optionParams(
  variant: Variant,
  options: VariantOptions,
): Readonly<Record<string, string>> {
  return Object.fromEntries(
    variant.optionSpecs.map((spec) => [spec.key, String(options[spec.key])]),
  );
}

/**
 * The options a deal link asks for. Each option the variant has is read from the link when
 * it names one of the choices, and otherwise taken from `fallback`; anything else in the
 * link is ignored.
 */
export function optionsFromParams(
  variant: Variant,
  params: Readonly<Record<string, string>>,
  fallback: VariantOptions,
): VariantOptions {
  const options: Record<string, OptionValue> = { ...fallback };
  for (const spec of variant.optionSpecs) {
    const text = params[spec.key];
    const choice = spec.choices.find((candidate) => String(candidate.value) === text);
    if (choice !== undefined) {
      options[spec.key] = choice.value;
    }
  }
  return options;
}
