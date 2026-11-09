import { useState } from "react";
import { Dialog } from "../ui/Dialog.tsx";
import { formatTime } from "./format.ts";
import { dealUrl, shareText } from "./share.ts";

export interface WinSummary {
  readonly variantId: string;
  readonly variantName: string;
  readonly seed: number;
  readonly score: number | undefined;
  readonly elapsedMs: number;
  readonly moves: number;
  readonly hints: number;
  readonly undos: number;
  /** Personal bests this game beat. */
  readonly newBests?: readonly string[];
}

interface Props {
  readonly summary: WinSummary | undefined;
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

export function WinDialog({ summary, onNewGame, onClose }: Props) {
  const [shared, setShared] = useState<string>();
  if (summary === undefined) {
    return undefined;
  }
  const share = async () => {
    const time = formatTime(summary.elapsedMs);
    const line = `Stacked Deck — ${summary.variantName} — won in ${time}, ${summary.moves} moves.`;
    const result = await shareText(line, dealUrl(summary.variantId, summary.seed));
    setShared(result === "copied" ? "Link copied" : result === "shared" ? "Shared" : undefined);
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
