import { useEffect, useState } from "react";
import type { Variant } from "../engine/variant.ts";
import { GameTable } from "../ui/GameTable.tsx";
import { useSettings } from "./settingsContext.ts";
import { GameDialogs } from "./GameDialogs.tsx";
import { GameStatus, Toolbar } from "./Toolbar.tsx";
import { useGameSession } from "./useGameSession.ts";
import { useHints } from "./useHints.ts";
import { useCommandKeys } from "./useKeyDown.ts";
import { navigate } from "./useRoute.ts";

interface Props {
  readonly variant: Variant;
  /** Deal this seed instead of a random one. */
  readonly seed?: number | undefined;
  /** The date of the daily deal being played, if it is one. */
  readonly daily?: string | undefined;
}

export function GameScreen({ variant, seed, daily }: Props) {
  const { settings } = useSettings();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const session = useGameSession({
    variant,
    seed,
    settings,
    paused: settingsOpen || helpOpen,
    daily,
  });
  const { game, state, start, won } = session;

  const hints = useHints(variant, state, !won && !session.finishing);

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

  const startNew = (options = game.options) => {
    if (daily !== undefined) {
      // A daily deal has only one deal; a new game goes back to the list.
      navigate({ name: "daily" });
      return;
    }
    start(options, undefined);
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
          ...(daily === undefined ? { variant, currentOptions: game.options } : {}),
          onNewGame: startNew,
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
            daily,
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
          open: hints.noUsefulMoves && !settingsOpen,
          canUndo: session.canUndo,
          onNewGame: () => {
            start(game.options, undefined, "loss");
          },
          onUndo: session.undo,
          onClose: hints.dismiss,
        }}
      />
    </main>
  );
}
