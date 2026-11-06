# Stacked Deck

[![CI](https://github.com/sjp/stacked-deck/actions/workflows/ci.yml/badge.svg)](https://github.com/sjp/stacked-deck/actions/workflows/ci.yml)
[![Deploy](https://github.com/sjp/stacked-deck/actions/workflows/deploy.yml/badge.svg)](https://github.com/sjp/stacked-deck/actions/workflows/deploy.yml)

Solitaire card games for phones and desktop: Klondike, Spider, FreeCell, Pyramid, TriPeaks
and Golf. Installable as an app and playable offline.

**Try it: <https://sjp.github.io/stacked-deck/>**

## Features

- Six games: Klondike (Draw 1 or 3), Spider (1, 2 or 4 suits), FreeCell, Pyramid, TriPeaks
  and Golf.
- Winnable deals by default, checked by a solver, with a setting for fully random deals.
- A daily deal for each game, the same for everyone, with a streak and calendar.
- Undo and redo, hints, auto-complete, score, timer and per-game statistics.
- Drag, tap-to-move (with smart tap) or keyboard play; screen-reader labels and
  announcements.
- Light and dark themes, a four-colour deck, card backs, optional sound effects and haptics.
- Installable and playable offline. Games are saved as you play.

## Running it

Use Node 26 (the version is in `.nvmrc`; the devcontainer already has it).

```sh
npm install
npm run dev      # dev server with hot reload
npm run build    # type-check and build to dist/
npm run preview  # serve the built dist/
npm run check    # oxlint, oxfmt --check and tsc
npm run fmt      # format with oxfmt
npm test         # vitest
```
