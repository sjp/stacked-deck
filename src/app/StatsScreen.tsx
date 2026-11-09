import { useState } from "react";
import { VARIANTS } from "../engine/variants/index.ts";
import { Dialog } from "../ui/Dialog.tsx";
import { formatTime } from "./format.ts";
import { routeHash } from "./route.ts";
import type { StatsRecord } from "./stats.ts";
import { averageWinMs, winRate } from "./stats.ts";
import { loadStats, resetStats } from "./statsStore.ts";

const time = (ms: number | undefined) => (ms === undefined ? "—" : formatTime(ms));
const number = (value: number | undefined) => (value === undefined ? "—" : String(value));

/** "klondike:draw=3" → "Klondike · Draw 3". */
function describeKey(key: string): string {
  const [id, ...parts] = key.split(":");
  const variant = VARIANTS.find((item) => item.id === id);
  if (variant === undefined) {
    return key;
  }
  const options = parts.map((part) => {
    const [name, value] = part.split("=");
    const spec = variant.optionSpecs.find((item) => item.key === name);
    const choice = spec?.choices.find((item) => String(item.value) === value);
    return choice?.label ?? part;
  });
  return [variant.name, ...options].join(" · ");
}

function Row({ name, record }: { readonly name: string; readonly record: StatsRecord }) {
  return (
    <tr>
      <th scope="row">{name}</th>
      <td>{record.played}</td>
      <td>{record.won}</td>
      <td>{Math.round(winRate(record) * 100)}%</td>
      <td>{record.streak}</td>
      <td>{record.bestStreak}</td>
      <td>{time(record.bestTimeMs)}</td>
      <td>{time(averageWinMs(record))}</td>
      <td>{number(record.bestScore)}</td>
      <td>{number(record.fewestMoves)}</td>
    </tr>
  );
}

export function StatsScreen() {
  const [stats, setStats] = useState(loadStats);
  const [confirming, setConfirming] = useState(false);
  const rows = Object.entries(stats).toSorted(([a], [b]) => a.localeCompare(b));

  return (
    <main className="page">
      <header className="page-header">
        <a className="button" href={routeHash({ name: "home" })}>
          ← Games
        </a>
        <h1>Statistics</h1>
      </header>
      {rows.length === 0 ? (
        <p className="empty">No games finished yet.</p>
      ) : (
        // Focusable so keyboard users can scroll it sideways on narrow screens (a scrolling
        // region needs to be, though the lint rule doesn't know that).
        // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex
        <section className="table-scroll" tabIndex={0} aria-label="Statistics by game">
          <table className="stats-table">
            <thead>
              <tr>
                <th scope="col">Game</th>
                <th scope="col">Played</th>
                <th scope="col">Won</th>
                <th scope="col">Win %</th>
                <th scope="col">Streak</th>
                <th scope="col">Best streak</th>
                <th scope="col">Best time</th>
                <th scope="col">Average time</th>
                <th scope="col">Best score</th>
                <th scope="col">Fewest moves</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([key, record]) => (
                <Row key={key} name={describeKey(key)} record={record} />
              ))}
            </tbody>
          </table>
        </section>
      )}
      <p className="note">
        Games left unfinished aren&apos;t counted, but they end the current streak.
      </p>
      <button
        type="button"
        className="button"
        disabled={rows.length === 0}
        onClick={() => {
          setConfirming(true);
        }}
      >
        Reset stats
      </button>
      <Dialog
        open={confirming}
        title="Reset statistics?"
        onClose={() => {
          setConfirming(false);
        }}
      >
        <p>This clears every game&apos;s results. It can&apos;t be undone.</p>
        <div className="dialog-actions">
          <button
            type="button"
            className="primary danger"
            onClick={() => {
              resetStats();
              setStats({});
              setConfirming(false);
            }}
          >
            Reset
          </button>
          <button
            type="button"
            className="button"
            onClick={() => {
              setConfirming(false);
            }}
          >
            Cancel
          </button>
        </div>
      </Dialog>
    </main>
  );
}
