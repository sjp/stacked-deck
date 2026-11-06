import { useEffect, useState } from "react";
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

export function navigate(route: Route, replace = false): void {
  const hash = routeHash(route);
  if (replace) {
    globalThis.history.replaceState(globalThis.history.state, "", hash);
    globalThis.dispatchEvent(new HashChangeEvent("hashchange"));
  } else {
    globalThis.location.hash = hash;
  }
}
