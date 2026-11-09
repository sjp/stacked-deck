import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type {
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  RefObject,
} from "react";
import { findPile } from "../engine/state.ts";
import type { GameState, Move, Pile, PileId } from "../engine/types.ts";
import type { Variant } from "../engine/variant.ts";
import { emitFeedback } from "./feedback.ts";
import type { Rect, TableGeometry } from "./geometry.ts";
import { containsPoint, overlapArea } from "./geometry.ts";

/** Pointer travel, in pixels, before a press becomes a drag. */
/** How far a press moves before it's a drag (or, on a card that can't move, not a tap). */
const DRAG_THRESHOLD = { mouse: 6, touch: 10 } as const;
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
  readonly threshold: number;
  dragging: boolean;
  /** Moved too far to count as a tap (on a card that can't be dragged). */
  wandered: boolean;
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
  /** Called when a move is refused. */
  readonly onInvalid?: () => void;
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

/**
 * The move a drag from `from` makes when dropped on `to`. A tableau pile takes the longest
 * tail of the grabbed cards that it accepts, so a finger that grabs a card or two too deep
 * still moves the part that fits; the rest go back. Other piles take exactly what was
 * grabbed: a run dropped on a foundation shouldn't send up just its top card.
 */
export function dropMoveOnto(
  variant: Variant,
  state: GameState,
  from: CardRef,
  to: Pile,
): Move | undefined {
  // Pyramid-style pairs target a card rather than a pile, so check the pile's top card.
  const move = variant.dropMove(state, from.pile, from.index, to.id);
  if (move !== undefined || to.kind !== "tableau") {
    return move;
  }
  const length = findPile(state, from.pile)?.cards.length ?? 0;
  for (let index = from.index + 1; index < length; index++) {
    const shorter = variant.dropMove(state, from.pile, index, to.id);
    if (shorter !== undefined) {
      return shorter;
    }
  }
  return undefined;
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
    const move = dropMoveOnto(variant, state, from, pile);
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
  onInvalid,
  disabled = false,
}: Options) {
  const onInvalidRef = useRef(onInvalid);
  useEffect(() => {
    onInvalidRef.current = onInvalid;
  }, [onInvalid]);
  // A selection belongs to the state it was made in, so undo or a new deal clears it.
  const [selected, setSelected] = useState<{ ref: CardRef; state: GameState }>();
  const selection = selected?.state === state ? selected.ref : undefined;
  const setSelection = useCallback(
    (ref: CardRef | undefined) => {
      setSelected(ref === undefined ? undefined : { ref, state });
    },
    [state],
  );
  const [drag, setDrag] = useState<DragView>();
  const [shaking, setShaking] = useState<CardRef>();
  const [message, setMessage] = useState<string>();
  const messageTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const shakeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(
    () => () => {
      clearTimeout(messageTimer.current);
      clearTimeout(shakeTimer.current);
    },
    [],
  );
  const say = useCallback((text: string) => {
    clearTimeout(messageTimer.current);
    setMessage(text);
    messageTimer.current = setTimeout(() => {
      setMessage(undefined);
    }, 2500);
  }, []);
  const press = useRef<Press | undefined>(undefined);
  const lastTap = useRef<{ ref: CardRef; time: number } | undefined>(undefined);
  /** Smart-tap cycling: repeated taps on a card that just moved try its next destination. */
  const cycle = useRef<{ cardId: number; targets: PileId[]; next: number } | undefined>(undefined);

  const shake = useCallback((ref: CardRef) => {
    emitFeedback("invalid");
    onInvalidRef.current?.();
    setShaking(ref);
    // One timer, so an earlier shake can't end a later one early.
    clearTimeout(shakeTimer.current);
    shakeTimer.current = setTimeout(() => {
      setShaking(undefined);
    }, SHAKE_MS);
  }, []);

  // The dragged cards' elements, found once when a drag starts. The offset goes on them
  // alone: set on the table, it would restyle every card on every pointer move.
  const draggedElements = useRef<HTMLElement[]>([]);
  const setDragOffset = useCallback((dx: number, dy: number) => {
    for (const element of draggedElements.current) {
      element.style.setProperty("--drag-x", `${dx}px`);
      element.style.setProperty("--drag-y", `${dy}px`);
    }
  }, []);
  // The offset is cleared only after a drop commits, so the table's card animation (whose
  // layout effect runs first) can still read where the cards were let go.
  useLayoutEffect(() => {
    if (drag === undefined) {
      for (const element of draggedElements.current) {
        element.style.removeProperty("--drag-x");
        element.style.removeProperty("--drag-y");
      }
      draggedElements.current = [];
    }
  }, [drag]);

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
    (ref: CardRef, smart: boolean = smartTap) => {
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
      if (smart && moves.length > 0) {
        smartMove(ref, moves);
        return;
      }
      cycle.current = undefined;
      emitFeedback("pickup");
      setSelection(ref);
    },
    [playMove, selection, setSelection, shake, smartMove, smartTap, state, variant],
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
        threshold: event.pointerType === "mouse" ? DRAG_THRESHOLD.mouse : DRAG_THRESHOLD.touch,
        dragging: false,
        wandered: false,
      };
    },
    [disabled, setSelection, state, variant],
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const current = press.current;
      if (current?.pointerId !== event.pointerId) {
        return;
      }
      const dx = event.clientX - current.startX;
      const dy = event.clientY - current.startY;
      if (!current.canDrag) {
        // A swipe across the stock shouldn't draw.
        current.wandered ||= Math.hypot(dx, dy) >= current.threshold;
        return;
      }
      if (!current.dragging) {
        if (Math.hypot(dx, dy) < current.threshold) {
          return;
        }
        current.dragging = true;
        const pile = tableRef.current?.querySelectorAll<HTMLElement>(
          `.card-slot[data-pile="${CSS.escape(current.pile)}"]`,
        );
        draggedElements.current = [...(pile ?? [])].filter(
          (element) => Number(element.dataset["index"]) >= current.index,
        );
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
    [setDragOffset, setSelection, state, tableRef, variant],
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
      if (best !== undefined && playMove(best)) {
        return;
      }
      const pointed = cardRefFromElement(
        document
          .elementsFromPoint(clientX, clientY)
          .find(
            (element) =>
              element.closest(".dragging") === null && element.closest("[data-pile]") !== null,
          ) ?? null,
      );
      // Let go over bare felt or its own pile: the cards just slide back, without a fuss.
      if (pointed === undefined || pointed.pile === current.pile) {
        return;
      }
      shake(current);
      const reason = variant.explainMove?.(state, current.pile, current.index, pointed.pile);
      if (reason !== undefined) {
        say(reason);
      }
    },
    [geometry, playMove, say, shake, state, tableRef, variant],
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
      } else if (!current.wandered) {
        tap(current);
      }
    },
    [finishDrag, tap],
  );

  const onPointerCancel = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    // Another finger's cancel leaves this drag alone.
    if (press.current?.pointerId !== event.pointerId) {
      return;
    }
    if (press.current.dragging) {
      setDrag(undefined);
    }
    press.current = undefined;
  }, []);

  /** Sends a card to a foundation (or discards it), as a double-click would. */
  const toFoundation = useCallback(
    (ref: CardRef) => {
      const up = variant
        .tapMoves(state, ref.pile, ref.index)
        .find((move) => isFoundationMove(state, move) || move.kind === "remove");
      setSelection(undefined);
      if (up === undefined || !playMove(up)) {
        shake(ref);
      }
    },
    [playMove, setSelection, shake, state, variant],
  );

  const clearSelection = useCallback(() => {
    setSelection(undefined);
  }, [setSelection]);

  return {
    selection,
    /** A tap or keyboard activation; keyboard play passes `smart: false` to pick up first. */
    activate: tap,
    toFoundation,
    clearSelection,
    drag,
    shaking,
    message,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
      onLostPointerCapture: onPointerCancel,
      // No long-press menu on Android while holding a card.
      onContextMenu: (event: ReactMouseEvent<HTMLElement>) => {
        event.preventDefault();
      },
    },
  };
}
