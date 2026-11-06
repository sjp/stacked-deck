import { routeHash } from "./route.ts";

export type ShareResult = "shared" | "copied" | "failed";

/** A link that opens this exact deal. */
export function dealUrl(variant: string, seed: number): string {
  const { origin, pathname } = globalThis.location;
  return `${origin}${pathname}${routeHash({ name: "play", variant, seed })}`;
}

/** Shares text (and a link) with the Web Share API, or copies it to the clipboard. */
export async function shareText(text: string, url?: string): Promise<ShareResult> {
  const data = url === undefined ? { text } : { text, url };
  try {
    if (typeof navigator.share === "function" && navigator.canShare(data)) {
      await navigator.share(data);
      return "shared";
    }
    await navigator.clipboard.writeText(url === undefined ? text : `${text} ${url}`);
    return "copied";
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return "failed";
    }
    console.warn("Share failed", error);
    return "failed";
  }
}
