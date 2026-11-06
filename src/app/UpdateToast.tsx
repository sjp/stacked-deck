import { usePwa } from "./pwa.ts";

/** Offers a waiting update. It only applies when the player chooses to reload. */
export function UpdateToast() {
  const { update } = usePwa();
  if (update === undefined) {
    return undefined;
  }
  return (
    <output className="toast">
      <span>Update available</span>
      <button type="button" className="primary" onClick={update}>
        Reload
      </button>
    </output>
  );
}
