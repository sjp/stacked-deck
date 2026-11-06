# Stacked Deck

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

## Code layout

```text
src/
  engine/        game rules in plain TypeScript, with no React or DOM
    variants/    one folder per game, each implementing the Variant interface
  ui/            table, cards and pointer/keyboard interaction
  app/           screens, settings, storage, stats, daily deals, solver worker
  styles/        CSS, with theme colours as custom properties
scripts/         Node scripts
```

Every deal comes from a 32-bit seed (`#/play/klondike?seed=123` opens one). The engine is
pure: `applyMove(state, move)` returns a new state, and games are saved as the seed plus the
moves made.

## Winnable deal lists

Some option sets are too slow to solve on a phone, so a list of deals the solver has won
ships in `src/engine/winnableSeeds.ts`. Regenerate it with:

```sh
node scripts/find-winnable.ts
```

Use `--only <key>` (such as `spider:suits=2`) to search one option set and print the result,
and `--write` to merge printed results into the file.

## Deploying

Pushing to `main` deploys the site to GitHub Pages: `.github/workflows/deploy.yml` runs
`npm run check`, `npm test` and `npm run build`, then publishes `dist/`. The build uses a
relative base path, so it works from a project subpath. `.github/workflows/ci.yml` runs the
same checks on every push and pull request, and Dependabot keeps npm packages and action
versions up to date.

The built `index.html` carries a Content-Security-Policy `<meta>` tag, since Pages can't send
headers. It is added at build time only (see `vite.config.ts`), because the dev server needs
an inline script and a websocket that the policy forbids.
