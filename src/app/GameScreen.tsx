import { useEffect, useState } from "react";
import type { VariantOptions } from "../engine/types.ts";
import type { Variant } from "../engine/variant.ts";
import { GameTable } from "../ui/GameTable.tsx";
import { useSettings } from "./settingsContext.ts";
import { SettingsDialog } from "./SettingsDialog.tsx";
import { Toolbar } from "./Toolbar.tsx";
import { useGameSession } from "./useGameSession.ts";
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
  const { game, state, start } = session;

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

  const startNew = (options: VariantOptions = game.options) => {
    start(options, undefined);
    if (seed !== undefined) {
      navigate({ name: "play", variant: variant.id }, true);
    }
  };

  return (
    <div className="game">
      <div className="status">
        <span className="status-name">{variant.name}</span>
        {variant.scored ? <span>Score {state.score}</span> : undefined}
        <span>Moves {session.moves}</span>
      </div>
      <GameTable
        variant={variant}
        state={state}
        leftHanded={settings.leftHanded}
        smartTap={settings.smartTap}
        onPlay={session.play}
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
      <SettingsDialog
        open={settingsOpen}
        onClose={() => {
          setSettingsOpen(false);
        }}
        variant={variant}
        currentOptions={game.options}
        onNewGame={startNew}
      />
    </div>
  );
}
