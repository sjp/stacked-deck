import react from "@vitejs/plugin-react";
import type { Plugin } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import { configDefaults, defineConfig } from "vitest/config";

/**
 * Content-Security-Policy for the built site. GitHub Pages can't send headers, so it
 * goes in a <meta> tag (which can't express frame-ancestors, report-uri or sandbox).
 * The build has no inline scripts and no data: or blob: subresources.
 * 'unsafe-inline' in style-src covers React's inline style attributes.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join("; ");

/**
 * Injects the CSP at build time only. The dev server needs an inline script (the React
 * Refresh preamble) and a websocket for HMR, which the production policy forbids.
 */
function contentSecurityPolicy(): Plugin {
  return {
    name: "content-security-policy",
    apply: "build",
    transformIndexHtml: () => [
      {
        tag: "meta",
        attrs: { "http-equiv": "Content-Security-Policy", content: CSP },
        injectTo: "head-prepend",
      },
    ],
  };
}

// https://vite.dev/config/
export default defineConfig({
  // Relative base so the build works when served from a GitHub Pages
  // project subpath (https://<user>.github.io/<repo>/).
  base: "./",
  plugins: [
    react(),
    contentSecurityPolicy(),
    VitePWA({
      // Ask before activating a new version, so an update never interrupts a game.
      registerType: "prompt",
      // main.tsx registers the service worker; an inline script would break the CSP.
      injectRegister: false,
      includeAssets: ["favicon.svg", "favicon.ico", "apple-touch-icon-180x180.png"],
      manifest: {
        name: "Stacked Deck",
        short_name: "Stacked Deck",
        description:
          "Solitaire card games: Klondike, Spider, FreeCell, Pyramid, TriPeaks and Golf.",
        start_url: "./",
        scope: "./",
        display: "standalone",
        orientation: "any",
        background_color: "#0c1410",
        theme_color: "#133a26",
        categories: ["games"],
        icons: [
          { src: "pwa-64x64.png", sizes: "64x64", type: "image/png" },
          { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
          {
            src: "maskable-icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: { globPatterns: ["**/*.{js,css,html,svg,png,ico,webmanifest}"] },
    }),
  ],
  // Agent worktrees live under .claude/; keep their copies of the tests out of the run.
  test: {
    exclude: [...configDefaults.exclude, "**/.claude/**"],
    // Tests run in node; files that need a DOM opt in with `@vitest-environment happy-dom`.
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.test.{ts,tsx}", "src/**/testing.ts", "src/engine/winnableSeeds.ts"],
      reporter: ["text-summary", "text"],
    },
  },
});
