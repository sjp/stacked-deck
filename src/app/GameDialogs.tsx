import type { ComponentProps } from "react";
import type { Card } from "../engine/cards.ts";
import { WinAnimation } from "../ui/WinAnimation.tsx";
import type { WinPhase } from "./celebration.ts";
import { SettingsDialog } from "./SettingsDialog.tsx";
import type { WinSummary } from "./WinDialog.tsx";
import { WinDialog } from "./WinDialog.tsx";

interface Props {
  readonly settings: ComponentProps<typeof SettingsDialog>;
  readonly win: {
    readonly phase: WinPhase | undefined;
    readonly cards: readonly Card[];
    readonly summary: WinSummary | undefined;
    readonly onPhase: (phase: WinPhase) => void;
    readonly onNewGame: () => void;
  };
}

/** The game screen's overlays: settings, the win celebration and the win summary. */
export function GameDialogs({ settings, win }: Props) {
  return (
    <>
      <SettingsDialog {...settings} />
      {win.phase === "animating" ? (
        <WinAnimation
          cards={win.cards}
          onDone={() => {
            win.onPhase("dialog");
          }}
        />
      ) : undefined}
      <WinDialog
        summary={win.phase === "dialog" ? win.summary : undefined}
        onNewGame={win.onNewGame}
        onClose={() => {
          win.onPhase("closed");
        }}
      />
    </>
  );
}
