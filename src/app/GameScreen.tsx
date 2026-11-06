import { useCallback, useEffect, useMemo, useState } from "react";
import type { Move, VariantOptions } from "../engine/types.ts";
import type { AutoMoveOptions, Variant } from "../engine/variant.ts";
import { GameTable } from "../ui/GameTable.tsx";
import { optionsFor } from "./settings.ts";
import { useSettings } from "./settingsContext.ts";
import { SettingsDialog } from "./SettingsDialog.tsx";
import { Toolbar } from "./Toolbar.tsx";
import { currentState, moveCount, newGame, redoable, undoable, useGame } from "./useGame.ts";
import { navigate } from "./useRoute.ts";

interface Props {
  readonly variant: Variant;
  /** Deal this seed instead of a random one. */
  readonly seed?: number | undefined;
}

export function GameScreen({ variant, seed }: Props) {
  const { settings } = useSettings();
  const auto: AutoMoveOptions = useMemo(
    () => ({ safeToFoundation: settings.autoFoundation }),
    [settings.autoFoundation],
  );
  const { game, dispatch, replace } = useGame(() =>
    newGame(variant, seed, optionsFor(settings, variant), auto),
  );
  const state = currentState(game);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const start = useCallback(
    (options: VariantOptions, dealSeed: number | undefined) => {
      replace(newGame(variant, dealSeed, options, auto));
    },
    [auto, replace, variant],
  );

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

  const onPlay = useCallback(
    (move: Move) => {
      if (!variant.canMove(state, move)) {
        return false;
      }
      dispatch({ type: "play", move, auto });
      return true;
    },
    [auto, dispatch, state, variant],
  );

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
        <span>Moves {moveCount(game)}</span>
      </div>
      <GameTable
        variant={variant}
        state={state}
        leftHanded={settings.leftHanded}
        smartTap={settings.smartTap}
        onPlay={onPlay}
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
            disabled: !undoable(game),
            onClick: () => {
              dispatch({ type: "undo" });
            },
          },
          {
            icon: "redo",
            label: "Redo",
            disabled: !redoable(game),
            onClick: () => {
              dispatch({ type: "redo" });
            },
          },
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
