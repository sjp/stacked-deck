import { useCallback, useRef } from "react";
import type { Move } from "../engine/types.ts";
import type { Variant } from "../engine/variant.ts";
import { Table } from "../ui/Table.tsx";
import { useGeometry } from "../ui/useGeometry.ts";
import { useElementSize } from "../ui/useElementSize.ts";
import { useTableInteraction } from "../ui/useTableInteraction.ts";
import { randomSeed } from "./random.ts";
import { currentState, newGame, useGame } from "./useGame.ts";

const AUTO = { safeToFoundation: true };

export function GameScreen({ variant }: { readonly variant: Variant }) {
  const { game, dispatch, replace } = useGame(() =>
    newGame(variant, randomSeed(), variant.defaultOptions, AUTO),
  );
  const state = currentState(game);
  const areaRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  const size = useElementSize(areaRef);
  const table = useGeometry(variant, state, size, false);

  const onPlay = useCallback(
    (move: Move) => {
      if (!variant.canMove(state, move)) {
        return false;
      }
      dispatch({ type: "play", move, auto: AUTO });
      return true;
    },
    [dispatch, state, variant],
  );

  const interaction = useTableInteraction({
    variant,
    state,
    geometry: table?.geometry,
    smartTap: true,
    tableRef,
    onPlay,
  });

  return (
    <div className="game">
      <div className="toolbar">
        <button
          type="button"
          onClick={() => {
            replace(newGame(variant, randomSeed(), game.options, AUTO));
          }}
        >
          New game
        </button>
        <button
          type="button"
          onClick={() => {
            dispatch({ type: "undo" });
          }}
        >
          Undo
        </button>
        <span>Score {state.score}</span>
      </div>
      <div className="table-area" ref={areaRef}>
        {table === undefined ? undefined : (
          <Table
            state={state}
            layout={table.layout}
            geometry={table.geometry}
            selection={interaction.selection}
            drag={interaction.drag}
            shaking={interaction.shaking}
            tableRef={tableRef}
            handlers={interaction.handlers}
          />
        )}
      </div>
    </div>
  );
}
