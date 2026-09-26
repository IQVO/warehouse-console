import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { federation } from "@module-federation/vite";

// warehouse-console: the shell. Owns routing, top nav, the site switcher,
// and the one cross-cutting screen no single bounded context owns (Order
// Lifecycle) -- everything else is lazy-loaded from a remote at runtime.
//
// Local dev remote URLs match the port map already established in
// e2e-tests/env.sh's HTTP_PORT block, offset into the 51xx range so the
// six MFE dev servers never collide with each service's own 80xx Go API
// port when both are running side by side on one machine.
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

/** Dev: each remote's own Vite server. Build: its path behind the web gateway. */
function remoteEntry(context: string, devPort: number): string {
  return IS_BUILD
    ? `/mfes/${context}/remoteEntry.js`
    : `http://localhost:${devPort}/remoteEntry.js`;
}

export default defineConfig({
  // The shell itself is served at the gateway root.
  base: "/",
  plugins: [
    react(),
    federation({
      name: "warehouse_console",
      remotes: {
        order_mgmt_mfe: {
          type: "module",
          name: "order_mgmt_mfe",
          entry: remoteEntry("order-management", 5181),
        },
        inventory_mfe: {
          type: "module",
          name: "inventory_mfe",
          entry: remoteEntry("inventory-storage", 5182),
        },
        planning_mfe: {
          type: "module",
          name: "planning_mfe",
          entry: remoteEntry("wes-work-planning", 5183),
        },
        fulfillment_mfe: {
          type: "module",
          name: "fulfillment_mfe",
          entry: remoteEntry("fulfillment-execution", 5184),
        },
        workforce_mfe: {
          type: "module",
          name: "workforce_mfe",
          entry: remoteEntry("workforce-management", 5185),
        },
        facility_mfe: {
          type: "module",
          name: "facility_mfe",
          entry: remoteEntry("facility-layout", 5186),
        },
        process_path_mfe: {
          type: "module",
          name: "process_path_mfe",
          entry: remoteEntry("process-path-management", 5189),
        },
        labor_mfe: {
          type: "module",
          name: "labor_mfe",
          entry: remoteEntry("labor-performance", 5187),
        },
        network_fulfillment_mfe: {
          type: "module",
          name: "netfulfil_mfe",
          entry: remoteEntry("network-fulfillment", 5188),
        },
      },
      shared: {
        react: { singleton: true, requiredVersion: "^19.2.8" },
        "react-dom": { singleton: true, requiredVersion: "^19.2.8" },
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
