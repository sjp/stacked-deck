export interface PriorityQueue<T> {
  /** Adds an item; lower priorities come out first. */
  push(priority: number, item: T): void;
  /** Removes and returns the item with the lowest priority, the earliest added on a tie. */
  pop(): T | undefined;
  readonly size: number;
}

interface Entry<T> {
  readonly priority: number;
  readonly order: number;
  readonly item: T;
}

function before<T>(a: Entry<T>, b: Entry<T>): boolean {
  return a.priority < b.priority || (a.priority === b.priority && a.order < b.order);
}

/** A binary min-heap. Ties break by insertion order, so the order out is deterministic. */
export function priorityQueue<T>(): PriorityQueue<T> {
  const heap: Entry<T>[] = [];
  let added = 0;

  function swap(i: number, j: number): void {
    const a = heap[i];
    const b = heap[j];
    if (a !== undefined && b !== undefined) {
      heap[i] = b;
      heap[j] = a;
    }
  }

  function lower(i: number, j: number): boolean {
    const a = heap[i];
    const b = heap[j];
    return a !== undefined && b !== undefined && before(a, b);
  }

  function siftUp(start: number): void {
    let i = start;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (!lower(i, parent)) {
        return;
      }
      swap(i, parent);
      i = parent;
    }
  }

  function siftDown(start: number): void {
    let i = start;
    for (;;) {
      const left = 2 * i + 1;
      const right = left + 1;
      let least = i;
      if (lower(left, least)) {
        least = left;
      }
      if (lower(right, least)) {
        least = right;
      }
      if (least === i) {
        return;
      }
      swap(i, least);
      i = least;
    }
  }

  return {
    push(priority, item) {
      heap.push({ priority, order: added, item });
      added += 1;
      siftUp(heap.length - 1);
    },
    pop() {
      const top = heap[0];
      const last = heap.pop();
      if (top !== undefined && last !== undefined && heap.length > 0) {
        heap[0] = last;
        siftDown(0);
      }
      return top?.item;
    },
    get size() {
      return heap.length;
    },
  };
}
