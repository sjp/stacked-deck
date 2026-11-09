// @vitest-environment happy-dom
import { act, fireEvent, render } from "@testing-library/react";
import { useRef } from "react";
import { describe, expect, it } from "vitest";
import { makeState } from "../engine/testing.ts";
import { klondike } from "../engine/variants/klondike/klondike.ts";
import type { DragView } from "./useTableInteraction.ts";
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

function Harness() {
  const tableRef = useRef<HTMLElement>(null);
  const interaction = useTableInteraction({
    variant: klondike,
    state: STATE,
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
    >
      <button type="button" className="card-slot" data-pile="t0" data-index={0} data-card={1}>
        8H
      </button>
    </section>
  );
}

function dragText(drag: DragView | undefined): string {
  return drag === undefined ? "none" : `${drag.pile}:${drag.index}`;
}

function press(pointerId: number, x: number) {
  return { pointerId, clientX: x, clientY: 0, button: 0, pointerType: "mouse" };
}

describe("table pointer handling", () => {
  it("keeps a drag going when a different pointer is cancelled", () => {
    const { getByText, getByTestId } = render(<Harness />);
    const card = getByText("8H");
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
});
