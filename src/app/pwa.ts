import { useSyncExternalStore } from "react";

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
}

interface PwaState {
  /** A new version is waiting; calling this activates it and reloads. */
  readonly update: (() => void) | undefined;
  /** The browser offered to install the app (Chromium). */
  readonly install: (() => void) | undefined;
}

const UPDATE_CHECK_MS = 60 * 60 * 1000;

let state: PwaState = { update: undefined, install: undefined };
const listeners = new Set<() => void>();

function set(changes: Partial<PwaState>): void {
  state = { ...state, ...changes };
  for (const listener of listeners) {
    listener();
  }
}

function isInstallPrompt(event: Event): event is InstallPromptEvent {
  return "prompt" in event && typeof event.prompt === "function";
}

/** Registers the service worker and listens for updates and install prompts. */
export async function startPwa(): Promise<void> {
  globalThis.addEventListener("beforeinstallprompt", (event) => {
    if (!isInstallPrompt(event)) {
      return;
    }
    event.preventDefault();
    set({
      install: () => {
        set({ install: undefined });
        event.prompt().catch((error: unknown) => {
          console.warn("Install prompt failed", error);
        });
      },
    });
  });
  globalThis.addEventListener("appinstalled", () => {
    set({ install: undefined });
  });

  const { registerSW } = await import("virtual:pwa-register");
  const updateSW = registerSW({
    // An installed app can stay open for days, so look for a new version whenever it
    // comes back to the foreground, and hourly while it stays open.
    onRegisteredSW: (_url, registration) => {
      if (registration === undefined) {
        return;
      }
      const check = () => {
        registration.update().catch((error: unknown) => {
          console.warn("Update check failed", error);
        });
      };
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
          check();
        }
      });
      setInterval(check, UPDATE_CHECK_MS);
    },
    onNeedRefresh: () => {
      set({
        update: () => {
          // Games are saved on pagehide, so the reload loses nothing.
          updateSW(true).catch((error: unknown) => {
            console.warn("Update failed", error);
          });
        },
      });
    },
  });
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function usePwa(): PwaState {
  return useSyncExternalStore(subscribe, () => state);
}

/** iOS has no install prompt: the app is added from Safari's Share menu. */
export function showIosInstallHint(): boolean {
  const standalone =
    globalThis.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && navigator.standalone === true);
  const ios =
    /iPad|iPhone|iPod/u.test(navigator.userAgent) ||
    (navigator.userAgent.includes("Macintosh") && navigator.maxTouchPoints > 1);
  return ios && !standalone;
}
