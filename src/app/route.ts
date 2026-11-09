export type Route =
  | { readonly name: "home" }
  | {
      readonly name: "play";
      readonly variant: string;
      readonly seed?: number;
      /** A deal link's options, as raw text; only read alongside a seed. */
      readonly options?: Readonly<Record<string, string>>;
    }
  | { readonly name: "stats" }
  | { readonly name: "gallery" };

/**
 * Parses a location hash such as "#/play/klondike?seed=123&draw=3". Unknown paths are
 * ignored, so links from older versions still land somewhere sensible.
 */
export function parseRoute(hash: string): Route {
  const [path = "", query = ""] = hash.replace(/^#/u, "").split("?");
  const parts = path.split("/").filter((part) => part.length > 0);
  const [first, second] = parts;
  if (first === "play" && second !== undefined) {
    const params = new URLSearchParams(query);
    const seedText = params.get("seed");
    const seed = seedText === null ? Number.NaN : Number(seedText);
    if (!Number.isInteger(seed) || seed < 0 || seed >= 2 ** 32) {
      return { name: "play", variant: second };
    }
    params.delete("seed");
    const options = Object.fromEntries(params);
    return Object.keys(options).length === 0
      ? { name: "play", variant: second, seed }
      : { name: "play", variant: second, seed, options };
  }
  if (first === "stats" || first === "gallery") {
    return { name: first };
  }
  return { name: "home" };
}

export function routeHash(route: Route): string {
  if (route.name === "play") {
    if (route.seed === undefined) {
      return `#/play/${route.variant}`;
    }
    const params = new URLSearchParams({ seed: String(route.seed), ...route.options });
    return `#/play/${route.variant}?${params.toString()}`;
  }
  return route.name === "home" ? "#/" : `#/${route.name}`;
}
