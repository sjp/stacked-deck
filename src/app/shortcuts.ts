export type Command = "undo" | "redo" | "hint" | "newGame" | "help";

export interface KeyInput {
  readonly key: string;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly shiftKey: boolean;
  readonly altKey: boolean;
}

/** Single keys that work anywhere in the game (the table handles arrows, Enter, F and D). */
const PLAIN_KEYS: Readonly<Record<string, Command>> = {
  h: "hint",
  u: "undo",
  n: "newGame",
  "?": "help",
};

/**
 * Maps a key press to a game command. Ctrl/Cmd+Z undoes; Ctrl/Cmd+Shift+Z or Ctrl+Y
 * redoes; H, U, N and ? need no modifier.
 */
export function commandFor(input: KeyInput): Command | undefined {
  if (input.altKey) {
    return undefined;
  }
  const key = input.key.toLowerCase();
  if (input.ctrlKey || input.metaKey) {
    if (key === "z") {
      return input.shiftKey ? "redo" : "undo";
    }
    return key === "y" && input.ctrlKey && !input.shiftKey ? "redo" : undefined;
  }
  return PLAIN_KEYS[key];
}

/** The keyboard help shown by "?". */
export const KEY_HELP: readonly (readonly [string, string])[] = [
  ["Arrow keys", "Move between cards and piles"],
  ["Enter or Space", "Pick up the card, or put held cards down"],
  ["Esc", "Put held cards back"],
  ["F", "Send the card to a foundation"],
  ["D", "Draw from the stock"],
  ["H", "Show a hint"],
  ["U or Ctrl+Z", "Undo"],
  ["Ctrl+Shift+Z or Ctrl+Y", "Redo"],
  ["N", "New game"],
  ["?", "Show these keys"],
];
