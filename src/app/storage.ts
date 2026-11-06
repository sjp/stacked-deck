/** Bump when the stored format changes; older data is migrated or discarded. */
export const SCHEMA_VERSION = 1;
const PREFIX = "stacked-deck:";

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function defaultStore(): KeyValueStore | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    // Storage can be blocked (private modes, sandboxed frames).
    return undefined;
  }
}

/** Reads a stored value, or undefined if it is missing, unreadable or from another schema. */
export function readStored(key: string, store = defaultStore()): unknown {
  try {
    const text = store?.getItem(PREFIX + key);
    if (text === null || text === undefined) {
      return undefined;
    }
    const parsed: unknown = JSON.parse(text);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "schemaVersion" in parsed &&
      parsed.schemaVersion === SCHEMA_VERSION &&
      "data" in parsed
    ) {
      return parsed.data;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

export function writeStored(key: string, data: unknown, store = defaultStore()): void {
  try {
    store?.setItem(PREFIX + key, JSON.stringify({ schemaVersion: SCHEMA_VERSION, data }));
  } catch (error) {
    console.warn("Could not save", key, error);
  }
}

export function removeStored(key: string, store = defaultStore()): void {
  try {
    store?.removeItem(PREFIX + key);
  } catch {
    // Nothing to remove if storage is unavailable.
  }
}

/** An in-memory store, for tests and when localStorage is unavailable. */
export function memoryStore(): KeyValueStore {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    },
  };
}
