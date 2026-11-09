import { solve } from "../engine/solver.ts";
import { getVariant } from "../engine/variants/index.ts";
import type { SolverRequest, SolverResponse } from "./solverProtocol.ts";

/** Runs the solver off the main thread, so finding a deal never freezes the game. */
function handle(request: SolverRequest): SolverResponse {
  const variant = getVariant(request.variant);
  if (request.type === "hint") {
    const result =
      variant === undefined
        ? undefined
        : solve(variant, request.state, {
            maxNodes: Number.POSITIVE_INFINITY,
            maxMs: request.budgetMs,
          });
    return {
      type: "hint",
      id: request.id,
      move: result?.status === "solved" ? result.moves[0] : undefined,
    };
  }
  if (variant === undefined) {
    return { type: "deal", id: request.id, seed: undefined };
  }
  const deadline = Date.now() + request.budgetMs;
  const values = new Uint32Array(1);
  while (Date.now() < deadline) {
    crypto.getRandomValues(values);
    const seed = values[0] ?? 0;
    const result = solve(variant, variant.deal(seed, request.options), {
      maxNodes: Number.POSITIVE_INFINITY,
      maxMs: Math.min(request.perSeedMs, deadline - Date.now()),
    });
    if (result.status === "solved") {
      return { type: "deal", id: request.id, seed };
    }
  }
  return { type: "deal", id: request.id, seed: undefined };
}

globalThis.addEventListener("message", (event: MessageEvent<SolverRequest>) => {
  globalThis.postMessage(handle(event.data), { transfer: [] });
});
