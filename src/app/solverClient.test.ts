import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { klondike } from "../engine/variants/klondike/klondike.ts";
import type { WorkerLike } from "./solverClient.ts";
import { createSolverClient, TIMEOUT_MARGIN_MS } from "./solverClient.ts";
import type { SolverMessage, SolverResponse } from "./solverProtocol.ts";

/** A worker that records messages and answers only when told to. */
class FakeWorker implements WorkerLike {
  readonly sent: SolverMessage[] = [];
  terminated = false;
  private readonly listeners = new Map<string, ((event: MessageEvent) => void)[]>();

  postMessage(message: SolverMessage): void {
    this.sent.push(message);
  }

  addEventListener(type: string, listener: (event: MessageEvent) => void): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  terminate(): void {
    this.terminated = true;
  }

  emit(type: string, data?: SolverResponse): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(new MessageEvent(type, { data }));
    }
  }
}

const STATE = klondike.deal(1, { draw: 1 });
const AUTO = { safeToFoundation: true };

describe("solver client", () => {
  let workers: FakeWorker[];
  let client: ReturnType<typeof createSolverClient>;

  beforeEach(() => {
    vi.useFakeTimers();
    workers = [];
    client = createSolverClient(() => {
      const worker = new FakeWorker();
      workers.push(worker);
      return worker;
    });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the worker's answer", async () => {
    const seed = client.solveRandomDeal("freecell", {}, 700, 150);
    workers[0]!.emit("message", { type: "deal", id: workers[0]!.sent[0]!.id, seed: 42 });
    await expect(seed).resolves.toBe(42);
  });

  it("rejects when the worker answers with an error", async () => {
    const hint = client.solverHint("klondike", STATE, AUTO, 300);
    workers[0]!.emit("message", { type: "error", id: workers[0]!.sent[0]!.id, message: "boom" });
    await expect(hint).rejects.toThrow("boom");
  });

  it("rejects everything pending when the worker fails, then starts a new worker", async () => {
    const first = client.solverHint("klondike", STATE, AUTO, 300);
    const second = client.solveRandomDeal("freecell", {}, 700, 150);
    workers[0]!.emit("error");
    await expect(first).rejects.toThrow("worker failed");
    await expect(second).rejects.toThrow("worker failed");
    expect(workers[0]!.terminated).toBe(true);

    const third = client.solveRandomDeal("freecell", {}, 700, 150);
    expect(workers).toHaveLength(2);
    workers[1]!.emit("message", { type: "deal", id: workers[1]!.sent[0]!.id, seed: 7 });
    await expect(third).resolves.toBe(7);
  });

  it("gives up on a worker that never answers", async () => {
    const seed = client.solveRandomDeal("freecell", {}, 700, 150);
    const failure = seed.catch((error: unknown) => error);
    vi.advanceTimersByTime(700 + TIMEOUT_MARGIN_MS);
    await expect(failure).resolves.toMatchObject({ message: "The solver took too long" });
    expect(workers[0]!.terminated).toBe(true);
  });

  it("settles a cancelled request with nothing and stops the worker if idle", async () => {
    const controller = new AbortController();
    const hint = client.solverHint("klondike", STATE, AUTO, 300, controller.signal);
    controller.abort();
    await expect(hint).resolves.toBeUndefined();
    expect(workers[0]!.terminated).toBe(true);
  });

  it("asks the worker to skip a cancelled request while others wait", async () => {
    const controller = new AbortController();
    const deal = client.solveRandomDeal("freecell", {}, 700, 150);
    const hint = client.solverHint("klondike", STATE, AUTO, 300, controller.signal);
    controller.abort();
    await expect(hint).resolves.toBeUndefined();
    const [dealRequest, hintRequest] = workers[0]!.sent;
    expect(workers[0]!.sent.at(-1)).toEqual({ type: "cancel", id: hintRequest!.id });
    expect(workers[0]!.terminated).toBe(false);
    workers[0]!.emit("message", { type: "deal", id: dealRequest!.id, seed: 3 });
    await expect(deal).resolves.toBe(3);
  });
});
