export type Command = "undo" | "redo";

export interface KeyInput {
  readonly key: string;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly shiftKey: boolean;
  readonly altKey: boolean;
}

/** Maps a key press to a game command: Ctrl/Cmd+Z undoes; Ctrl/Cmd+Shift+Z or Ctrl+Y redoes. */
export function commandFor(input: KeyInput): Command | undefined {
  const modifier = input.ctrlKey || input.metaKey;
  if (!modifier || input.altKey) {
    return undefined;
  }
  const key = input.key.toLowerCase();
  if (key === "z") {
    return input.shiftKey ? "redo" : "undo";
  }
  if (key === "y" && input.ctrlKey && !input.shiftKey) {
    return "redo";
  }
  return undefined;
}
