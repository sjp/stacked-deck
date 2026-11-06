import { useState } from "react";
import type { ReactNode } from "react";
import type { OptionValue, VariantOptions } from "../engine/types.ts";
import type { Variant } from "../engine/variant.ts";
import { Dialog } from "../ui/Dialog.tsx";
import { winnableAvailable } from "./deals.ts";
import type { AnimationSpeed } from "./settings.ts";
import { ANIMATION_SPEEDS, CARD_BACKS, hapticsSupported, sameOptions } from "./settings.ts";
import { useSettings } from "./settingsContext.ts";
import type { CardBack } from "./theme.ts";
import { isThemePreference, THEMES } from "./theme.ts";

const LABELS: Readonly<Record<string, string>> = {
  system: "System",
  light: "Light",
  dark: "Dark",
  lattice: "Lattice",
  dots: "Dots",
  stripes: "Stripes",
  plain: "Plain",
  off: "Off",
  fast: "Fast",
  normal: "Normal",
  slow: "Slow",
};

function Toggle({
  label,
  checked,
  onChange,
  hint,
}: {
  readonly label: string;
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
  readonly hint?: string;
}) {
  return (
    <label className="setting setting-toggle">
      <span>
        {label}
        {hint === undefined ? undefined : <small>{hint}</small>}
      </span>
      <input
        type="checkbox"
        role="switch"
        aria-checked={checked}
        checked={checked}
        onChange={(event) => {
          onChange(event.target.checked);
        }}
      />
    </label>
  );
}

function Choice<T extends OptionValue>({
  label,
  value,
  choices,
  onChange,
}: {
  readonly label: string;
  readonly value: T;
  readonly choices: readonly { readonly value: T; readonly label: string }[];
  readonly onChange: (value: T) => void;
}) {
  return (
    <fieldset className="setting setting-choice">
      <legend>{label}</legend>
      <div className="segmented">
        {choices.map((choice) => (
          <button
            key={String(choice.value)}
            type="button"
            aria-pressed={choice.value === value}
            onClick={() => {
              onChange(choice.value);
            }}
          >
            {choice.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function Section({ title, children }: { readonly title: string; readonly children: ReactNode }) {
  return (
    <section className="settings-section">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

interface Props {
  readonly open: boolean;
  readonly onClose: () => void;
  /** The variant being played, whose options are shown first. */
  readonly variant?: Variant;
  readonly currentOptions?: VariantOptions;
  /** Starts a new game with changed deal options. */
  readonly onNewGame?: (options: VariantOptions) => void;
}

export function SettingsDialog({ open, onClose, variant, currentOptions, onNewGame }: Props) {
  const { settings, update } = useSettings();
  const [pending, setPending] = useState<VariantOptions>();
  const shownOptions = pending ?? currentOptions;

  const setVariantOption = (key: string, value: OptionValue) => {
    if (variant === undefined || currentOptions === undefined) {
      return;
    }
    const next = { ...(shownOptions ?? currentOptions), [key]: value };
    setPending(sameOptions(next, currentOptions) ? undefined : next);
  };

  const close = () => {
    setPending(undefined);
    onClose();
  };

  return (
    <Dialog open={open} title="Settings" onClose={close} className="sheet">
      <div className="settings">
        {variant !== undefined && variant.optionSpecs.length > 0 && shownOptions !== undefined ? (
          <Section title={variant.name}>
            {variant.optionSpecs.map((spec) => (
              <Choice
                key={spec.key}
                label={spec.label}
                value={shownOptions[spec.key] ?? spec.choices[0]?.value ?? ""}
                choices={spec.choices}
                onChange={(value) => {
                  setVariantOption(spec.key, value);
                }}
              />
            ))}
            {pending === undefined ? undefined : (
              <div className="confirm" role="alert">
                <p>Changing this starts a new game.</p>
                <div className="confirm-actions">
                  <button
                    type="button"
                    className="primary"
                    onClick={() => {
                      update({
                        variantOptions: { ...settings.variantOptions, [variant.id]: pending },
                      });
                      onNewGame?.(pending);
                      setPending(undefined);
                      onClose();
                    }}
                  >
                    Start new game
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPending(undefined);
                    }}
                  >
                    Keep playing
                  </button>
                </div>
              </div>
            )}
          </Section>
        ) : undefined}

        <Section title="Look">
          <Choice
            label="Theme"
            value={settings.theme}
            choices={THEMES.map((value) => ({ value, label: LABELS[value] ?? value }))}
            onChange={(theme) => {
              if (isThemePreference(theme)) {
                update({ theme });
              }
            }}
          />
          <Choice<CardBack>
            label="Card back"
            value={settings.cardBack}
            choices={CARD_BACKS.map((value) => ({ value, label: LABELS[value] ?? value }))}
            onChange={(cardBack) => {
              update({ cardBack });
            }}
          />
          <Toggle
            label="Four-colour deck"
            hint="Blue diamonds, green clubs"
            checked={settings.fourColour}
            onChange={(fourColour) => {
              update({ fourColour });
            }}
          />
          <Choice<AnimationSpeed>
            label="Animation"
            value={settings.animation}
            choices={ANIMATION_SPEEDS.map((value) => ({ value, label: LABELS[value] ?? value }))}
            onChange={(animation) => {
              update({ animation });
            }}
          />
          <Toggle
            label="Left-handed layout"
            hint="Stock on the right"
            checked={settings.leftHanded}
            onChange={(leftHanded) => {
              update({ leftHanded });
            }}
          />
        </Section>

        <Section title="Play">
          <Toggle
            label="Smart tap"
            hint="Tap a card to move it to its best place"
            checked={settings.smartTap}
            onChange={(smartTap) => {
              update({ smartTap });
            }}
          />
          <Toggle
            label="Auto-move safe cards"
            hint="Send cards up when they can't be needed"
            checked={settings.autoFoundation}
            onChange={(autoFoundation) => {
              update({ autoFoundation });
            }}
          />
          <Toggle
            label="Finish automatically"
            hint="Otherwise show a Finish button"
            checked={settings.autoFinish}
            onChange={(autoFinish) => {
              update({ autoFinish });
            }}
          />
          <Toggle
            label="Winnable deals only"
            {...(variant !== undefined &&
            shownOptions !== undefined &&
            !winnableAvailable(variant, shownOptions)
              ? { hint: `Not available for these ${variant.name} options, so deals are random` }
              : {})}
            checked={settings.winnableOnly}
            onChange={(winnableOnly) => {
              update({ winnableOnly });
            }}
          />
          <Toggle
            label="Show timer"
            checked={settings.showTimer}
            onChange={(showTimer) => {
              update({ showTimer });
            }}
          />
        </Section>

        <Section title="Sound and touch">
          <Toggle
            label="Sound effects"
            checked={settings.sound}
            onChange={(sound) => {
              update({ sound });
            }}
          />
          {settings.sound ? (
            <label className="setting">
              <span>Volume</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={settings.volume}
                onChange={(event) => {
                  update({ volume: Number(event.target.value) });
                }}
              />
            </label>
          ) : undefined}
          {hapticsSupported() ? (
            <Toggle
              label="Haptics"
              checked={settings.haptics}
              onChange={(haptics) => {
                update({ haptics });
              }}
            />
          ) : undefined}
        </Section>
      </div>
    </Dialog>
  );
}
