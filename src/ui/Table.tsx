import { memo, useLayoutEffect, useRef } from "react";
import type { CSSProperties, KeyboardEventHandler, PointerEventHandler, RefObject } from "react";
import type { Card } from "../engine/cards.ts";
import { cardLabel, pileLabel, pileName } from "../engine/describe.ts";
import type { GameState, PileId } from "../engine/types.ts";
import type { TableLayout } from "../engine/variant.ts";
import { CardView } from "./CardView.tsx";
import type { CardPlacement, TableGeometry } from "./geometry.ts";
import type { CardRef, DragView } from "./useTableInteraction.ts";

export interface Highlight {
  readonly from?: CardRef;
  readonly to?: PileId;
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

/** Raised above other cards while it travels, so a moving card never slides underneath. */
const LIFT_Z = 5000;

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
  const previous = useRef<{ x: number; y: number } | undefined>(undefined);
  const { x, y, z, card } = placement;

  useLayoutEffect(() => {
    const element = ref.current;
    const last = previous.current;
    previous.current = { x, y };
    if (element === null || last === undefined || (last.x === x && last.y === y) || dragging) {
      return undefined;
    }
    element.classList.add("moving");
    const done = () => {
      element.classList.remove("moving");
    };
    element.addEventListener("transitionend", done, { once: true });
    const timer = setTimeout(done, 1000);
    return () => {
      clearTimeout(timer);
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
    </section>
  );
}
