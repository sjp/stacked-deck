import { useState } from "react";
import { VARIANTS } from "../engine/variants/index.ts";
import { dailyStreak, dateKey, monthGrid } from "./daily.ts";
import { loadDailyResults } from "./dailyStore.ts";
import { dailySeed } from "./deals.ts";
import { formatTime } from "./format.ts";
import { routeHash } from "./route.ts";
import { navigate } from "./useRoute.ts";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

interface CalendarProps {
  readonly now: Date;
  readonly today: string;
  readonly wonDays: ReadonlySet<string>;
}

function Calendar({ now, today, wonDays }: CalendarProps) {
  const weeks = monthGrid(now.getFullYear(), now.getMonth());
  const title = now.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  return (
    <table className="calendar">
      <caption>{title}</caption>
      <thead>
        <tr>
          {WEEKDAYS.map((day) => (
            <th key={day} scope="col">
              {day}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {weeks.map((week) => (
          <tr key={week.find((day) => day !== undefined) ?? "blank"}>
            {week.some((day) => day === undefined) ? (
              <td colSpan={week.filter((day) => day === undefined).length} aria-hidden="true" />
            ) : undefined}
            {week.map((day) => {
              if (day === undefined) {
                return undefined;
              }
              const won = wonDays.has(day);
              const className = [won && "won", day === today && "today"].filter(Boolean).join(" ");
              return (
                <td key={day} className={className}>
                  <span aria-label={won ? `${day}, won` : day}>{Number(day.slice(-2))}</span>
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Today's deal for each game, the same for everyone, with a streak of days won. */
export function DailyScreen() {
  // Fixed when the screen opens, so a deal doesn't change under the player at midnight.
  const [now] = useState(() => new Date());
  const today = dateKey(now);
  const [results] = useState(loadDailyResults);
  const [opening, setOpening] = useState<string>();
  const wonDays = new Set(
    Object.keys(results).filter((day) => Object.keys(results[day] ?? {}).length > 0),
  );
  const streak = dailyStreak(wonDays, today);

  const open = async (variantId: string) => {
    const variant = VARIANTS.find((item) => item.id === variantId);
    if (variant === undefined) {
      return;
    }
    setOpening(variantId);
    const seed = await dailySeed(variant, today);
    navigate({ name: "play", variant: variantId, seed, daily: today });
  };

  return (
    <main className="page">
      <header className="page-header">
        <a className="button" href={routeHash({ name: "home" })}>
          ← Games
        </a>
        <h1>Daily deals</h1>
      </header>
      <p>
        {now.toLocaleDateString(undefined, {
          weekday: "long",
          day: "numeric",
          month: "long",
        })}
        {" · "}
        {streak === 0 ? "No streak yet" : streak === 1 ? "1-day streak" : `${streak}-day streak`}
      </p>
      <ul className="daily-list">
        {VARIANTS.map((variant) => {
          const result = results[today]?.[variant.id];
          return (
            <li key={variant.id} className="daily-item">
              <span className="variant-name">{variant.name}</span>
              <span className="daily-status">
                {result === undefined
                  ? "Not won yet"
                  : `Won in ${formatTime(result.elapsedMs)}, ${result.moves} moves`}
              </span>
              <button
                type="button"
                className={result === undefined ? "primary" : "button"}
                disabled={opening !== undefined}
                onClick={() => {
                  void open(variant.id);
                }}
              >
                {opening === variant.id ? "Dealing…" : result === undefined ? "Play" : "Play again"}
              </button>
            </li>
          );
        })}
      </ul>
      <Calendar now={now} today={today} wonDays={wonDays} />
    </main>
  );
}
