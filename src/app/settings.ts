import type { OptionValue, VariantOptions } from "../engine/types.ts";
import type { Variant } from "../engine/variant.ts";
import type { CardBack, ThemePreference } from "./theme.ts";
import { isThemePreference } from "./theme.ts";

export type AnimationSpeed = "off" | "fast" | "normal" | "slow";

export interface Settings {
  readonly theme: ThemePreference;
  readonly fourColour: boolean;
  readonly cardBack: CardBack;
  readonly smartTap: boolean;
  readonly winnableOnly: boolean;
  readonly autoFinish: boolean;
  readonly autoFoundation: boolean;
  readonly showTimer: boolean;
  readonly leftHanded: boolean;
  readonly animation: AnimationSpeed;
  readonly sound: boolean;
  /** 0–1. */
  readonly volume: number;
  readonly haptics: boolean;
  readonly variantOptions: Readonly<Record<string, VariantOptions>>;
}

export const CARD_BACKS: readonly CardBack[] = ["lattice", "dots", "stripes", "plain"];
export const ANIMATION_SPEEDS: readonly AnimationSpeed[] = ["off", "fast", "normal", "slow"];

/** Transition length for one card move. */
export const MOVE_MS: Readonly<Record<AnimationSpeed, number>> = {
  off: 0,
  fast: 110,
  normal: 180,
  slow: 320,
};

export function hapticsSupported(): boolean {
  return typeof navigator !== "undefined" && "vibrate" in navigator;
}

export function defaultSettings(): Settings {
  return {
    theme: "system",
    fourColour: false,
    cardBack: "lattice",
    smartTap: true,
    winnableOnly: true,
    autoFinish: true,
    autoFoundation: true,
    showTimer: true,
    leftHanded: false,
    animation: "normal",
    sound: false,
    volume: 0.6,
    haptics: hapticsSupported(),
    variantOptions: {},
  };
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pick<T>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.find((item) => item === value) ?? fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function isOptionValue(value: unknown): value is OptionValue {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

function parseOptions(options: Readonly<Record<string, unknown>>): VariantOptions {
  const valid: Record<string, OptionValue> = {};
  for (const [key, value] of Object.entries(options)) {
    if (isOptionValue(value)) {
      valid[key] = value;
    }
  }
  return valid;
}

/** Reads settings from untrusted data, keeping only valid values. */
export function parseSettings(data: unknown): Settings {
  const defaults = defaultSettings();
  if (!isRecord(data)) {
    return defaults;
  }
  const variantOptions: Record<string, VariantOptions> = {};
  const rawOptions = data["variantOptions"];
  if (isRecord(rawOptions)) {
    for (const [variant, options] of Object.entries(rawOptions)) {
      if (isRecord(options)) {
        variantOptions[variant] = parseOptions(options);
      }
    }
  }
  const volume = data["volume"];
  return {
    theme: isThemePreference(data["theme"]) ? data["theme"] : defaults.theme,
    fourColour: bool(data["fourColour"], defaults.fourColour),
    cardBack: pick(data["cardBack"], CARD_BACKS, defaults.cardBack),
    smartTap: bool(data["smartTap"], defaults.smartTap),
    winnableOnly: bool(data["winnableOnly"], defaults.winnableOnly),
    autoFinish: bool(data["autoFinish"], defaults.autoFinish),
    autoFoundation: bool(data["autoFoundation"], defaults.autoFoundation),
    showTimer: bool(data["showTimer"], defaults.showTimer),
    leftHanded: bool(data["leftHanded"], defaults.leftHanded),
    animation: pick(data["animation"], ANIMATION_SPEEDS, defaults.animation),
    sound: bool(data["sound"], defaults.sound),
    volume: typeof volume === "number" && volume >= 0 && volume <= 1 ? volume : defaults.volume,
    haptics: bool(data["haptics"], defaults.haptics),
    variantOptions,
  };
}

/** A variant's options from settings, with any missing or invalid choice set to its default. */
export function optionsFor(settings: Settings, variant: Variant): VariantOptions {
  const saved = settings.variantOptions[variant.id] ?? {};
  const options: Record<string, OptionValue> = { ...variant.defaultOptions };
  for (const spec of variant.optionSpecs) {
    const value = saved[spec.key];
    if (spec.choices.some((choice) => choice.value === value) && value !== undefined) {
      options[spec.key] = value;
    }
  }
  return options;
}

export function sameOptions(a: VariantOptions, b: VariantOptions): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].every((key) => a[key] === b[key]);
}
