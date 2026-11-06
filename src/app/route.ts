export type Route =
  | { readonly name: "home" }
  | {
      readonly name: "play";
      readonly variant: string;
      readonly seed?: number;
      /** The date of a daily deal, which always comes with its seed. */
      readonly daily?: string;
    }
  | { readonly name: "daily" }
  | { readonly name: "stats" }
  | { readonly name: "gallery" };

/** Parses a location hash such as "#/play/klondike?seed=123". */
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
    const daily = params.get("daily");
    return daily !== null && /^\d{4}-\d{2}-\d{2}$/u.test(daily)
      ? { name: "play", variant: second, seed, daily }
      : { name: "play", variant: second, seed };
  }
  if (first === "daily" || first === "stats" || first === "gallery") {
    return { name: first };
  }
  return { name: "home" };
}

export function routeHash(route: Route): string {
  if (route.name === "play") {
    if (route.seed === undefined) {
      return `#/play/${route.variant}`;
    }
    const daily = route.daily === undefined ? "" : `&daily=${route.daily}`;
    return `#/play/${route.variant}?seed=${route.seed}${daily}`;
  }
  return route.name === "home" ? "#/" : `#/${route.name}`;
}
