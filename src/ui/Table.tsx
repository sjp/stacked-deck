import { memo, useLayoutEffect, useRef } from "react";
import type { CSSProperties, PointerEventHandler, RefObject } from "react";
import type { Card } from "../engine/cards.ts";
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
  compact,
  selected,
  dragging,
  target,
  hinted,
  shaking,
}: CardSlotProps) {
  const ref = useRef<HTMLDivElement>(null);
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
    <div
      ref={ref}
      className={className}
      style={style}
      data-pile={placement.pile}
      data-index={placement.index}
      data-card={card.id}
    >
      <CardView card={card} compact={compact} />
    </div>
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
  readonly tableRef: RefObject<HTMLDivElement | null>;
  readonly handlers: {
    readonly onPointerDown: PointerEventHandler<HTMLElement>;
    readonly onPointerMove: PointerEventHandler<HTMLElement>;
    readonly onPointerUp: PointerEventHandler<HTMLElement>;
    readonly onPointerCancel: PointerEventHandler<HTMLElement>;
    readonly onLostPointerCapture: PointerEventHandler<HTMLElement>;
  };
}

function inRun(ref: CardRef | undefined, pile: PileId, index: number): boolean {
  return ref?.pile === pile && index >= ref.index && ref.index >= 0;
}

export function Table({
  state,
  layout,
  geometry,
  selection,
  drag,
  shaking,
  highlight,
  tableRef,
  handlers,
}: TableProps) {
  const topIndex = new Map(state.piles.map((pile) => [pile.id, pile.cards.length - 1]));
  const style: CSSProperties = {
    "--card-w": `${geometry.cardWidth}px`,
    "--card-h": `${geometry.cardHeight}px`,
  };

  return (
    <div
      ref={tableRef}
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
          <div
            key={pileLayout.id}
            className={isTarget ? "pile-base target" : "pile-base"}
            style={{ transform: `translate(${base.x}px, ${base.y}px)` }}
            data-pile={pileLayout.id}
            data-index={-1}
          >
            {pileLayout.emptyLabel === undefined ? undefined : (
              <span className="pile-label">{pileLayout.emptyLabel}</span>
            )}
          </div>
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
            compact={geometry.compact}
            selected={inRun(selection, pile, index)}
            dragging={inRun(drag, pile, index)}
            target={top && (drag?.targets.has(pile) === true || highlight?.to === pile)}
            hinted={inRun(highlight?.from, pile, index)}
            shaking={inRun(shaking, pile, index)}
          />
        );
      })}
    </div>
  );
}
