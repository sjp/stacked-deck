import { memo, useLayoutEffect, useRef } from "react";
import type {
  CSSProperties,
  FocusEventHandler,
  KeyboardEventHandler,
  MouseEventHandler,
  PointerEventHandler,
  RefObject,
} from "react";
import type { Card } from "../engine/cards.ts";
import type { PileNouns } from "../engine/describe.ts";
import { cardLabel, pileLabel, pileName } from "../engine/describe.ts";
import type { GameState, PileId } from "../engine/types.ts";
import type { TableLayout } from "../engine/variant.ts";
import { CardView } from "./CardView.tsx";
import type { TableGeometry } from "./geometry.ts";
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

/** What the table remembers about each card between renders, to animate its moves. */
interface Track {
  /** Where the card was placed last render. */
  readonly at: Point;
  readonly dragging: boolean;
  /** The slide in progress, if any. */
  readonly motion?: {
    readonly from: Point;
    readonly start: number;
    readonly ms: number;
    readonly animation: Animation;
  };
}

/** Where a sliding card is now, following the ease-out curve closely enough. */
function currentPosition(track: Track, now: number): Point {
  const motion = track.motion;
  if (motion === undefined || now >= motion.start + motion.ms) {
    return track.at;
  }
  const t = Math.max(0, (now - motion.start) / motion.ms);
  const eased = 1 - (1 - t) ** 2;
  return {
    x: motion.from.x + (track.at.x - motion.from.x) * eased,
    y: motion.from.y + (track.at.y - motion.from.y) * eased,
  };
}

/** A CSS length or time as a number of its unit ("12px" → 12), or 0. */
function cssNumber(text: string, unit: string): number {
  const value = Number(text.trim().slice(0, -unit.length));
  return text.trim().endsWith(unit) && Number.isFinite(value) ? value : 0;
}

/** The drag offset is set on each dragged card and is still there while the drop commits. */
function dragOffset(element: HTMLElement): Point {
  return {
    x: cssNumber(element.style.getPropertyValue("--drag-x"), "px"),
    y: cssNumber(element.style.getPropertyValue("--drag-y"), "px"),
  };
}

const translate = ({ x, y }: Point) => `translate(${x}px, ${y}px)`;

function stopMotion(element: HTMLElement | undefined, track: Track | undefined): void {
  track?.motion?.animation.cancel();
  if (element !== undefined) {
    delete element.dataset["moving"];
  }
}

/**
 * Slides cards that changed place, all in one pass after each render: nothing is read
 * from the page between the animations it starts, so moving 104 cards costs no more
 * layout than moving one. A card starts from where it is on screen: where it was let go
 * after a drag, or part way along a slide still running. Resizes don't animate.
 */
function useCardMotion(
  tableRef: RefObject<HTMLElement | null>,
  geometry: TableGeometry,
  drag: DragView | undefined,
): void {
  const tracks = useRef(new Map<number, Track>());
  const lastFrame = useRef<string | undefined>(undefined);

  useLayoutEffect(() => {
    const table = tableRef.current;
    if (table === null) {
      return;
    }
    // Pile bases move only when the table's size or shape changes.
    const bases = [...geometry.bases.values()].map((base) => `${base.x},${base.y}`);
    const frame = [geometry.cardWidth, ...bases].join(";");
    const resized = lastFrame.current !== undefined && lastFrame.current !== frame;
    lastFrame.current = frame;
    // --move-ms is 0 with reduced motion. One read, before any animation starts.
    const ms = resized ? 0 : cssNumber(getComputedStyle(table).getPropertyValue("--move-ms"), "ms");
    const elements = new Map<number, HTMLElement>();
    for (const element of table.querySelectorAll<HTMLElement>(".card-slot")) {
      elements.set(Number(element.dataset["card"]), element);
    }
    const now = performance.now();
    const next = new Map<number, Track>();
    for (const placement of geometry.cards) {
      const id = placement.card.id;
      const element = elements.get(id);
      const track = tracks.current.get(id);
      const at = { x: placement.x, y: placement.y };
      const dragging = inRun(drag, placement.pile, placement.index);
      if (element === undefined || track === undefined || dragging) {
        stopMotion(element, track);
        next.set(id, { at, dragging });
        continue;
      }
      const from = track.dragging
        ? { x: track.at.x + dragOffset(element).x, y: track.at.y + dragOffset(element).y }
        : currentPosition(track, now);
      if ((from.x === at.x && from.y === at.y) || ms === 0) {
        stopMotion(element, track);
        next.set(id, { at, dragging });
        continue;
      }
      track.motion?.animation.cancel();
      // Lifted above resting cards while it slides. An attribute, not a class, so a
      // re-render that changes the class list doesn't drop it.
      element.dataset["moving"] = "";
      const animation = element.animate(
        [{ transform: translate(from) }, { transform: translate(at) }],
        {
          duration: ms,
          easing: "ease-out",
        },
      );
      animation.addEventListener("finish", () => {
        delete element.dataset["moving"];
      });
      next.set(id, { at, dragging, motion: { from, start: now, ms, animation } });
    }
    tracks.current = next;
  }, [tableRef, geometry, drag]);
}

interface CardSlotProps {
  readonly card: Card;
  readonly pile: PileId;
  readonly index: number;
  readonly x: number;
  readonly y: number;
  readonly z: number;
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

/** One card. Its props are all plain values, so only cards that change re-render. */
const CardSlot = memo(function CardSlot({
  card,
  pile,
  index,
  x,
  y,
  z,
  label,
  focusable,
  compact,
  selected,
  dragging,
  target,
  hinted,
  shaking,
}: CardSlotProps) {
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
      type="button"
      className={className}
      style={style}
      tabIndex={focusable ? 0 : -1}
      aria-label={label}
      aria-pressed={selected}
      data-pile={pile}
      data-index={index}
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
  /** The variant's own names for piles, for screen readers. */
  readonly pileNouns?: PileNouns | undefined;
  readonly handlers: {
    readonly onPointerDown: PointerEventHandler<HTMLElement>;
    readonly onPointerMove: PointerEventHandler<HTMLElement>;
    readonly onPointerUp: PointerEventHandler<HTMLElement>;
    readonly onPointerCancel: PointerEventHandler<HTMLElement>;
    readonly onLostPointerCapture: PointerEventHandler<HTMLElement>;
    readonly onContextMenu: MouseEventHandler<HTMLElement>;
    readonly onKeyDown?: KeyboardEventHandler<HTMLElement>;
    readonly onClick?: MouseEventHandler<HTMLElement>;
    readonly onFocus?: FocusEventHandler<HTMLElement>;
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
  pileNouns,
  handlers,
}: TableProps) {
  useCardMotion(tableRef, geometry, drag);
  const topIndex = new Map(state.piles.map((pile) => [pile.id, pile.cards.length - 1]));
  const names = new Map(state.piles.map((pile) => [pile.id, pileName(state, pile.id, pileNouns)]));
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
            aria-label={pileLabel(state, pileLayout.id, pileNouns)}
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
            card={card}
            pile={pile}
            index={index}
            x={placement.x}
            y={placement.y}
            z={placement.z}
            label={`${cardLabel(card)}, ${names.get(pile) ?? ""}`}
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
