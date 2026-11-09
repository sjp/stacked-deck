import type { GameState, Move, VariantOptions } from "../engine/types.ts";
import type { AutoMoveOptions } from "../engine/variant.ts";
import type { SolverMessage, SolverRequest, SolverResponse } from "./solverProtocol.ts";

/** Time allowed on top of a request's own budget before the worker is presumed stuck. */
export const TIMEOUT_MARGIN_MS = 2000;

/** The parts of a Worker the client uses, so tests can pass a fake. */
export interface WorkerLike {
  postMessage(message: SolverMessage, options: { transfer: Transferable[] }): void;
  addEventListener(type: "message", listener: (event: MessageEvent<SolverResponse>) => void): void;
  addEventListener(type: "error" | "messageerror", listener: () => void): void;
  terminate(): void;
}

interface Pending {
  readonly resolve: (response: SolverResponse | undefined) => void;
  readonly reject: (error: Error) => void;
  readonly timer: ReturnType<typeof setTimeout>;
}

/**
 * Sends requests to a solver worker. Every request settles: with the answer; with
 * undefined when cancelled or when workers aren't available; or with an error when the
 * worker fails, answers with an error or takes longer than the request's budget plus a
 * margin. A failed or stuck worker is dropped and the next request starts a new one.
 */
export function createSolverClient(spawn: () => WorkerLike | undefined) {
  let worker: WorkerLike | undefined;
  let nextId = 1;
  const pending = new Map<number, Pending>();

  function settle(id: number): Pending | undefined {
    const entry = pending.get(id);
    pending.delete(id);
    if (entry !== undefined) {
      clearTimeout(entry.timer);
    }
    return entry;
  }

  /** Stops the worker and fails everything it still owes. */
  function reset(reason: string): void {
    worker?.terminate();
    worker = undefined;
    for (const id of pending.keys()) {
      settle(id)?.reject(new Error(reason));
    }
  }

  function getWorker(): WorkerLike | undefined {
    if (worker === undefined) {
      const created = spawn();
      created?.addEventListener("message", (event: MessageEvent<SolverResponse>) => {
        const response = event.data;
        const entry = settle(response.id);
        if (response.type === "error") {
          entry?.reject(new Error(response.message));
        } else {
          entry?.resolve(response);
        }
      });
      const onError = () => {
        if (worker === created) {
          reset("The solver worker failed");
        }
      };
      created?.addEventListener("error", onError);
      created?.addEventListener("messageerror", onError);
      worker = created;
    }
    return worker;
  }

  async function ask(
    request: SolverRequest,
    signal?: AbortSignal,
  ): Promise<SolverResponse | undefined> {
    const target = getWorker();
    if (target === undefined || signal?.aborted === true) {
      return undefined;
    }
    const response = await new Promise<SolverResponse | undefined>((resolve, reject) => {
      const timer = setTimeout(() => {
        // The worker is stuck on this request (or one before it), so start afresh.
        settle(request.id)?.reject(new Error("The solver took too long"));
        reset("The solver was restarted");
      }, request.budgetMs + TIMEOUT_MARGIN_MS);
      pending.set(request.id, { resolve, reject, timer });
      signal?.addEventListener("abort", () => {
        if (settle(request.id) === undefined) {
          return;
        }
        resolve(undefined);
        if (pending.size === 0) {
          // Nothing else is waiting, so stop whatever is running now.
          reset("Cancelled");
        } else {
          target.postMessage({ type: "cancel", id: request.id }, { transfer: [] });
        }
      });
      target.postMessage(request, { transfer: [] });
    });
    return response;
  }

  return {
    /** Tries random seeds in the worker until the solver wins one, within a time budget. */
    solveRandomDeal: async (
      variant: string,
      options: VariantOptions,
      budgetMs: number,
      perSeedMs: number,
      signal?: AbortSignal,
    ): Promise<number | undefined> => {
      const id = nextId++;
      const response = await ask(
        { type: "deal", id, variant, options, budgetMs, perSeedMs },
        signal,
      );
      return response?.type === "deal" ? response.seed : undefined;
    },

    /** The first move of a solution from this position, if one is found in time. */
    solverHint: async (
      variant: string,
      state: GameState,
      auto: AutoMoveOptions,
      budgetMs: number,
      signal?: AbortSignal,
    ): Promise<Move | undefined> => {
      const id = nextId++;
      const response = await ask({ type: "hint", id, variant, state, auto, budgetMs }, signal);
      return response?.type === "hint" ? response.move : undefined;
    },
  };
}

const client = createSolverClient(() =>
  typeof Worker === "undefined"
    ? undefined
    : new Worker(new URL("solverWorker.ts", import.meta.url), { type: "module" }),
);

export const { solveRandomDeal, solverHint } = client;
