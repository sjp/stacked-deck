import { solve } from "../engine/solver.ts";
import { getVariant } from "../engine/variants/index.ts";
import type { SolverRequest, SolverResponse } from "./solverProtocol.ts";

/** Answers one solver request. Runs in the solver worker; separate so it can be tested. */
export function handle(request: SolverRequest): SolverResponse {
  const variant = getVariant(request.variant);
  if (request.type === "hint") {
    const result =
      variant === undefined
        ? undefined
        : solve(
            variant,
            request.state,
            { maxNodes: Number.POSITIVE_INFINITY, maxMs: request.budgetMs },
            { startAuto: request.auto },
          );
    return {
      type: "hint",
      id: request.id,
      moves: result?.status === "solved" ? result.moves : undefined,
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

/** Like `handle`, but a request that throws gets an error response instead. */
export function respond(request: SolverRequest): SolverResponse {
  try {
    return handle(request);
  } catch (error) {
    return { type: "error", id: request.id, message: String(error) };
  }
}
