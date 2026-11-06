import { useEffect, useState } from "react";
import type { IconName } from "../ui/icons.tsx";
import { Icon } from "../ui/icons.tsx";
import { formatTime } from "./format.ts";
import type { Timer } from "./useTimer.ts";

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

/** Re-renders once a second while the timer runs. */
function Clock({ timer }: { readonly timer: Timer }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      if (timer.running()) {
        setTick((tick) => tick + 1);
      }
    }, 1000);
    return () => {
      clearInterval(interval);
    };
  }, [timer]);
  return <span className="clock">{formatTime(timer.elapsed())}</span>;
}

interface StatusProps {
  readonly name: string;
  readonly score: number | undefined;
  readonly moves: number;
  readonly timer: Timer | undefined;
}

/** Variant name, score, moves and time above the table. */
export function GameStatus({ name, score, moves, timer }: StatusProps) {
  return (
    <div className="status">
      <h1 className="status-name">{name}</h1>
      {score === undefined ? undefined : <span>Score {score}</span>}
      <span>Moves {moves}</span>
      {timer === undefined ? undefined : <Clock timer={timer} />}
    </div>
  );
}
