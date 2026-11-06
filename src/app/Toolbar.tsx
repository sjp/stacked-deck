import type { IconName } from "../ui/icons.tsx";
import { Icon } from "../ui/icons.tsx";

export interface ToolAction {
  readonly icon: IconName;
  readonly label: string;
  readonly onClick: () => void;
  readonly disabled?: boolean;
  readonly pressed?: boolean;
}

/** The game's command bar: at the bottom on phones in portrait, at the top elsewhere. */
export function Toolbar({ actions }: { readonly actions: readonly ToolAction[] }) {
  return (
    <nav className="toolbar" aria-label="Game">
      {actions.map((action) => (
        <button
          key={action.label}
          type="button"
          className="tool"
          aria-label={action.label}
          title={action.label}
          disabled={action.disabled === true}
          {...(action.pressed === undefined ? {} : { "aria-pressed": action.pressed })}
          onClick={action.onClick}
        >
          <Icon name={action.icon} />
          <span className="tool-label">{action.label}</span>
        </button>
      ))}
    </nav>
  );
}
