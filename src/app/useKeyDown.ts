import { useEffect, useEffectEvent } from "react";
import type { Command } from "./shortcuts.ts";
import { commandFor } from "./shortcuts.ts";

/** Whether a key press was aimed at a text field or similar, which keeps its own keys. */
export function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement)
  );
}

/** Listens for key presses on the window while `enabled`. */
export function useKeyDown(handler: (event: KeyboardEvent) => void, enabled = true): void {
  const onKeyDown = useEffectEvent(handler);
  useEffect(() => {
    if (!enabled) {
      return undefined;
    }
    const listener = (event: KeyboardEvent) => {
      if (!isTyping(event.target)) {
        onKeyDown(event);
      }
    };
    globalThis.addEventListener("keydown", listener);
    return () => {
      globalThis.removeEventListener("keydown", listener);
    };
  }, [enabled]);
}

/** Runs game commands (undo, redo) from their keyboard shortcuts. */
export function useCommandKeys(run: Readonly<Record<Command, () => void>>, enabled = true): void {
  useKeyDown((event) => {
    const command = commandFor(event);
    if (command !== undefined) {
      event.preventDefault();
      run[command]();
    }
  }, enabled);
}
