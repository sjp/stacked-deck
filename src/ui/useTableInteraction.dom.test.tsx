// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { makeState } from "../engine/testing.ts";
import type { GameState } from "../engine/types.ts";
import { freecell } from "../engine/variants/freecell/freecell.ts";
import { klondike } from "../engine/variants/klondike/klondike.ts";
import type { CardRef } from "./useTableInteraction.ts";
import { useTableInteraction } from "./useTableInteraction.ts";

const STATE = makeState(
  "klondike",
  [
    { id: "stock", kind: "stock", cards: "-4C" },
    { id: "t0", kind: "tableau", cards: "8H" },
    { id: "t1", kind: "tableau", cards: "9S" },
  ],
  { draw: 1 },
);

/** A FreeCell column with a two-card run under a card that can't be picked up. */
const COLUMN = makeState("freecell", [
  { id: "c0", kind: "cell" },
  { id: "t0", kind: "tableau", cards: "2C 9S 8H" },
  { id: "t1", kind: "tableau", cards: "10D" },
]);

function Harness({ state = STATE }: { state?: GameState }) {
  const tableRef = useRef<HTMLElement>(null);
  const interaction = useTableInteraction({
    variant: state === STATE ? klondike : freecell,
    state,
    geometry: undefined,
    smartTap: false,
    tableRef,
    onPlay: () => true,
  });
  return (
    <section
      ref={tableRef}
      {...interaction.handlers}
      data-testid="table"
      data-drag={dragText(interaction.drag)}
      data-shaking={dragText(interaction.shaking)}
      data-selection={dragText(interaction.selection)}
    >
      {state.piles.flatMap((pile) =>
        pile.cards.map((card, index) => (
          <button
            key={card.id}
            type="button"
            className="card-slot"
            data-pile={pile.id}
            data-index={index}
            data-card={card.id}
          >
            {`${pile.id}:${index}`}
          </button>
        )),
      )}
    </section>
  );
}

function dragText(ref: CardRef | undefined): string {
  return ref === undefined ? "none" : `${ref.pile}:${ref.index}`;
}

function press(pointerId: number, x: number) {
  return { pointerId, clientX: x, clientY: 0, button: 0, pointerType: "mouse" };
}

describe("table pointer handling", () => {
  afterEach(cleanup);

  it("keeps a drag going when a different pointer is cancelled", () => {
    const { getByText, getByTestId } = render(<Harness />);
    const card = getByText("t0:0");
    const drag = () => getByTestId("table").dataset["drag"];
    act(() => {
      fireEvent.pointerDown(card, press(1, 0));
      fireEvent.pointerMove(card, press(1, 30));
    });
    expect(drag()).toBe("t0:0");
    act(() => {
      fireEvent.pointerCancel(card, press(2, 30));
    });
    expect(drag()).toBe("t0:0");
    act(() => {
      fireEvent.pointerCancel(card, press(1, 30));
    });
    expect(drag()).toBe("none");
  });

  it("starts a drag on a card above the movable run from the run's base", () => {
    const { getByText, getByTestId } = render(<Harness state={COLUMN} />);
    const card = getByText("t0:0");
    act(() => {
      fireEvent.pointerDown(card, press(1, 0));
      fireEvent.pointerMove(card, press(1, 30));
    });
    const table = getByTestId("table");
    expect(table.dataset["drag"]).toBe("t0:1");
    expect(table.querySelectorAll(".card-slot[style]")).toHaveLength(2);
  });

  it("starts a drag on a face-down card from the face-up run below it", () => {
    const state = makeState("klondike", [
      { id: "t0", kind: "tableau", cards: "-5C 8H" },
      { id: "t1", kind: "tableau", cards: "9S" },
    ]);
    const { getByText, getByTestId } = render(<Harness state={state} />);
    const card = getByText("t0:0");
    act(() => {
      fireEvent.pointerDown(card, press(1, 0));
      fireEvent.pointerMove(card, press(1, 30));
    });
    expect(getByTestId("table").dataset["drag"]).toBe("t0:1");
  });

  it("still refuses a tap on a card that can't be picked up", () => {
    const { getByText, getByTestId } = render(<Harness state={COLUMN} />);
    const card = getByText("t0:0");
    act(() => {
      fireEvent.pointerDown(card, press(1, 0));
      fireEvent.pointerUp(card, press(1, 0));
    });
    const table = getByTestId("table");
    expect(table.dataset["shaking"]).toBe("t0:0");
    expect(table.dataset["selection"]).toBe("none");
    expect(table.dataset["drag"]).toBe("none");
  });
});
