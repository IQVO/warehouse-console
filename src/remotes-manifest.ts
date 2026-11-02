/**
 * THE remotes manifest: the single source of truth for every warehouse MFE
 * remote this console mounts.
 *
 * The data lives in `remotes-manifest.json` (plain JSON so the plain-Node
 * `verify:routes` script can read the very same file without a build step)
 * and everything else is DERIVED from it:
 *
 *   - vite.config.ts  -> `federationRemotes()` (the Module Federation
 *                        remotes map: dev entries by port, build entries by
 *                        gateway path under /mfes/<path>/)
 *   - src/App.tsx     -> the `/<route>/*` route table and the route prefixes
 *                        that keep the "Contexts" nav item active
 *   - scripts/verify-routes-list.cjs -> one browser smoke-check entry per
 *                        remote for `npm run verify:routes`
 *   - src/shell/remoteComponents.ts  -> the only hand-maintained sibling:
 *                        static `import("<name>/App")` literals (Vite/MF
 *                        resolves import() at build time, so those cannot
 *                        be generated); src/remotes-manifest.test.tsx
 *                        fails if its keys ever drift from this manifest.
 *
 * Adding a remote = one entry here + one lazy import in remoteComponents.ts.
 * Dev ports match e2e-tests/env.sh's HTTP_PORT block, offset into the 51xx
 * range (then the 40xx range once 5181..5197 filled) so MFE dev servers
 * never collide with each service's own 80xx Go API port. In the kind
 * cluster the shell and every remote are served by nginx behind one web
 * gateway on host :80, so a production build addresses each remote by its
 * gateway path instead of its dev-server port. Kong is NOT in this path: it
 * serves APIs only and must never handle HTML/JS/CSS.
 */
import manifestJson from "./remotes-manifest.json" with { type: "json" };

export interface RemoteDefinition {
  /** Vite federation remotes key AND the shell's import specifier, e.g. "order_mgmt_mfe". */
  name: string;
  /** The remote's actual Module Federation container name when it differs from `name` (only netfulfil_mfe today). */
  container?: string;
  /** Gateway path segment (the remote repo's name), e.g. "order-management" -> /mfes/order-management/remoteEntry.js. */
  path: string;
  /** Local dev-server port, e.g. 5181 -> http://localhost:5181/remoteEntry.js. */
  port: number;
  /** Shell route prefix the remote is mounted under as a splat route, e.g. "/inventory". */
  route: string;
  /** Human label for RemoteBoundary's unavailable card and verify:routes logs. */
  label: string;
  /** Optional pinning note (dev-port ladder position, remote-repo contract). */
  note?: string;
}

/** Every registered remote, in route-registration order. */
export const REMOTES: readonly RemoteDefinition[] = Object.freeze(manifestJson);

/** Route prefixes of all remotes -- keeps the "Contexts" nav item lit. */
export const REMOTE_ROUTE_PREFIXES: readonly string[] = Object.freeze(
  REMOTES.map((remote) => remote.route),
);

/** Shape of one value in vite's `federation({ remotes })` map. */
export interface FederationRemoteEntry {
  type: "module";
  name: string;
  entry: string;
}

/**
 * Builds the Module Federation remotes map from the manifest.
 * Dev: each remote's own Vite server (localhost:<port>). Build: its path
 * behind the nginx web gateway (/mfes/<path>/).
 */
export function federationRemotes(isBuild: boolean): Record<string, FederationRemoteEntry> {
  const remotes: Record<string, FederationRemoteEntry> = {};
  for (const remote of REMOTES) {
    remotes[remote.name] = {
      type: "module",
      name: remote.container ?? remote.name,
      entry: isBuild
        ? `/mfes/${remote.path}/remoteEntry.js`
        : `http://localhost:${remote.port}/remoteEntry.js`,
    };
  }
  return remotes;
}
