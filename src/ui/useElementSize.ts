import { useLayoutEffect, useState } from "react";
import type { RefObject } from "react";
import type { Size } from "./geometry.ts";

/** Tracks an element's content size with a ResizeObserver (resizes and rotation). */
export function useElementSize(ref: RefObject<HTMLElement | null>): Size | undefined {
  const [size, setSize] = useState<Size>();
  useLayoutEffect(() => {
    const element = ref.current;
    if (element === null) {
      return undefined;
    }
    const update = () => {
      const width = element.clientWidth;
      const height = element.clientHeight;
      setSize((previous) =>
        previous?.width === width && previous.height === height ? previous : { width, height },
      );
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, [ref]);
  return size;
}
