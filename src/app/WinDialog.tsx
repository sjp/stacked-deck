import { useState } from "react";
import type { VariantOptions } from "../engine/types.ts";
import type { Variant } from "../engine/variant.ts";
import { Dialog } from "../ui/Dialog.tsx";
import { formatTime } from "./format.ts";
import { dealUrl, shareText } from "./share.ts";

export interface WinSummary {
  readonly variant: Variant;
  readonly seed: number;
  readonly options: VariantOptions;
  readonly score: number | undefined;
  readonly elapsedMs: number;
  readonly moves: number;
  readonly hints: number;
  readonly undos: number;
  /** Personal bests this game beat. */
  readonly newBests?: readonly string[];
}

interface Props {
  readonly summary: WinSummary;
  readonly onNewGame: () => void;
  readonly onClose: () => void;
}

function Stat({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="win-stat">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

const SHARE_MESSAGES = {
  shared: "Shared",
  copied: "Link copied",
  cancelled: undefined,
  failed: "Couldn't share",
} as const;

export function WinDialog({ summary, onNewGame, onClose }: Props) {
  const [shared, setShared] = useState<string>();
  const share = async () => {
    const time = formatTime(summary.elapsedMs);
    const line = `Stacked Deck — ${summary.variant.name} — won in ${time}, ${summary.moves} moves.`;
    const result = await shareText(line, dealUrl(summary.variant, summary.seed, summary.options));
    setShared(SHARE_MESSAGES[result]);
  };
  return (
    <Dialog open title="You won!" onClose={onClose}>
      <dl className="win-stats">
        {summary.score === undefined ? undefined : (
          <Stat label="Score" value={String(summary.score)} />
        )}
        <Stat label="Time" value={formatTime(summary.elapsedMs)} />
        <Stat label="Moves" value={String(summary.moves)} />
        <Stat label="Hints" value={String(summary.hints)} />
      </dl>
      {summary.newBests !== undefined && summary.newBests.length > 0 ? (
        <p className="win-best">New best: {summary.newBests.join(", ")}</p>
      ) : undefined}
      <div className="dialog-actions">
        <button type="button" className="primary" onClick={onNewGame}>
          New game
        </button>
        <button
          type="button"
          className="button"
          onClick={() => {
            void share();
          }}
        >
          Share deal
        </button>
        {shared === undefined ? undefined : <output>{shared}</output>}
      </div>
    </Dialog>
  );
}
