import type { GameState, Move, VariantOptions } from "../engine/types.ts";
import type { SolverRequest, SolverResponse } from "./solverProtocol.ts";

let worker: Worker | undefined;
let nextId = 1;
const pending = new Map<number, (response: SolverResponse) => void>();

function getWorker(): Worker | undefined {
  if (worker === undefined && typeof Worker !== "undefined") {
    worker = new Worker(new URL("solverWorker.ts", import.meta.url), { type: "module" });
    worker.addEventListener("message", (event: MessageEvent<SolverResponse>) => {
      const resolve = pending.get(event.data.id);
      pending.delete(event.data.id);
      resolve?.(event.data);
    });
  }
  return worker;
}

async function ask(request: SolverRequest): Promise<SolverResponse | undefined> {
  const target = getWorker();
  if (target === undefined) {
    return undefined;
  }
  const response = await new Promise<SolverResponse>((resolve) => {
    pending.set(request.id, resolve);
    target.postMessage(request, { transfer: [] });
  });
  return response;
}

/** Tries random seeds in the worker until the solver wins one, within a time budget. */
export async function solveRandomDeal(
  variant: string,
  options: VariantOptions,
  budgetMs: number,
  perSeedMs: number,
): Promise<number | undefined> {
  const response = await ask({ type: "deal", id: nextId++, variant, options, budgetMs, perSeedMs });
  return response?.type === "deal" ? response.seed : undefined;
}

/** The first move of a solution from this position, if one is found in time. */
export async function solverHint(
  variant: string,
  state: GameState,
  budgetMs: number,
): Promise<Move | undefined> {
  const response = await ask({ type: "hint", id: nextId++, variant, state, budgetMs });
  return response?.type === "hint" ? response.move : undefined;
}
