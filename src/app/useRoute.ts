import { useEffect, useState } from "react";
import type { DealLink } from "./deals.ts";
import type { Route } from "./route.ts";
import { parseRoute, routeHash } from "./route.ts";

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseRoute(globalThis.location.hash));
  useEffect(() => {
    const update = () => {
      setRoute(parseRoute(globalThis.location.hash));
    };
    globalThis.addEventListener("hashchange", update);
    return () => {
      globalThis.removeEventListener("hashchange", update);
    };
  }, []);
  return route;
}

export interface OpenedLink extends DealLink {
  readonly variant: string;
  /** Changes with every link opened, so the game screen can start afresh for each. */
  readonly id: number;
}

function linkIn(route: Route, id: number): OpenedLink | undefined {
  return route.name === "play" && route.seed !== undefined
    ? { variant: route.variant, seed: route.seed, params: route.options ?? {}, id }
    : undefined;
}

/**
 * Reads a deal link from the URL once, then replaces the URL with the plain play route.
 * No history entry is left holding the seed, so reloading, Back or closing a dialog can't
 * deal the link again. The link is kept while its game screen stays open.
 */
export function useDealLink(route: Route): OpenedLink | undefined {
  const [link, setLink] = useState(() => linkIn(route, 1));
  const [seen, setSeen] = useState(route);
  if (route !== seen) {
    setSeen(route);
    const opened = linkIn(route, (link?.id ?? 0) + 1);
    if (opened !== undefined) {
      setLink(opened);
    } else if (route.name !== "play" || route.variant !== link?.variant) {
      setLink(undefined);
    }
  }
  useEffect(() => {
    if (route.name === "play" && route.seed !== undefined) {
      globalThis.history.replaceState(
        null,
        "",
        routeHash({ name: "play", variant: route.variant }),
      );
      globalThis.dispatchEvent(new HashChangeEvent("hashchange"));
    }
  }, [route]);
  return link;
}

export function navigate(route: Route): void {
  globalThis.location.hash = routeHash(route);
}
