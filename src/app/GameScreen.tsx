import { useEffect, useState } from "react";
import type { Variant } from "../engine/variant.ts";
import { GameTable } from "../ui/GameTable.tsx";
import { useSettings } from "./settingsContext.ts";
import { GameDialogs } from "./GameDialogs.tsx";
import { GameStatus, Toolbar } from "./Toolbar.tsx";
import type { DealLink, Ending } from "./useGameSession.ts";
import { useGameSession } from "./useGameSession.ts";
import { useHints } from "./useHints.ts";
import { useCommandKeys } from "./useKeyDown.ts";
import { navigate } from "./useRoute.ts";

interface Props {
  readonly variant: Variant;
  /** A deal link to open, read from the URL once. */
  readonly link?: DealLink | undefined;
}

export function GameScreen({ variant, link }: Props) {
  const { settings } = useSettings();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [confirmNewOpen, setConfirmNewOpen] = useState(false);
  // Mirrors whether the no-moves prompt is open; it depends on the session, which needs it.
  const [noMovesShown, setNoMovesShown] = useState(false);
  const session = useGameSession({
    variant,
    link,
    settings,
    paused: settingsOpen || helpOpen || confirmNewOpen || noMovesShown,
  });
  const { game, state, start, won } = session;

  const hints = useHints(variant, state, session.auto, !won && !session.finishing);
  const noMovesOpen = hints.noUsefulMoves && !settingsOpen;
  if (noMovesOpen !== noMovesShown) {
    setNoMovesShown(noMovesOpen);
  }

  useEffect(() => {
    document.title = `${variant.name} · Stacked Deck`;
    return () => {
      document.title = "Stacked Deck";
    };
  }, [variant.name]);

  const showHint = () => {
    if (hints.next()) {
      session.countHint();
    }
  };

  useCommandKeys(
    {
      undo: session.undo,
      redo: session.redo,
      hint: showHint,
      // A stray key press shouldn't end a game in progress (and its streak) unasked.
      newGame: () => {
        if (session.started && !won) {
          setConfirmNewOpen(true);
        } else {
          startNew();
        }
      },
      help: () => {
        setHelpOpen(true);
      },
    },
    // Off while any dialog is open, so keys never act on the game behind it.
    !settingsOpen && !helpOpen && !confirmNewOpen && !noMovesOpen && !won && !session.linkPending,
  );

  const startNew = (options = game.options, ending?: Ending) => {
    start(options, undefined, ending);
  };

  return (
    <main className="game">
      <GameStatus
        name={variant.name}
        score={variant.scored ? state.score : undefined}
        moves={session.moves}
        timer={settings.showTimer ? session.timer : undefined}
      />
      <GameTable
        variant={variant}
        state={state}
        leftHanded={settings.leftHanded}
        smartTap={settings.smartTap}
        onPlay={session.play}
        highlight={hints.highlight}
        dealing={session.dealing}
      />
      <Toolbar
        actions={[
          {
            icon: "menu",
            label: "Menu",
            onClick: () => {
              navigate({ name: "home" });
            },
          },
          {
            icon: "new",
            label: "New game",
            onClick: () => {
              startNew();
            },
          },
          {
            icon: "restart",
            label: "Restart",
            onClick: () => {
              start(game.options, game.seed);
            },
          },
          {
            icon: "hint",
            label: "Hint",
            disabled: won,
            onClick: showHint,
          },
          {
            icon: "undo",
            label: "Undo",
            disabled: !session.canUndo,
            onClick: session.undo,
          },
          {
            icon: "redo",
            label: "Redo",
            disabled: !session.canRedo,
            onClick: session.redo,
          },
          ...(session.canFinish && !session.finishing
            ? [
                {
                  icon: "finish" as const,
                  label: "Finish",
                  onClick: session.finish,
                },
              ]
            : []),
          {
            icon: "settings",
            label: "Settings",
            onClick: () => {
              setSettingsOpen(true);
            },
          },
        ]}
      />
      <GameDialogs
        settings={{
          open: settingsOpen,
          onClose: () => {
            setSettingsOpen(false);
          },
          variant,
          currentOptions: game.options,
          onNewGame: (options) => {
            startNew(options);
          },
        }}
        win={{
          won,
          state,
          animate: settings.animation !== "off",
          summary: {
            variant,
            seed: game.seed,
            options: game.options,
            score: variant.scored ? state.score : undefined,
            elapsedMs: session.timer.elapsed(),
            moves: session.moves,
            hints: session.hints,
            undos: game.undos,
            newBests: session.newBests,
          },
          onNewGame: () => {
            startNew();
          },
        }}
        help={{
          open: helpOpen,
          onClose: () => {
            setHelpOpen(false);
          },
        }}
        noMoves={{
          open: noMovesOpen,
          canUndo: session.canUndo,
          onNewGame: () => {
            startNew(game.options, "loss");
          },
          onUndo: session.undo,
          onClose: hints.dismiss,
        }}
        confirmNew={{
          open: confirmNewOpen,
          onConfirm: () => {
            setConfirmNewOpen(false);
            startNew();
          },
          onCancel: () => {
            setConfirmNewOpen(false);
          },
        }}
        link={{
          open: session.linkPending,
          onReplace: session.openLink,
          onKeep: session.dropLink,
        }}
      />
    </main>
  );
}
