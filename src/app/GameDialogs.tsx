import type { ComponentProps } from "react";
import type { GameState } from "../engine/types.ts";
import { Dialog } from "../ui/Dialog.tsx";
import { WinAnimation } from "../ui/WinAnimation.tsx";
import { cardsForCelebration, useWinCelebration } from "./celebration.ts";
import { SettingsDialog } from "./SettingsDialog.tsx";
import { KEY_HELP } from "./shortcuts.ts";
import type { WinSummary } from "./WinDialog.tsx";
import { WinDialog } from "./WinDialog.tsx";

interface Props {
  readonly settings: ComponentProps<typeof SettingsDialog>;
  readonly win: {
    readonly won: boolean;
    readonly state: GameState;
    readonly animate: boolean;
    readonly summary: WinSummary;
    readonly onNewGame: () => void;
  };
  readonly help: { readonly open: boolean; readonly onClose: () => void };
  readonly noMoves: {
    readonly open: boolean;
    readonly canUndo: boolean;
    /** Gives up: the game counts as lost. */
    readonly onNewGame: () => void;
    readonly onUndo: () => void;
    readonly onClose: () => void;
  };
}

/** The game screen's overlays: settings, the win celebration and the stuck prompt. */
export function GameDialogs({ settings, win, help, noMoves }: Props) {
  const celebration = useWinCelebration(win.won, win.state, win.animate);
  return (
    <>
      <SettingsDialog {...settings} />
      {celebration.phase === "animating" ? (
        <WinAnimation
          cards={cardsForCelebration(win.state)}
          onDone={() => {
            celebration.setPhase("dialog");
          }}
        />
      ) : undefined}
      <WinDialog
        summary={celebration.phase === "dialog" ? win.summary : undefined}
        onNewGame={win.onNewGame}
        onClose={() => {
          celebration.setPhase("closed");
        }}
      />
      <Dialog open={help.open} title="Keyboard" onClose={help.onClose}>
        <dl className="key-help">
          {KEY_HELP.map(([keys, action]) => (
            <div key={keys}>
              <dt>{keys}</dt>
              <dd>{action}</dd>
            </div>
          ))}
        </dl>
      </Dialog>
      <Dialog open={noMoves.open && !win.won} title="No useful moves" onClose={noMoves.onClose}>
        <p>Only going through the stock is left. Start a new game, or undo and try another way.</p>
        <div className="dialog-actions">
          <button type="button" className="primary" onClick={noMoves.onNewGame}>
            New game
          </button>
          <button
            type="button"
            className="button"
            disabled={!noMoves.canUndo}
            onClick={noMoves.onUndo}
          >
            Undo
          </button>
          <button type="button" className="button" onClick={noMoves.onClose}>
            Keep playing
          </button>
        </div>
      </Dialog>
    </>
  );
}
