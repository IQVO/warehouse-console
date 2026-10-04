import { fileURLToPath } from "node:url";
import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config.ts";

// Reuses the app's own Vite config (React plugin, etc.) rather than
// duplicating it -- Module Federation's plugin is harmless under vitest
// (it never triggers a remote fetch in a test run), so no override is
// needed to strip it out. The federated remotes themselves are never
// imported by the units under test.
export default mergeConfig(
  viteConfig,
  defineConfig({
    resolve: {
      // @warehouse/ui-kit is consumed via `file:../warehouse-ui-kit` and has
      // its own installed react/react-dom (declared as peerDependencies but
      // still present in its own node_modules). Module Federation's
      // `shared: { singleton: true }` resolves this at build/runtime, but
      // vitest never goes through that MF resolution -- without dedupe,
      // ui-kit's useFetch calls React.useState against a SEPARATE React
      // module instance than the one rendering the test tree, producing
      // "Invalid hook call" / "Cannot read properties of null".
      dedupe: ["react", "react-dom"],
      // Federated remotes (`<name>_mfe/App`) only exist at runtime, so Vite's
      // import analysis cannot resolve them when a test imports src/App.tsx.
      // Point them at a stub that throws on evaluation: the lazy() import then
      // rejects exactly as a remote that is down would, which is the case
      // RemoteBoundary handles and src/App.test.tsx asserts.
      alias: [
        {
          find: /^[a-z_]+_mfe\/App$/,
          replacement: fileURLToPath(new URL("./src/test/remoteUnavailable.ts", import.meta.url)),
        },
      ],
    },
    test: {
      environment: "jsdom",
      globals: true,
      setupFiles: ["./src/test/setup.ts"],
      css: false,
      include: ["src/**/*.test.{ts,tsx}"],
    },
  }),
);
