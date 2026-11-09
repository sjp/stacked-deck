import { useEffect, useState } from "react";
import type { Variant } from "../engine/variant.ts";
import { GameTable } from "../ui/GameTable.tsx";
import { useSettings } from "./settingsContext.ts";
import { GameDialogs } from "./GameDialogs.tsx";
import { GameStatus, Toolbar } from "./Toolbar.tsx";
import type { Ending } from "./useGameSession.ts";
import { useGameSession } from "./useGameSession.ts";
import { useHints } from "./useHints.ts";
import { useCommandKeys } from "./useKeyDown.ts";
import { navigate } from "./useRoute.ts";

interface Props {
  readonly variant: Variant;
  /** Deal this seed instead of a random one. */
  readonly seed?: number | undefined;
}

export function GameScreen({ variant, seed }: Props) {
  const { settings } = useSettings();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  // Mirrors whether the no-moves prompt is open; it depends on the session, which needs it.
  const [noMovesShown, setNoMovesShown] = useState(false);
  const session = useGameSession({
    variant,
    seed,
    settings,
    paused: settingsOpen || helpOpen || noMovesShown,
  });
  const { game, state, start, won } = session;

  const hints = useHints(variant, state, !won && !session.finishing);
  const noMovesOpen = hints.noUsefulMoves && !settingsOpen;
  if (noMovesOpen !== noMovesShown) {
    setNoMovesShown(noMovesOpen);
  }

  const [requestedSeed, setRequestedSeed] = useState(seed);
  if (seed !== requestedSeed) {
    // The URL asked for a different deal.
    setRequestedSeed(seed);
    if (seed !== undefined && seed !== game.seed) {
      start(game.options, seed);
    }
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
      newGame: () => {
        startNew();
      },
      help: () => {
        setHelpOpen(true);
      },
    },
    !settingsOpen && !helpOpen,
  );

  /** Every new deal goes through here, so a linked deal's seed is always dropped. */
  const startNew = (options = game.options, ending?: Ending) => {
    start(options, undefined, ending);
    if (seed !== undefined) {
      navigate({ name: "play", variant: variant.id }, true);
    }
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
            variantId: variant.id,
            variantName: variant.name,
            seed: game.seed,
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
      />
    </main>
  );
}
