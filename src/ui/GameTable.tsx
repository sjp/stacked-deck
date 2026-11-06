import { useRef } from "react";
import type { GameState, Move } from "../engine/types.ts";
import type { Variant } from "../engine/variant.ts";
import type { Highlight } from "./Table.tsx";
import { Table } from "./Table.tsx";
import { useElementSize } from "./useElementSize.ts";
import { useGeometry } from "./useGeometry.ts";
import { useTableInteraction } from "./useTableInteraction.ts";

interface Props {
  readonly variant: Variant;
  readonly state: GameState;
  readonly leftHanded: boolean;
  readonly smartTap: boolean;
  /** Plays a move; returns false if it was rejected. */
  readonly onPlay: (move: Move) => boolean;
  readonly highlight?: Highlight | undefined;
  readonly disabled?: boolean;
}

/** The play area: measures itself, lays out the table and handles pointer input. */
export function GameTable({
  variant,
  state,
  leftHanded,
  smartTap,
  onPlay,
  highlight,
  disabled = false,
}: Props) {
  const areaRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  const size = useElementSize(areaRef);
  const table = useGeometry(variant, state, size, leftHanded);
  const interaction = useTableInteraction({
    variant,
    state,
    geometry: table?.geometry,
    smartTap,
    tableRef,
    onPlay,
    disabled,
  });

  return (
    <div className="table-area" ref={areaRef}>
      {table === undefined ? undefined : (
        <Table
          state={state}
          layout={table.layout}
          geometry={table.geometry}
          selection={interaction.selection}
          drag={interaction.drag}
          shaking={interaction.shaking}
          {...(highlight === undefined ? {} : { highlight })}
          tableRef={tableRef}
          handlers={interaction.handlers}
        />
      )}
      <output className="table-message" aria-live="polite">
        {interaction.message}
      </output>
    </div>
  );
}
