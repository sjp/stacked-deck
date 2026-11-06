import { useCallback, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, RefObject } from "react";
import { findPile } from "../engine/state.ts";
import type { GameState, Move, PileId } from "../engine/types.ts";
import type { Variant } from "../engine/variant.ts";
import { emitFeedback } from "../app/feedback.ts";
import type { Rect, TableGeometry } from "./geometry.ts";
import { containsPoint, overlapArea } from "./geometry.ts";

/** Pointer travel, in pixels, before a press becomes a drag. */
const DRAG_THRESHOLD = 6;
const DOUBLE_TAP_MS = 320;
const SHAKE_MS = 400;

export interface CardRef {
  readonly pile: PileId;
  /** -1 for an empty pile. */
  readonly index: number;
}

interface Press extends CardRef {
  readonly pointerId: number;
  readonly startX: number;
  readonly startY: number;
  readonly canDrag: boolean;
  dragging: boolean;
}

export interface DragView extends CardRef {
  readonly targets: ReadonlyMap<PileId, Move>;
}

interface Options {
  readonly variant: Variant;
  readonly state: GameState;
  readonly geometry: TableGeometry | undefined;
  readonly smartTap: boolean;
  readonly tableRef: RefObject<HTMLElement | null>;
  /** Plays a move; returns false if it was rejected. */
  readonly onPlay: (move: Move) => boolean;
  readonly disabled?: boolean;
}

/** Which card or pile an element belongs to, from its data attributes. */
export function cardRefFromElement(target: EventTarget | null): CardRef | undefined {
  if (!(target instanceof Element)) {
    return undefined;
  }
  const element = target.closest<HTMLElement>("[data-pile]");
  const pile = element?.dataset["pile"];
  if (element === null || pile === undefined) {
    return undefined;
  }
  return { pile, index: Number(element.dataset["index"] ?? "-1") };
}

function legalTargets(
  variant: Variant,
  state: GameState,
  from: CardRef,
): ReadonlyMap<PileId, Move> {
  const targets = new Map<PileId, Move>();
  for (const pile of state.piles) {
    if (pile.id === from.pile && pile.kind !== "tableau") {
      continue;
    }
    // Pyramid-style pairs target a card rather than a pile, so check the pile's top card.
    const move = variant.dropMove(state, from.pile, from.index, pile.id);
    if (move !== undefined) {
      targets.set(pile.id, move);
    }
  }
  return targets;
}

/** The part of a pile a dragged card should overlap: its top card, or its base. */
function dropRect(geometry: TableGeometry, pile: PileId): Rect | undefined {
  const top = geometry.cards.findLast((placement) => placement.pile === pile);
  if (top !== undefined) {
    return { x: top.x, y: top.y, width: geometry.cardWidth, height: geometry.cardHeight };
  }
  return geometry.bases.get(pile);
}

function isFoundationMove(state: GameState, move: Move): boolean {
  return move.kind === "move" && findPile(state, move.to)?.kind === "foundation";
}

export function useTableInteraction({
  variant,
  state,
  geometry,
  smartTap,
  tableRef,
  onPlay,
  disabled = false,
}: Options) {
  const [selection, setSelection] = useState<CardRef>();
  const [drag, setDrag] = useState<DragView>();
  const [shaking, setShaking] = useState<CardRef>();
  const press = useRef<Press | undefined>(undefined);
  const lastTap = useRef<{ ref: CardRef; time: number } | undefined>(undefined);
  /** Smart-tap cycling: repeated taps on a card that just moved try its next destination. */
  const cycle = useRef<{ cardId: number; targets: PileId[]; next: number } | undefined>(undefined);

  const shake = useCallback((ref: CardRef) => {
    emitFeedback("invalid");
    setShaking(ref);
    setTimeout(() => {
      setShaking(undefined);
    }, SHAKE_MS);
  }, []);

  const setDragOffset = useCallback(
    (dx: number, dy: number) => {
      const element = tableRef.current;
      if (element !== null) {
        element.style.setProperty("--drag-x", `${dx}px`);
        element.style.setProperty("--drag-y", `${dy}px`);
      }
    },
    [tableRef],
  );

  const playMove = useCallback(
    (move: Move): boolean => {
      const ok = onPlay(move);
      if (ok) {
        if (move.kind === "draw" || move.kind === "recycle") {
          emitFeedback("draw");
        } else if (isFoundationMove(state, move) || move.kind === "remove") {
          emitFeedback("foundation");
        } else if (move.kind === "flip") {
          emitFeedback("flip");
        } else {
          emitFeedback("drop");
        }
      }
      return ok;
    },
    [onPlay, state],
  );

  const smartMove = useCallback(
    (ref: CardRef, moves: readonly Move[]): void => {
      const card = findPile(state, ref.pile)?.cards[ref.index];
      const current = cycle.current;
      if (card !== undefined && current?.cardId === card.id && current.targets.length > 1) {
        // The card just moved here: try the remaining destinations in turn.
        for (let i = 0; i < current.targets.length; i++) {
          const index = (current.next + i) % current.targets.length;
          const target = current.targets[index];
          if (target === undefined || target === ref.pile) {
            continue;
          }
          const move = variant.dropMove(state, ref.pile, ref.index, target);
          if (move !== undefined && playMove(move)) {
            cycle.current = { ...current, next: index + 1 };
            return;
          }
        }
      }
      const [first] = moves;
      if (first === undefined) {
        return;
      }
      if (playMove(first)) {
        const targets = moves.flatMap((move) => (move.kind === "move" ? [move.to] : []));
        cycle.current =
          card === undefined
            ? undefined
            : { cardId: card.id, targets: [...targets, ref.pile], next: 1 };
      }
    },
    [playMove, state, variant],
  );

  const tap = useCallback(
    (ref: CardRef) => {
      const now = performance.now();
      const previous = lastTap.current;
      const isDouble =
        previous !== undefined &&
        now - previous.time < DOUBLE_TAP_MS &&
        previous.ref.pile === ref.pile &&
        previous.ref.index === ref.index;
      lastTap.current = { ref, time: now };

      if (selection !== undefined) {
        const sameCard = selection.pile === ref.pile && selection.index === ref.index;
        if (sameCard) {
          setSelection(undefined);
          if (isDouble) {
            const up = variant
              .tapMoves(state, ref.pile, ref.index)
              .find((move) => isFoundationMove(state, move));
            if (up !== undefined) {
              playMove(up);
            }
          }
          return;
        }
        const move = variant.dropMove(state, selection.pile, selection.index, ref.pile);
        setSelection(undefined);
        if (move !== undefined) {
          playMove(move);
          return;
        }
        if (!variant.canPickUp(state, ref.pile, ref.index)) {
          shake(selection);
          return;
        }
      }

      const moves = variant.tapMoves(state, ref.pile, ref.index);
      const pickable = variant.canPickUp(state, ref.pile, ref.index);
      if (!pickable) {
        // Stock draws, flips and lone discards happen on any tap.
        const [first] = moves;
        if (first === undefined) {
          if (ref.index >= 0) {
            shake(ref);
          }
          return;
        }
        playMove(first);
        return;
      }
      if (smartTap && moves.length > 0) {
        smartMove(ref, moves);
        return;
      }
      cycle.current = undefined;
      emitFeedback("pickup");
      setSelection(ref);
    },
    [playMove, selection, shake, smartMove, smartTap, state, variant],
  );

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (disabled || event.button !== 0 || press.current !== undefined) {
        return;
      }
      const ref = cardRefFromElement(event.target);
      if (ref === undefined) {
        setSelection(undefined);
        return;
      }
      event.currentTarget.setPointerCapture(event.pointerId);
      press.current = {
        ...ref,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        canDrag: ref.index >= 0 && variant.canPickUp(state, ref.pile, ref.index),
        dragging: false,
      };
    },
    [disabled, state, variant],
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const current = press.current;
      if (current?.pointerId !== event.pointerId || !current.canDrag) {
        return;
      }
      const dx = event.clientX - current.startX;
      const dy = event.clientY - current.startY;
      if (!current.dragging) {
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD) {
          return;
        }
        current.dragging = true;
        setSelection(undefined);
        emitFeedback("pickup");
        setDrag({
          pile: current.pile,
          index: current.index,
          targets: legalTargets(variant, state, current),
        });
      }
      setDragOffset(dx, dy);
    },
    [setDragOffset, state, variant],
  );

  const finishDrag = useCallback(
    (current: Press, clientX: number, clientY: number) => {
      const targets = legalTargets(variant, state, current);
      const start = geometry?.cards.find(
        (placement) => placement.pile === current.pile && placement.index === current.index,
      );
      const table = tableRef.current?.getBoundingClientRect();
      let best: Move | undefined;
      if (geometry !== undefined && start !== undefined && table !== undefined) {
        const dragged: Rect = {
          x: start.x + clientX - current.startX,
          y: start.y + clientY - current.startY,
          width: geometry.cardWidth,
          height: geometry.cardHeight,
        };
        const pointX = clientX - table.left;
        const pointY = clientY - table.top;
        let bestArea = 0;
        for (const [pile, move] of targets) {
          const rect = dropRect(geometry, pile);
          const pileRect = geometry.piles.get(pile);
          if (rect === undefined) {
            continue;
          }
          const pointed = pileRect !== undefined && containsPoint(pileRect, pointX, pointY);
          const area = overlapArea(dragged, rect) + (pointed ? geometry.cardWidth ** 2 : 0);
          if (area > bestArea) {
            bestArea = area;
            best = move;
          }
        }
      }
      setDrag(undefined);
      setDragOffset(0, 0);
      if (best === undefined || !playMove(best)) {
        shake(current);
      }
    },
    [geometry, playMove, setDragOffset, shake, state, tableRef, variant],
  );

  const onPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const current = press.current;
      if (current?.pointerId !== event.pointerId) {
        return;
      }
      press.current = undefined;
      if (current.dragging) {
        finishDrag(current, event.clientX, event.clientY);
      } else {
        tap(current);
      }
    },
    [finishDrag, tap],
  );

  const onPointerCancel = useCallback(() => {
    if (press.current?.dragging === true) {
      setDrag(undefined);
      setDragOffset(0, 0);
    }
    press.current = undefined;
  }, [setDragOffset]);

  const clearSelection = useCallback(() => {
    setSelection(undefined);
  }, []);

  return {
    selection,
    drag,
    shaking,
    clearSelection,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
      onLostPointerCapture: onPointerCancel,
    },
  };
}
