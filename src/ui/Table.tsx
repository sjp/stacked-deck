import { memo, useLayoutEffect, useRef } from "react";
import type { CSSProperties, KeyboardEventHandler, PointerEventHandler, RefObject } from "react";
import type { Card } from "../engine/cards.ts";
import { cardLabel, pileLabel, pileName } from "../engine/describe.ts";
import type { GameState, PileId } from "../engine/types.ts";
import type { TableLayout } from "../engine/variant.ts";
import { CardView } from "./CardView.tsx";
import type { CardPlacement, TableGeometry } from "./geometry.ts";
import { LIFT_Z } from "./geometry.ts";
import type { CardRef, DragView } from "./useTableInteraction.ts";

export interface Highlight {
  readonly from?: CardRef;
  readonly to?: PileId;
}

interface Point {
  readonly x: number;
  readonly y: number;
}

/** A slide in progress, so a move that interrupts it can start from where the card is. */
interface Motion {
  readonly from: Point;
  readonly to: Point;
  readonly start: number;
  readonly ms: number;
}

/** Where a sliding card is now, following the CSS ease-out curve closely enough. */
function currentPosition(motion: Motion | undefined, now: number, fallback: Point): Point {
  if (motion === undefined || now >= motion.start + motion.ms) {
    return fallback;
  }
  const t = Math.max(0, (now - motion.start) / motion.ms);
  const eased = 1 - (1 - t) ** 2;
  return {
    x: motion.from.x + (motion.to.x - motion.from.x) * eased,
    y: motion.from.y + (motion.to.y - motion.from.y) * eased,
  };
}

/** A CSS length or time as a number of its unit ("12px" → 12, "0.18s" → 0.18), or 0. */
function cssNumber(text: string, unit: string): number {
  const value = Number(text.trim().slice(0, -unit.length));
  return text.trim().endsWith(unit) && Number.isFinite(value) ? value : 0;
}

/** The drag offset is still set on the table while the drop commits. */
function withDragOffset(element: Element, point: Point): Point {
  const style = getComputedStyle(element);
  return {
    x: point.x + cssNumber(style.getPropertyValue("--drag-x"), "px"),
    y: point.y + cssNumber(style.getPropertyValue("--drag-y"), "px"),
  };
}

function durationMs(element: Element): number {
  const text = getComputedStyle(element).transitionDuration.split(",")[0] ?? "";
  return text.trim().endsWith("ms") ? cssNumber(text, "ms") : cssNumber(text, "s") * 1000;
}

interface CardSlotProps {
  readonly placement: CardPlacement;
  readonly label: string;
  /** The keyboard cursor is here, so this card takes part in tab order. */
  readonly focusable: boolean;
  readonly compact: boolean;
  readonly selected: boolean;
  readonly dragging: boolean;
  readonly target: boolean;
  readonly hinted: boolean;
  readonly shaking: boolean;
}

const CardSlot = memo(function CardSlot({
  placement,
  label,
  focusable,
  compact,
  selected,
  dragging,
  target,
  hinted,
  shaking,
}: CardSlotProps) {
  const ref = useRef<HTMLButtonElement>(null);
  const previous = useRef<Point | undefined>(undefined);
  const motion = useRef<Motion | undefined>(undefined);
  const wasDragging = useRef(dragging);
  const { x, y, z, card } = placement;

  useLayoutEffect(() => {
    const element = ref.current;
    const last = previous.current;
    previous.current = { x, y };
    const dropped = wasDragging.current && !dragging;
    wasDragging.current = dragging;
    if (element === null || last === undefined || dragging) {
      return undefined;
    }
    // Start where the card is on screen: where it was let go after a drag, or part way
    // along a move that is still running.
    const now = performance.now();
    const from = dropped
      ? withDragOffset(element, last)
      : currentPosition(motion.current, now, last);
    const ms = durationMs(element);
    if ((from.x === x && from.y === y) || ms === 0) {
      // With no transition (reduced motion) the move is instant: no slide, no lift.
      motion.current = undefined;
      return undefined;
    }
    // Set the start explicitly: React moves the node when a card changes places in the
    // list (onto a later pile), and a moved node would otherwise jump.
    element.style.transition = "none";
    element.style.transform = `translate(${from.x}px, ${from.y}px)`;
    element.getBoundingClientRect();
    element.style.transition = "";
    element.style.transform = `translate(${x}px, ${y}px)`;
    element.classList.add("moving");
    motion.current = { from, to: { x, y }, start: now, ms };
    const done = () => {
      element.classList.remove("moving");
      element.removeEventListener("transitionend", onEnd);
    };
    const onEnd = (event: TransitionEvent) => {
      if (event.target === element && event.propertyName === "transform") {
        done();
      }
    };
    element.addEventListener("transitionend", onEnd);
    const timer = setTimeout(done, ms + 500);
    return () => {
      clearTimeout(timer);
      // Drop the lift; a move that starts straight away adds it back before painting.
      done();
    };
  }, [x, y, dragging]);

  const className = [
    "card-slot",
    selected && "selected",
    dragging && "dragging",
    target && "target",
    hinted && "hinted",
    shaking && "shake",
  ]
    .filter(Boolean)
    .join(" ");
  const style: CSSProperties = {
    transform: `translate(${x}px, ${y}px)`,
    zIndex: dragging ? LIFT_Z * 2 + z : z,
  };
  return (
    <button
      ref={ref}
      type="button"
      className={className}
      style={style}
      tabIndex={focusable ? 0 : -1}
      aria-label={label}
      aria-pressed={selected}
      data-pile={placement.pile}
      data-index={placement.index}
      data-card={card.id}
    >
      <CardView card={card} compact={compact} />
    </button>
  );
});

interface TableProps {
  readonly state: GameState;
  readonly layout: TableLayout;
  readonly geometry: TableGeometry;
  readonly selection: CardRef | undefined;
  readonly drag: DragView | undefined;
  readonly shaking: CardRef | undefined;
  readonly highlight?: Highlight;
  readonly cursor?: CardRef | undefined;
  readonly tableRef: RefObject<HTMLElement | null>;
  readonly handlers: {
    readonly onPointerDown: PointerEventHandler<HTMLElement>;
    readonly onPointerMove: PointerEventHandler<HTMLElement>;
    readonly onPointerUp: PointerEventHandler<HTMLElement>;
    readonly onPointerCancel: PointerEventHandler<HTMLElement>;
    readonly onLostPointerCapture: PointerEventHandler<HTMLElement>;
    readonly onKeyDown?: KeyboardEventHandler<HTMLElement>;
  };
}

function inRun(ref: CardRef | undefined, pile: PileId, index: number): boolean {
  return ref?.pile === pile && index >= ref.index && ref.index >= 0;
}

/**
 * The keyboard focus ring, drawn as its own layer over the cursor's card. Raising the
 * focused card instead would hide the corners of the cards fanned over it, just when the
 * player is choosing where a run starts. CSS shows it only while a table button has
 * keyboard focus.
 */
function FocusRing({
  cursor,
  geometry,
}: {
  readonly cursor: CardRef | undefined;
  readonly geometry: TableGeometry;
}) {
  if (cursor === undefined) {
    return undefined;
  }
  const at =
    cursor.index < 0
      ? geometry.bases.get(cursor.pile)
      : geometry.cards.find(
          (placement) => placement.pile === cursor.pile && placement.index === cursor.index,
        );
  if (at === undefined) {
    return undefined;
  }
  return (
    <div
      className="focus-ring"
      aria-hidden="true"
      style={{ transform: `translate(${at.x}px, ${at.y}px)` }}
    />
  );
}

/** A translucent copy of the hinted card that glides to its destination. */
function HintGhost({
  highlight,
  layout,
  geometry,
}: {
  readonly highlight: Highlight | undefined;
  readonly layout: TableLayout;
  readonly geometry: TableGeometry;
}) {
  const from = highlight?.from;
  const to = highlight?.to;
  if (from === undefined || to === undefined) {
    return undefined;
  }
  const source = geometry.cards.find(
    (placement) => placement.pile === from.pile && placement.index === from.index,
  );
  const top = geometry.cards.findLast((placement) => placement.pile === to);
  const base = geometry.bases.get(to);
  if (source === undefined || base === undefined) {
    return undefined;
  }
  const fan = layout.piles.find((pile) => pile.id === to)?.fan;
  const endX = top?.x ?? base.x;
  const endY =
    (top?.y ?? base.y) + (top !== undefined && fan === "down" ? geometry.cardHeight * 0.25 : 0);
  const style: CSSProperties = {
    "--gx0": `${source.x}px`,
    "--gy0": `${source.y}px`,
    "--gx1": `${endX}px`,
    "--gy1": `${endY}px`,
  };
  return (
    <div
      key={`${from.pile}:${from.index}:${to}`}
      className="hint-ghost"
      style={style}
      aria-hidden="true"
    >
      <CardView card={source.card} compact={geometry.compact} />
    </div>
  );
}

export function Table({
  state,
  layout,
  geometry,
  selection,
  drag,
  shaking,
  highlight,
  cursor,
  tableRef,
  handlers,
}: TableProps) {
  const topIndex = new Map(state.piles.map((pile) => [pile.id, pile.cards.length - 1]));
  const kinds = new Map(state.piles.map((pile) => [pile.id, pile.kind]));
  const style: CSSProperties = {
    "--card-w": `${geometry.cardWidth}px`,
    "--card-h": `${geometry.cardHeight}px`,
  };

  return (
    <section
      ref={tableRef}
      aria-label="Card table"
      className={drag === undefined ? "table" : "table is-dragging"}
      style={style}
      {...handlers}
    >
      {layout.piles.map((pileLayout) => {
        const base = geometry.bases.get(pileLayout.id);
        if (base === undefined) {
          return undefined;
        }
        const isTarget =
          drag?.targets.has(pileLayout.id) === true || highlight?.to === pileLayout.id;
        return (
          <button
            type="button"
            key={pileLayout.id}
            className={[
              "pile-base",
              isTarget && "target",
              highlight?.from?.pile === pileLayout.id && highlight.from.index < 0 && "hinted",
            ]
              .filter(Boolean)
              .join(" ")}
            style={{ transform: `translate(${base.x}px, ${base.y}px)` }}
            tabIndex={cursor?.pile === pileLayout.id && cursor.index === -1 ? 0 : -1}
            aria-label={pileLabel(state, pileLayout.id)}
            data-pile={pileLayout.id}
            data-index={-1}
            data-kind={kinds.get(pileLayout.id)}
          >
            {pileLayout.emptyLabel === undefined ? undefined : (
              <span className="pile-label">{pileLayout.emptyLabel}</span>
            )}
          </button>
        );
      })}
      {geometry.cards.map((placement) => {
        const { pile, index } = placement;
        const top = topIndex.get(pile) === index;
        const card: Card = placement.card;
        return (
          <CardSlot
            key={card.id}
            placement={placement}
            label={`${cardLabel(card)}, ${pileName(state, pile)}`}
            focusable={cursor?.pile === pile && cursor.index === index}
            compact={geometry.compact}
            selected={inRun(selection, pile, index)}
            dragging={inRun(drag, pile, index)}
            target={top && (drag?.targets.has(pile) === true || highlight?.to === pile)}
            hinted={inRun(highlight?.from, pile, index)}
            shaking={inRun(shaking, pile, index)}
          />
        );
      })}
      <HintGhost highlight={highlight} layout={layout} geometry={geometry} />
      <FocusRing cursor={cursor} geometry={geometry} />
    </section>
  );
}
