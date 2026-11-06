import { memo } from "react";
import type { Card } from "../engine/cards.ts";
import { rankLabel } from "../engine/cards.ts";
import { SuitShape } from "./suits.tsx";

/** Pip centres for 2–10 in the 100×140 card box; pips below the middle are drawn upside down. */
const L = 34;
const C = 50;
const R = 66;
const PIPS: Readonly<Record<number, readonly (readonly [number, number])[]>> = {
  2: [
    [C, 26],
    [C, 114],
  ],
  3: [
    [C, 26],
    [C, 70],
    [C, 114],
  ],
  4: [
    [L, 26],
    [R, 26],
    [L, 114],
    [R, 114],
  ],
  5: [
    [L, 26],
    [R, 26],
    [C, 70],
    [L, 114],
    [R, 114],
  ],
  6: [
    [L, 26],
    [R, 26],
    [L, 70],
    [R, 70],
    [L, 114],
    [R, 114],
  ],
  7: [
    [L, 26],
    [R, 26],
    [C, 48],
    [L, 70],
    [R, 70],
    [L, 114],
    [R, 114],
  ],
  8: [
    [L, 26],
    [R, 26],
    [C, 48],
    [L, 70],
    [R, 70],
    [C, 92],
    [L, 114],
    [R, 114],
  ],
  9: [
    [L, 26],
    [R, 26],
    [L, 55],
    [R, 55],
    [C, 70],
    [L, 85],
    [R, 85],
    [L, 114],
    [R, 114],
  ],
  10: [
    [L, 26],
    [R, 26],
    [C, 41],
    [L, 55],
    [R, 55],
    [L, 85],
    [R, 85],
    [C, 99],
    [L, 114],
    [R, 114],
  ],
};

type FaceProps = Pick<Card, "rank" | "suit">;

function CornerIndex({ rank, suit }: FaceProps) {
  return (
    <g>
      <text
        className="card-rank"
        x="13"
        y="25"
        fontSize="23"
        textAnchor="middle"
        {...(rank === 10 ? { textLength: 19, lengthAdjust: "spacingAndGlyphs" } : {})}
      >
        {rankLabel(rank)}
      </text>
      <SuitShape suit={suit} x={13} y={38} size={14} />
    </g>
  );
}

function Pips({ rank, suit }: FaceProps) {
  if (rank === 1) {
    return <SuitShape suit={suit} x={50} y={70} size={44} />;
  }
  if (rank > 10) {
    return (
      <g>
        <rect
          className="card-frame"
          x="25"
          y="17"
          width="50"
          height="106"
          rx="5"
          fill="none"
          stroke="currentColor"
        />
        <SuitShape suit={suit} x={50} y={42} size={22} />
        <text className="card-court" x="50" y="96" fontSize="44" textAnchor="middle">
          {rankLabel(rank)}
        </text>
      </g>
    );
  }
  return (
    <g>
      {(PIPS[rank] ?? []).map(([x, y]) => (
        <SuitShape key={`${x},${y}`} suit={suit} x={x} y={y} size={19} flip={y > 70} />
      ))}
    </g>
  );
}

/** The full face: corner indices, pips or a court letter. */
function FullFace({ rank, suit }: FaceProps) {
  return (
    <>
      <CornerIndex rank={rank} suit={suit} />
      <g transform="rotate(180 50 70)">
        <CornerIndex rank={rank} suit={suit} />
      </g>
      <Pips rank={rank} suit={suit} />
    </>
  );
}

/** For small cards: a large index across the top, which stays readable when fanned. */
function CompactFace({ rank, suit }: FaceProps) {
  return (
    <>
      <text className="card-rank" x="6" y="33" fontSize="38" textAnchor="start">
        {rankLabel(rank)}
      </text>
      <SuitShape suit={suit} x={79} y={20} size={28} />
      <SuitShape suit={suit} x={50} y={96} size={56} />
    </>
  );
}

interface CardFaceProps extends FaceProps {
  readonly compact: boolean;
}

export const CardFace = memo(function CardFace({ rank, suit, compact }: CardFaceProps) {
  return (
    <svg className="card-face" viewBox="0 0 100 140" aria-hidden="true">
      {compact ? <CompactFace rank={rank} suit={suit} /> : <FullFace rank={rank} suit={suit} />}
    </svg>
  );
});
