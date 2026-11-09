import { respond } from "./solverHandler.ts";
import type { SolverMessage, SolverRequest } from "./solverProtocol.ts";

/**
 * Runs the solver off the main thread, so finding a deal never freezes the game. Requests
 * are queued and answered one per task, so a cancel message that arrives while one runs is
 * seen before the next starts and a stale request is skipped.
 */
const queue: SolverRequest[] = [];
const cancelled = new Set<number>();
let draining = false;

function drain(): void {
  const request = queue.shift();
  if (request === undefined) {
    draining = false;
    return;
  }
  if (cancelled.delete(request.id)) {
    setTimeout(drain, 0);
    return;
  }
  globalThis.postMessage(respond(request), { transfer: [] });
  setTimeout(drain, 0);
}

globalThis.addEventListener("message", (event: MessageEvent<SolverMessage>) => {
  const message = event.data;
  if (message.type === "cancel") {
    cancelled.add(message.id);
    return;
  }
  queue.push(message);
  if (!draining) {
    draining = true;
    setTimeout(drain, 0);
  }
});
