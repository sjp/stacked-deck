// @vitest-environment happy-dom
import { render } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeState } from "../engine/testing.ts";
import type { GameState } from "../engine/types.ts";
import { klondike } from "../engine/variants/klondike/klondike.ts";
import { computeGeometry } from "./geometry.ts";
import { Table } from "./Table.tsx";
import type { DragView } from "./useTableInteraction.ts";

const SIZE = { width: 700, height: 500 };
const HANDLERS = {
  onPointerDown: () => {},
  onPointerMove: () => {},
  onPointerUp: () => {},
  onPointerCancel: () => {},
  onLostPointerCapture: () => {},
  onContextMenu: () => {},
};

function table(t0: string, t1: string): GameState {
  return makeState(
    "klondike",
    [
      { id: "stock", kind: "stock" },
      { id: "waste", kind: "waste" },
      ...[0, 1, 2, 3].map((i) => ({ id: `f${i}`, kind: "foundation" as const })),
      { id: "t0", kind: "tableau", cards: t0 },
      { id: "t1", kind: "tableau", cards: t1 },
      ...[2, 3, 4, 5, 6].map((i) => ({ id: `t${i}`, kind: "tableau" as const })),
    ],
    { draw: 1 },
  );
}

function view(state: GameState, drag: DragView | undefined) {
  const layout = klondike.layout(state, { landscape: false, leftHanded: false });
  const geometry = computeGeometry(state, layout, SIZE);
  return (
    <Table
      state={state}
      layout={layout}
      geometry={geometry}
      selection={undefined}
      drag={drag}
      shaking={undefined}
      tableRef={createRef<HTMLElement>()}
      handlers={HANDLERS}
    />
  );
}

/** happy-dom doesn't inherit custom properties, so set the speed on the table itself. */
function setMoveMs(container: HTMLElement): void {
  container.querySelector("section")?.style.setProperty("--move-ms", "180ms");
}

/** Each animation started: the element's card id and its first and last transforms. */
let started: { card: string | undefined; from: unknown; to: unknown }[];

beforeEach(() => {
  started = [];
  vi.spyOn(HTMLElement.prototype, "animate").mockImplementation(function animate(
    this: HTMLElement,
    keyframes,
  ) {
    const frames = Array.isArray(keyframes) ? keyframes : [];
    started.push({
      card: this.dataset["card"],
      from: frames[0]?.["transform"],
      to: frames.at(-1)?.["transform"],
    });
    return new Animation();
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("card motion", () => {
  it("slides a dropped card on from where it was let go", () => {
    const state = table("9S", "");
    const drag = { pile: "t0", index: 0, targets: new Map() };
    const { rerender, container } = render(view(state, drag));
    setMoveMs(container);
    const card = container.querySelector<HTMLElement>('.card-slot[data-pile="t0"]')!;
    const at = card.style.transform;
    card.style.setProperty("--drag-x", "40px");
    card.style.setProperty("--drag-y", "25px");
    rerender(view(state, undefined));
    expect(started).toHaveLength(1);
    const [x = 0, y = 0] = [...at.matchAll(/-?[\d.]+/gu)].map((match) => Number(match[0]));
    expect(started[0]?.from).toBe(`translate(${x + 40}px, ${y + 25}px)`);
    expect(started[0]?.to).toBe(at);
  });

  it("slides the cards a drop leaves behind back from where they were let go", () => {
    const before = table("10H 9S", "10D");
    const drag = { pile: "t0", index: 0, targets: new Map() };
    const { rerender, container } = render(view(before, drag));
    setMoveMs(container);
    const [left, moved] = container.querySelectorAll<HTMLElement>('.card-slot[data-pile="t0"]');
    const at = left!.style.transform;
    for (const card of [left!, moved!]) {
      card.style.setProperty("--drag-x", "40px");
      card.style.setProperty("--drag-y", "25px");
    }
    // Only the 9 fits on the other 10.
    const after = klondike.applyMove(before, { kind: "move", from: "t0", index: 1, to: "t1" });
    rerender(view(after, undefined));
    const [x = 0, y = 0] = [...at.matchAll(/-?[\d.]+/gu)].map((match) => Number(match[0]));
    const back = started.find((entry) => entry.card === left!.dataset["card"]);
    expect(back?.from).toBe(`translate(${x + 40}px, ${y + 25}px)`);
    expect(back?.to).toBe(at);
    expect(started.map((entry) => entry.card)).toContain(moved!.dataset["card"]);
  });

  it("lifts a moving card and drops the lift when a drag interrupts it", () => {
    const before = table("9S", "");
    const { rerender, container } = render(view(before, undefined));
    setMoveMs(container);
    const id = container.querySelector<HTMLElement>('.card-slot[data-pile="t0"]')!.dataset["card"];
    // Ids start afresh for each table, so this is the same card, now on t1.
    const withCard = table("", "9S");
    rerender(view(withCard, undefined));
    const card = container.querySelector<HTMLElement>(`[data-card="${id}"]`)!;
    expect(started.map((entry) => entry.card)).toEqual([id]);
    expect(card.dataset["moving"]).toBe("");
    rerender(view(withCard, { pile: "t1", index: 0, targets: new Map() }));
    expect(card.dataset["moving"]).toBeUndefined();
  });
});
