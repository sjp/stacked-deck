# Stacked Deck

TODO

**Try it: <https://sjp.github.io/stacked-deck/>**

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

## Deploying

Pushing to `main` deploys the site to GitHub Pages: `.github/workflows/deploy.yml` runs
`npm run check`, `npm test` and `npm run build`, then publishes `dist/`. The build uses a
relative base path, so it works from a project subpath. `.github/workflows/ci.yml` runs the
same checks on every push and pull request, and Dependabot keeps npm packages and action
versions up to date.

The built `index.html` carries a Content-Security-Policy `<meta>` tag, since Pages can't send
headers. It is added at build time only (see `vite.config.ts`), because the dev server needs
an inline script and a websocket that the policy forbids.