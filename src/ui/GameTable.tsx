import { useCallback, useEffect, useRef, useState } from "react";
import type { FocusEvent, KeyboardEvent, MouseEvent } from "react";
import { emitFeedback } from "./feedback.ts";
import { describeMove } from "../engine/describe.ts";
import type { GameState, Move } from "../engine/types.ts";
import type { Variant } from "../engine/variant.ts";
import type { Direction } from "./keyboardNav.ts";
import { firstCursor, moveCursor, settleCursor } from "./keyboardNav.ts";
import type { Highlight } from "./Table.tsx";
import { Table } from "./Table.tsx";
import { useElementSize } from "./useElementSize.ts";
import { useGeometry } from "./useGeometry.ts";
import type { CardRef } from "./useTableInteraction.ts";
import { cardRefFromElement, useTableInteraction } from "./useTableInteraction.ts";

const ARROWS: Readonly<Record<string, Direction>> = {
  ArrowLeft: "left",
  ArrowRight: "right",
  ArrowUp: "up",
  ArrowDown: "down",
};

interface Props {
  readonly variant: Variant;
  readonly state: GameState;
  readonly leftHanded: boolean;
  readonly smartTap: boolean;
  /** Plays a move; returns false if it was rejected. */
  readonly onPlay: (move: Move) => boolean;
  readonly highlight?: Highlight | undefined;
  /** A new deal is on its way: input is ignored and a notice appears after a moment. */
  readonly dealing?: boolean;
}

/**
 * The play area: measures itself, lays out the table and handles pointer and keyboard
 * input. Moves are announced to screen readers.
 */
export function GameTable({
  variant,
  state,
  leftHanded,
  smartTap,
  onPlay,
  highlight,
  dealing = false,
}: Props) {
  const areaRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLElement>(null);
  const size = useElementSize(areaRef);
  const table = useGeometry(variant, state, size, leftHanded);
  const [announcement, setAnnouncement] = useState({ text: "", count: 0 });
  const announce = useCallback((text: string) => {
    setAnnouncement((previous) => ({ text, count: previous.count + 1 }));
  }, []);

  const play = useCallback(
    (move: Move) => {
      const text = describeMove(state, move, variant.pileNouns);
      const ok = onPlay(move);
      if (ok) {
        announce(text);
      }
      return ok;
    },
    [announce, onPlay, state, variant.pileNouns],
  );

  const interaction = useTableInteraction({
    variant,
    state,
    geometry: table?.geometry,
    smartTap,
    tableRef,
    onPlay: play,
    onInvalid: () => {
      announce("That move isn't allowed");
    },
    disabled: dealing,
  });

  // A whole run going up at once (Spider) gets its own sound.
  const foundationCards = state.piles
    .filter((pile) => pile.kind === "foundation")
    .reduce((sum, pile) => sum + pile.cards.length, 0);
  const previousFoundation = useRef(foundationCards);
  useEffect(() => {
    if (foundationCards - previousFoundation.current >= 13) {
      emitFeedback("complete");
    }
    previousFoundation.current = foundationCards;
  }, [foundationCards]);

  const [rawCursor, setCursor] = useState<CardRef>();
  const cursor =
    table === undefined
      ? undefined
      : settleCursor(state, table.layout, rawCursor ?? firstCursor(state, table.layout));

  // Keep keyboard focus on the cursor while the table has focus. Compared by value: the
  // default cursor is a new object on every render.
  const cursorPile = cursor?.pile;
  const cursorIndex = cursor?.index;
  useEffect(() => {
    const element = tableRef.current;
    if (element === null || cursorPile === undefined) {
      return;
    }
    const target = element.querySelector<HTMLElement>(
      `[data-pile="${cursorPile}"][data-index="${cursorIndex}"]`,
    );
    if (element.contains(document.activeElement) && document.activeElement !== target) {
      // Scrolling the table would throw off drag hit-testing.
      target?.focus({ preventScroll: true });
    }
  }, [cursorPile, cursorIndex]);

  // Focus that lands on a card another way (a click, a screen reader) moves the cursor.
  const onFocus = (event: FocusEvent<HTMLElement>) => {
    const ref = cardRefFromElement(event.target);
    if (ref !== undefined && (ref.pile !== cursorPile || ref.index !== cursorIndex)) {
      setCursor(ref);
    }
  };

  // Enter and Space reach here as native button clicks, as do screen readers' activations;
  // neither has a pointer press before it (detail 0). Pointer taps are handled on pointerup.
  const onClick = (event: MouseEvent<HTMLElement>) => {
    const ref = cardRefFromElement(event.target);
    if (event.detail !== 0 || ref === undefined || dealing) {
      return;
    }
    setCursor(ref);
    interaction.activate(ref, false);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (table === undefined || cursor === undefined || dealing) {
      return;
    }
    // Leave browser shortcuts (Ctrl+F, Cmd+D, Alt+arrows) alone.
    if (event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }
    const direction = ARROWS[event.key];
    const key = event.key.toLowerCase();
    if (direction !== undefined) {
      setCursor(moveCursor(state, table.layout, cursor, direction));
    } else if (key === "escape") {
      interaction.clearSelection();
    } else if (key === "f") {
      interaction.toFoundation(cursor);
    } else if (key === "d") {
      const stock = state.piles.find((pile) => pile.kind === "stock");
      if (stock !== undefined) {
        interaction.activate({ pile: stock.id, index: stock.cards.length - 1 }, false);
      }
    } else {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
  };

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
          cursor={cursor}
          tableRef={tableRef}
          pileNouns={variant.pileNouns}
          handlers={{ ...interaction.handlers, onKeyDown, onClick, onFocus }}
        />
      )}
      {dealing ? (
        <output className="dealing">
          <span>Finding a winnable deal…</span>
        </output>
      ) : undefined}
      <output className="table-message" aria-live="polite">
        {interaction.message}
      </output>
      <div className="sr-only" aria-live="polite">
        {announcement.text}
        {announcement.count % 2 === 0 ? "" : "​"}
      </div>
    </div>
  );
}
