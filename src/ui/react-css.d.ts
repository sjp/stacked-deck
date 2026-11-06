import type { CSSProperties as ReactCSSProperties } from "react";

declare module "react" {
  /** Allows CSS custom properties such as --card-w in style objects. */
  interface CSSProperties {
    [property: `--${string}`]: string | number | undefined;
  }
}

export type { ReactCSSProperties };
