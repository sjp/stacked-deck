import { useMemo } from "react";
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
  /** Asks before the N key ends a game in progress. */
  readonly confirmNew: {
    readonly open: boolean;
    readonly onConfirm: () => void;
    readonly onCancel: () => void;
  };
  /** Asks before a deal link replaces the game in progress. */
  readonly link: {
    readonly open: boolean;
    /** Ends the game in progress (it counts as abandoned) and deals the link. */
    readonly onReplace: () => void;
    readonly onKeep: () => void;
  };
}

/** The game screen's overlays: settings, the win celebration and the stuck prompt. */
export function GameDialogs({ settings, win, help, noMoves, confirmNew, link }: Props) {
  const celebration = useWinCelebration(win.won, win.state, win.animate);
  // A new list on every render would restart the animation.
  const celebrated = useMemo(() => cardsForCelebration(win.state), [win.state]);
  return (
    <>
      <SettingsDialog {...settings} />
      {celebration.phase === "animating" ? (
        <WinAnimation
          cards={celebrated}
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
      <Dialog open={confirmNew.open} title="Start a new game?" onClose={confirmNew.onCancel}>
        <p>This ends your game in progress, which breaks your win streak.</p>
        <div className="dialog-actions">
          <button type="button" className="primary" onClick={confirmNew.onConfirm}>
            New game
          </button>
          <button type="button" className="button" onClick={confirmNew.onCancel}>
            Keep playing
          </button>
        </div>
      </Dialog>
      <Dialog open={link.open} title="Replace your game?" onClose={link.onKeep}>
        <p>
          This link opens a different deal. Playing it ends your game in progress, which breaks your
          win streak.
        </p>
        <div className="dialog-actions">
          <button type="button" className="primary" onClick={link.onReplace}>
            Play the linked deal
          </button>
          <button type="button" className="button" onClick={link.onKeep}>
            Keep my game
          </button>
        </div>
      </Dialog>
    </>
  );
}
