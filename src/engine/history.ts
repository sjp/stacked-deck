/** An undo/redo history. Entries are immutable, so this is a stack of references. */
export interface History<T> {
  readonly past: readonly T[];
  readonly present: T;
  readonly future: readonly T[];
}

export function createHistory<T>(present: T): History<T> {
  return { past: [], present, future: [] };
}

/** Adds a new entry and clears the redo stack. */
export function pushHistory<T>(history: History<T>, entry: T): History<T> {
  return { past: [...history.past, history.present], present: entry, future: [] };
}

export function canUndo<T>(history: History<T>): boolean {
  return history.past.length > 0;
}

export function canRedo<T>(history: History<T>): boolean {
  return history.future.length > 0;
}

export function undo<T>(history: History<T>): History<T> {
  const previous = history.past.at(-1);
  if (previous === undefined) {
    return history;
  }
  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future],
  };
}

export function redo<T>(history: History<T>): History<T> {
  const [next, ...rest] = history.future;
  if (next === undefined) {
    return history;
  }
  return { past: [...history.past, history.present], present: next, future: rest };
}
