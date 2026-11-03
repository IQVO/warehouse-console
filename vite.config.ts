import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { federation } from "@module-federation/vite";
import { federationRemotes } from "./src/remotes-manifest.ts";

// warehouse-console: the shell. Owns routing, top nav, the site switcher,
// and the one cross-cutting screen no single bounded context owns (Order
// Lifecycle) -- everything else is lazy-loaded from a remote at runtime.
//
// The federation remotes map is DERIVED from src/remotes-manifest.json (the
// single source of truth for name/container, gateway path, dev port, route
// and label) -- see src/remotes-manifest.ts. That same manifest also
// generates the remote routes in src/App.tsx and the remote entries in
// scripts/verify-routes-list.cjs, so a remote is registered in exactly one
// place. Dev remote URLs match the port map already established in
// e2e-tests/env.sh's HTTP_PORT block, offset into the 51xx range (then the
// 40xx range once 5181..5197 filled) so the MFE dev servers never collide
// with each service's own 80xx Go API port when both run side by side on
// one machine.
// In the kind cluster the shell and every remote are served by nginx behind one
// web gateway on host :80, so a production build addresses each remote by its
// gateway path instead of its dev-server port. Kong is NOT in this path: it
// serves APIs only and must never handle HTML/JS/CSS.
//
// Kept as a plain object rather than the ({ command }) => ({...}) callback
// form on purpose: vitest.config.ts does mergeConfig(viteConfig, ...) and Vite
// throws "Cannot merge config in form of callback" on a function export, which
// breaks the whole test suite. Reading the command off process.argv keeps this
// a static object.
const IS_BUILD = process.argv.includes("build");

export default defineConfig({
  // The shell itself is served at the gateway root.
  base: "/",
  plugins: [
    react(),
    federation({
      name: "warehouse_console",
      // No federated type download. The host never consumes remote types:
      // src/shell/remoteComponents.ts imports every remote as
      // `// @ts-expect-error` + lazy(() => import("<name>/App")), and
      // tsconfig has no @mf-types paths. With dts on, the dev server tried
      // to fetch each remote's types archive and printed "Failed to
      // download types archive" for every remote (none publishes one: the
      // remotes set dts: false since their fix/mf-dts-type-001 PRs, e.g.
      // fulfillment-execution#210, facility-layout#192). If typed remotes
      // are ever needed, re-enable dts here AND in the remotes, then drop
      // the @ts-expect-error lines.
      dts: false,
      // Dev: each remote's own Vite server (localhost:<port>). Build: its
      // path behind the web gateway (/mfes/<path>/remoteEntry.js).
      remotes: federationRemotes(IS_BUILD),
      // The shell must win the React singleton negotiation. With the
      // default "version-first", every remote's remoteEntry is preloaded
      // and the highest semver react is picked; once a remote ships a newer
      // react than the shell (order-management / network-fulfillment
      // moved to 19.3.0) the shell's react-dom renders against another
      // bundle's react instance, whose dispatcher is null:
      // "Cannot read properties of null (reading 'useRef')" and a blank
      // console. "loaded-first" keeps the already-loaded host copy for
      // every singleton, so ONE React instance serves shell + all remotes.
      shareStrategy: "loaded-first",
      shared: {
        react: { singleton: true, requiredVersion: "^19.3.0" },
        "react-dom": { singleton: true, requiredVersion: "^19.3.0" },
        "react-router-dom": { singleton: true, requiredVersion: "^7.18.3" },
        "@warehouse/ui-kit": { singleton: true },
      },
    }),
  ],
  server: {
    port: 5173,
    strictPort: true,
    cors: true,
  },
  preview: {
    port: 5173,
    strictPort: true,
    cors: true,
  },
  build: {
    target: "esnext",
    modulePreload: false,
  },
});
