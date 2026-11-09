export type Route =
  | { readonly name: "home" }
  | { readonly name: "play"; readonly variant: string; readonly seed?: number }
  | { readonly name: "stats" }
  | { readonly name: "gallery" };

/**
 * Parses a location hash such as "#/play/klondike?seed=123". Unknown paths and query
 * parameters are ignored, so links from older versions still land somewhere sensible.
 */
export function parseRoute(hash: string): Route {
  const [path = "", query = ""] = hash.replace(/^#/u, "").split("?");
  const parts = path.split("/").filter((part) => part.length > 0);
  const [first, second] = parts;
  if (first === "play" && second !== undefined) {
    const seedText = new URLSearchParams(query).get("seed");
    const seed = seedText === null ? Number.NaN : Number(seedText);
    if (!Number.isInteger(seed) || seed < 0 || seed >= 2 ** 32) {
      return { name: "play", variant: second };
    }
    return { name: "play", variant: second, seed };
  }
  if (first === "stats" || first === "gallery") {
    return { name: first };
  }
  return { name: "home" };
}

export function routeHash(route: Route): string {
  if (route.name === "play") {
    return route.seed === undefined
      ? `#/play/${route.variant}`
      : `#/play/${route.variant}?seed=${route.seed}`;
  }
  return route.name === "home" ? "#/" : `#/${route.name}`;
}
