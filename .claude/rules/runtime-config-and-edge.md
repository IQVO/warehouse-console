---
paths:
  - "src/runtime-config.ts"
  - "src/runtime-config.test.ts"
  - "src/config.ts"
  - "src/config.test.ts"
  - "src/main.tsx"
  - "nginx.conf"
  - "Dockerfile"
  - "charts/**"
  - "public/**"
---
# Runtime configuration, packaging and the localhost edge

One image serves any environment. Nothing about the API location is baked in at
build time.

## Runtime config (`/config.json`)

- `src/runtime-config.ts` fetches `/config.json` (`{ "apiOrigin": "..." }`) BEFORE
  the app mounts, validates it fail-fast (missing, non-JSON, or path/query/
  credential-carrying origin stops the console with an explicit error) and
  publishes `window.__WAREHOUSE_CONFIG__`, which every remote also reads.
- `src/config.ts` builds every API base as `<apiOrigin>/api/<context>`. The
  per-service developer-port fallback applies only to a non-production build; a
  production build without `apiOrigin` throws on purpose (a silent fallback would
  point the console at nothing).
- `src/main.tsx` MUST import `./App` dynamically after `loadRuntimeConfig()`. A
  static import is hoisted, `config.ts` then reads an empty config at module
  scope and throws in production.
- The fetch also happens under `npm run dev` and no `config.json` is committed.
  Create an untracked `public/config.json` locally (`{ "apiOrigin":
  "http://localhost:8000" }`) or the dev server's HTML fallback makes the shell
  refuse to start with `Runtime configuration must be JSON, received "text/html"`.
  Never commit that file. Step by step: the `run-console-locally` skill.
- Helm: `runtimeConfig.apiOrigin` in `charts/warehouse-console/values.yaml`
  (default `http://localhost:8000`, i.e. Kong) is mounted as `/config.json` via a
  ConfigMap with `subPath`, which kubelet does NOT live-update, so the Deployment
  carries a `checksum/runtime-config` annotation to roll the pod on change. Keep it.

## nginx.conf

- `/config.json` is an exact-match location with `Cache-Control: no-store` and
  `try_files $uri =404`: it must never be cached nor fall through to the SPA
  fallback (that would return HTML with a 200 and a confusing JSON parse error).
- `/assets/` carries a single `Cache-Control` header with `max-age` inside
  `add_header`. Do not add an `expires` directive: it emits a second
  `Cache-Control` header.
- Unknown paths fall back to `index.html`, so the app's own client-side 404 renders
  rather than a server 404.

## The localhost edge is two independent gateways

`http://localhost` (Nginx web gateway) serves this shell and each remote at
`/mfes/<context>/`; `http://localhost:8000` (Kong) serves every API at
`/api/<context>`. Neither proxies to the other, and Kong never serves HTML/JS/CSS.
`apiOrigin` must be the Kong origin.

## Dockerfile and chart conventions

- The ui-kit is a sibling checkout supplied as a named build context:
  `docker build --build-context uikit=../warehouse-ui-kit -t warehouse/warehouse-console:local .`
- The Dockerfile deliberately does NOT install from `package-lock.json` (it was
  written by npm 10 on macOS and has no linux entries for Vite 8's native bindings;
  the build also strips the ui-kit's `node_modules` and lockfile). Do not "fix" it
  to `npm ci` without testing a linux image build.
- Runtime is `nginx-unprivileged` on 8080 with `readOnlyRootFilesystem: true`; the
  chart has no database/Kafka/OTel blocks (static SPA). `charts/warehouse-console/`
  matches the fleet's chart conventions only where they translate.
