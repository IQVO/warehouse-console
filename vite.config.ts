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
      // No federated type download. The host never consumes remote types:
      // src/App.tsx imports every remote as `// @ts-expect-error` +
      // lazy(() => import("<name>/App")), and tsconfig has no @mf-types
      // paths. With dts on, the dev server tried to fetch each remote's
      // types archive and printed "Failed to download types archive" for
      // every remote (none publishes one: the remotes set dts: false since
      // their fix/mf-dts-type-001 PRs, e.g. fulfillment-execution#210,
      // facility-layout#192). If typed remotes are ever needed, re-enable
      // dts here AND in the remotes, then drop the @ts-expect-error lines.
      dts: false,
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
        // warehouse-planning's remote: container `capacity_mfe` (NOT
        // `planning_mfe`, which is wes-work-planning's), exposes ./App only.
        capacity_mfe: {
          type: "module",
          name: "capacity_mfe",
          entry: remoteEntry("warehouse-planning", 5190),
        },
        // product-master's remote: container `productmaster_mfe`, exposes
        // ./App only (no props, relative routes), mounted on /product-master/*.
        // Pinned with IQVO/product-master web/vite.config.ts: gateway path
        // /mfes/product-master/, dev port 5191.
        productmaster_mfe: {
          type: "module",
          name: "productmaster_mfe",
          entry: remoteEntry("product-master", 5191),
        },
        // network-inventory-planning's remote: container `nip_mfe`, exposes
        // ./App only (no props, relative routes), mounted on
        // /network-inventory/*. Pinned with IQVO/network-inventory-planning
        // web/vite.config.ts: gateway path /mfes/network-inventory-planning/,
        // dev port 5192.
        nip_mfe: {
          type: "module",
          name: "nip_mfe",
          entry: remoteEntry("network-inventory-planning", 5192),
        },
        // inbound-receiving's remote: container `inbound_mfe`, exposes
        // ./App only (no props, relative routes), mounted on
        // /inbound-receiving/*. Pinned with IQVO/inbound-receiving
        // web/vite.config.ts: gateway path /mfes/inbound-receiving/, dev
        // port 5193.
        inbound_mfe: {
          type: "module",
          name: "inbound_mfe",
          entry: remoteEntry("inbound-receiving", 5193),
        },
        // slotting-optimization's remote: container `slotting_mfe`, exposes
        // ./App only, mounted on /slotting/*. Pinned with
        // IQVO/slotting-optimization web/vite.config.ts: gateway path
        // /mfes/slotting-optimization/, dev port 5194.
        slotting_mfe: {
          type: "module",
          name: "slotting_mfe",
          entry: remoteEntry("slotting-optimization", 5194),
        },
        // pick-face-replenishment's remote: container `replenishment_mfe`
        // (the key and name match; the repo name differs), exposes ./App
        // only, mounted on /pick-face-replenishment/*. Pinned with
        // IQVO/pick-face-replenishment web/vite.config.ts: gateway path
        // /mfes/pick-face-replenishment/, dev port 5196.
        replenishment_mfe: {
          type: "module",
          name: "replenishment_mfe",
          entry: remoteEntry("pick-face-replenishment", 5196),
        },
        // task-interleaving's remote: container `task_interleaving_mfe`,
        // exposes ./App only, mounted on /task-interleaving/*. Pinned with
        // IQVO/task-interleaving web/vite.config.ts: gateway path
        // /mfes/task-interleaving/, dev port 5197.
        task_interleaving_mfe: {
          type: "module",
          name: "task_interleaving_mfe",
          entry: remoteEntry("task-interleaving", 5197),
        },
        // returns-processing's remote: container `returns_mfe`, exposes
        // ./App only, mounted on /returns-processing/*. Pinned with
        // IQVO/returns-processing web/vite.config.ts: gateway path
        // /mfes/returns-processing/, dev port 4010 (deliberately OFF the
        // 51xx ladder -- every 5181..5197 slot is taken; the remote repo
        // pinned 4010 as free).
        returns_mfe: {
          type: "module",
          name: "returns_mfe",
          entry: remoteEntry("returns-processing", 4010),
        },
        // exception-management's remote: container `exceptions_mfe`,
        // exposes ./App only, mounted on /exception-management/*. Pinned
        // with IQVO/exception-management web/vite.config.ts: gateway path
        // /mfes/exception-management/, dev port 4011 (off the 51xx ladder
        // like returns_mfe's 4010).
        exceptions_mfe: {
          type: "module",
          name: "exceptions_mfe",
          entry: remoteEntry("exception-management", 4011),
        },
        // customer-ordering's remote: container `customer_ordering_mfe`, gateway path
        // /mfes/customer-ordering/, dev port 4012 (off the 51xx ladder,
        // continuing the 40xx series).
        customer_ordering_mfe: {
          type: "module",
          name: "customer_ordering_mfe",
          entry: remoteEntry("customer-ordering", 4012),
        },
        // delivery-promise's remote: container `delivery_promise_mfe`, gateway path
        // /mfes/delivery-promise/, dev port 4013 (off the 51xx ladder,
        // continuing the 40xx series).
        delivery_promise_mfe: {
          type: "module",
          name: "delivery_promise_mfe",
          entry: remoteEntry("delivery-promise", 4013),
        },
        // last-mile-delivery's remote: container `last_mile_mfe`, gateway path
        // /mfes/last-mile-delivery/, dev port 4014 (off the 51xx ladder,
        // continuing the 40xx series).
        last_mile_mfe: {
          type: "module",
          name: "last_mile_mfe",
          entry: remoteEntry("last-mile-delivery", 4014),
        },
        // linehaul-transportation's remote: container `linehaul_mfe`, gateway path
        // /mfes/linehaul-transportation/, dev port 4015 (off the 51xx ladder,
        // continuing the 40xx series).
        linehaul_mfe: {
          type: "module",
          name: "linehaul_mfe",
          entry: remoteEntry("linehaul-transportation", 4015),
        },
        // node-performance's remote: container `node_performance_mfe`, gateway path
        // /mfes/node-performance/, dev port 4016 (off the 51xx ladder,
        // continuing the 40xx series).
        node_performance_mfe: {
          type: "module",
          name: "node_performance_mfe",
          entry: remoteEntry("node-performance", 4016),
        },
        // node-topology's remote: container `node_topology_mfe`, gateway path
        // /mfes/node-topology/, dev port 4017 (off the 51xx ladder,
        // continuing the 40xx series).
        node_topology_mfe: {
          type: "module",
          name: "node_topology_mfe",
          entry: remoteEntry("node-topology", 4017),
        },
        // offer-availability's remote: container `offer_availability_mfe`, gateway path
        // /mfes/offer-availability/, dev port 4018 (off the 51xx ladder,
        // continuing the 40xx series).
        offer_availability_mfe: {
          type: "module",
          name: "offer_availability_mfe",
          entry: remoteEntry("offer-availability", 4018),
        },
        // order-sourcing's remote: container `order_sourcing_mfe`, gateway path
        // /mfes/order-sourcing/, dev port 4019 (off the 51xx ladder,
        // continuing the 40xx series).
        order_sourcing_mfe: {
          type: "module",
          name: "order_sourcing_mfe",
          entry: remoteEntry("order-sourcing", 4019),
        },
        // shipping-and-tracking's remote: container `shipping_mfe`, gateway path
        // /mfes/shipping-and-tracking/, dev port 4020 (off the 51xx ladder,
        // continuing the 40xx series).
        shipping_mfe: {
          type: "module",
          name: "shipping_mfe",
          entry: remoteEntry("shipping-and-tracking", 4020),
        },
        // vendor-connectivity's remote: container `vendor_connectivity_mfe`, gateway path
        // /mfes/vendor-connectivity/, dev port 4021 (off the 51xx ladder,
        // continuing the 40xx series).
        vendor_connectivity_mfe: {
          type: "module",
          name: "vendor_connectivity_mfe",
          entry: remoteEntry("vendor-connectivity", 4021),
        },
        // seller-inbound's remote: container `seller_inbound_mfe`, gateway path
        // /mfes/seller-inbound/, dev port 4022 (off the fully-taken 51xx ladder,
        // continuing the 40xx series after vendor-connectivity's 4021).
        seller_inbound_mfe: {
          type: "module",
          name: "seller_inbound_mfe",
          entry: remoteEntry("seller-inbound", 4022),
        },
      },
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
