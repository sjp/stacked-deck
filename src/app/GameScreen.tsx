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
}

export function GameScreen({ variant, seed }: Props) {
  const { settings } = useSettings();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const session = useGameSession({
    variant,
    seed,
    settings,
    paused: settingsOpen,
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

  useCommandKeys({ undo: session.undo, redo: session.redo }, !settingsOpen);

  const startNew = (options = game.options) => {
    start(options, undefined);
    if (seed !== undefined) {
      navigate({ name: "play", variant: variant.id }, true);
    }
  };

  return (
    <div className="game">
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
            onClick: () => {
              if (hints.next()) {
                session.countHint();
              }
            },
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
          },
          onNewGame: () => {
            startNew();
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
    </div>
  );
}
