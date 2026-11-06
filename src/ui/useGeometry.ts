import { useMemo } from "react";
import type { GameState } from "../engine/types.ts";
import type { LayoutContext, TableLayout, Variant } from "../engine/variant.ts";
import type { Size, TableGeometry } from "./geometry.ts";
import { computeGeometry } from "./geometry.ts";

/** Phones held sideways get the variant's landscape layout. */
export function layoutContext(size: Size, leftHanded: boolean): LayoutContext {
  return { landscape: size.width / size.height > 1.4 && size.height < 560, leftHanded };
}

/** Lays out the table for the space available, once that space has been measured. */
export function useGeometry(
  variant: Variant,
  state: GameState,
  size: Size | undefined,
  leftHanded: boolean,
): { layout: TableLayout; geometry: TableGeometry } | undefined {
  return useMemo(() => {
    if (size === undefined || size.width === 0 || size.height === 0) {
      return undefined;
    }
    const layout = variant.layout(state, layoutContext(size, leftHanded));
    return { layout, geometry: computeGeometry(state, layout, size) };
  }, [variant, state, size, leftHanded]);
}
