const PREFIX = "stacked-deck:";

/**
 * How one stored key is versioned. Each key has its own version, so changing one format
 * never discards the others. Data from an older version goes through `migrate` if given;
 * anything else that doesn't match is ignored (and replaced on the next write).
 */
export interface StoredFormat {
  readonly version: number;
  readonly migrate?: (data: unknown, from: number) => unknown;
}

/** Every key starts here; bump a key's version only with a migration for the old one. */
export const FIRST_VERSION: StoredFormat = { version: 1 };

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** An in-memory store, for tests and as the fallback when localStorage fails. */
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

function localStore(): KeyValueStore | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    // Storage can be blocked (private modes, sandboxed frames).
    return undefined;
  }
}

/**
 * localStorage with an in-memory fallback. When storage is missing, or a write fails (a
 * full quota, Safari's private mode), the value is kept in memory instead, so progress
 * lasts at least for this visit: streaks build and bests show even when nothing persists.
 */
export function resilientStore(local: () => KeyValueStore | undefined): KeyValueStore {
  const memory = memoryStore();
  return {
    getItem: (key) => {
      const kept = memory.getItem(key);
      if (kept !== null) {
        return kept;
      }
      try {
        return local()?.getItem(key) ?? null;
      } catch {
        return null;
      }
    },
    setItem: (key, value) => {
      try {
        const store = local();
        if (store === undefined) {
          throw new Error("No storage");
        }
        store.setItem(key, value);
        memory.removeItem(key);
      } catch (error) {
        console.warn("Could not save", key, error);
        memory.setItem(key, value);
      }
    },
    removeItem: (key) => {
      memory.removeItem(key);
      try {
        local()?.removeItem(key);
      } catch {
        // Nothing more to remove.
      }
    },
  };
}

const defaultStore = resilientStore(localStore);

/** Reads a stored value, or undefined if it is missing, unreadable or from another version. */
export function readStored(
  key: string,
  store: KeyValueStore = defaultStore,
  format: StoredFormat = FIRST_VERSION,
): unknown {
  try {
    const text = store.getItem(PREFIX + key);
    if (text === null) {
      return undefined;
    }
    const parsed: unknown = JSON.parse(text);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("schemaVersion" in parsed) ||
      typeof parsed.schemaVersion !== "number" ||
      !("data" in parsed)
    ) {
      return undefined;
    }
    if (parsed.schemaVersion === format.version) {
      return parsed.data;
    }
    return parsed.schemaVersion < format.version && format.migrate !== undefined
      ? format.migrate(parsed.data, parsed.schemaVersion)
      : undefined;
  } catch {
    return undefined;
  }
}

export function writeStored(
  key: string,
  data: unknown,
  store: KeyValueStore = defaultStore,
  format: StoredFormat = FIRST_VERSION,
): void {
  try {
    store.setItem(PREFIX + key, JSON.stringify({ schemaVersion: format.version, data }));
  } catch (error) {
    console.warn("Could not save", key, error);
  }
}

export function removeStored(key: string, store: KeyValueStore = defaultStore): void {
  try {
    store.removeItem(PREFIX + key);
  } catch {
    // Nothing to remove if storage is unavailable.
  }
}
