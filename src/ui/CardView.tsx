import { memo } from "react";
import type { Card } from "../engine/cards.ts";
import { CardFace } from "./CardFace.tsx";

interface CardViewProps {
  readonly card: Card;
  /** Show only a large index, for small cards. */
  readonly compact: boolean;
}

/** One card, face up or down. It fills its container; the table sets the size. */
export const CardView = memo(function CardView({ card, compact }: CardViewProps) {
  if (!card.faceUp) {
    return <span className="card card-back" />;
  }
  return (
    <span className={`card card-front suit-${card.suit}`}>
      <CardFace rank={card.rank} suit={card.suit} compact={compact} />
    </span>
  );
});
