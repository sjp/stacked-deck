import { useEffect, useEffectEvent, useRef } from "react";
import type { Card } from "../engine/cards.ts";
import { rankLabel } from "../engine/cards.ts";
import { CARD_RATIO } from "./geometry.ts";
import { SUIT_PATHS } from "./suitPaths.ts";

interface Props {
  /** Cards to throw, in order. */
  readonly cards: readonly Card[];
  readonly onDone: () => void;
}

interface Flying {
  readonly image: HTMLCanvasElement;
  x: number;
  y: number;
  vx: number;
  vy: number;
  readonly trail: { x: number; y: number }[];
}

const GRAVITY = 1800;
const BOUNCE = 0.7;
const LAUNCH_EVERY = 0.22;
const MAX_FLYING = 5;
const TRAIL = 7;
const MAX_SECONDS = 30;

function cssColour(name: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value.length > 0 ? value : fallback;
}

/** Draws one card face into its own small canvas, so each frame only copies images. */
function renderCard(card: Card, width: number): HTMLCanvasElement {
  const height = Math.round(width * CARD_RATIO);
  const scale = globalThis.devicePixelRatio;
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(width * scale);
  canvas.height = Math.ceil(height * scale);
  const context = canvas.getContext("2d");
  if (context === null) {
    return canvas;
  }
  context.scale(scale, scale);
  const radius = width * 0.07;
  context.beginPath();
  context.roundRect(0.5, 0.5, width - 1, height - 1, radius);
  context.fillStyle = cssColour("--card-face", "#fff");
  context.fill();
  context.strokeStyle = "rgb(0 0 0 / 0.3)";
  context.stroke();

  const colour = cssColour(`--suit-${card.suit}`, "#000");
  context.fillStyle = colour;
  context.font = `700 ${Math.round(width * 0.3)}px Georgia, serif`;
  context.textBaseline = "top";
  context.fillText(rankLabel(card.rank), width * 0.07, width * 0.07);

  const drawSuit = (cx: number, cy: number, size: number) => {
    context.save();
    context.translate(cx - size / 2, cy - size / 2);
    context.scale(size / 100, size / 100);
    for (const d of SUIT_PATHS[card.suit]) {
      // This is CanvasRenderingContext2D.fill, not Array.prototype.fill.
      // oxlint-disable-next-line unicorn/no-array-fill-with-reference-type
      context.fill(new Path2D(d));
    }
    context.restore();
  };
  drawSuit(width * 0.78, width * 0.2, width * 0.26);
  drawSuit(width / 2, height * 0.62, width * 0.5);
  return canvas;
}

/**
 * A win celebration: cards leap off the foundations and bounce across the screen, each
 * trailing a few fading echoes. Tapping anywhere skips it.
 */
export function WinAnimation({ cards, onDone }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const finish = useEffectEvent(() => {
    onDone();
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (canvas === null || context === null || context === undefined) {
      finish();
      return undefined;
    }
    const scale = globalThis.devicePixelRatio;
    const width = globalThis.innerWidth;
    const height = globalThis.innerHeight;
    canvas.width = Math.ceil(width * scale);
    canvas.height = Math.ceil(height * scale);
    context.scale(scale, scale);

    const origins = [...document.querySelectorAll('.pile-base[data-kind="foundation"]')].map(
      (element) => element.getBoundingClientRect(),
    );
    const cardWidth = origins[0]?.width ?? 72;
    const cardHeight = Math.round(cardWidth * CARD_RATIO);
    const queue = [...cards];
    const flying: Flying[] = [];
    let launched = 0;
    let sinceLaunch = LAUNCH_EVERY;
    let elapsed = 0;
    let last = performance.now();
    let frame = 0;

    const launch = () => {
      const card = queue.shift();
      if (card === undefined) {
        return;
      }
      const origin = origins[launched % Math.max(1, origins.length)];
      launched += 1;
      const direction = Math.random() < 0.5 ? -1 : 1;
      const speed = (0.6 + Math.random()) * Math.max(220, width * 0.3);
      flying.push({
        image: renderCard(card, cardWidth),
        x: origin?.left ?? width / 2,
        y: origin?.top ?? 0,
        vx: direction * speed,
        vy: -Math.random() * 700,
        trail: [],
      });
    };

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      elapsed += dt;
      sinceLaunch += dt;
      if (sinceLaunch >= LAUNCH_EVERY && flying.length < MAX_FLYING && queue.length > 0) {
        sinceLaunch = 0;
        launch();
      }

      context.clearRect(0, 0, width, height);
      for (let i = flying.length - 1; i >= 0; i--) {
        const card = flying[i];
        if (card === undefined) {
          continue;
        }
        card.vy += GRAVITY * dt;
        card.x += card.vx * dt;
        card.y += card.vy * dt;
        if (card.y + cardHeight > height) {
          card.y = height - cardHeight;
          card.vy = -card.vy * BOUNCE;
        }
        card.trail.push({ x: card.x, y: card.y });
        if (card.trail.length > TRAIL) {
          card.trail.shift();
        }
        card.trail.forEach((point, index) => {
          context.globalAlpha = ((index + 1) / (TRAIL + 1)) * 0.5;
          context.drawImage(card.image, point.x, point.y, cardWidth, cardHeight);
        });
        context.globalAlpha = 1;
        context.drawImage(card.image, card.x, card.y, cardWidth, cardHeight);
        if (card.x > width || card.x + cardWidth < 0) {
          flying.splice(i, 1);
        }
      }

      if ((queue.length === 0 && flying.length === 0) || elapsed > MAX_SECONDS) {
        finish();
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    // Stop when the tab is hidden rather than resuming later.
    const onHidden = () => {
      if (document.visibilityState === "hidden") {
        finish();
      }
    };
    document.addEventListener("visibilitychange", onHidden);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", onHidden);
    };
  }, [cards]);

  return (
    <canvas
      ref={canvasRef}
      className="win-canvas"
      aria-hidden="true"
      onPointerDown={() => {
        onDone();
      }}
    />
  );
}
