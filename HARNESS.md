# HARNESS.md — warehouse-console

What agent harness this repo has, what each piece runs, and when. Model (from
`warehouse-harness-template`, after Böckeler, "Harness engineering for coding agent users"):
**guides** steer an agent before it acts (feedforward), **sensors** report after it acts (feedback);
each is **computational** (deterministic) or **inferential** (LLM). This is the React/Vite shell of
the micro-frontend fleet, not a Go bounded context: there is no coverage gate, arch-test, bdd,
mutation, api-lint or docs-api-drift here. Only what is listed below exists.

harness-template: v4

## Guides (feedforward)

| File | Type | Purpose |
|---|---|---|
| `CLAUDE.md` (`AGENTS.md` is a symlink to it) | computational | Entry point: what the shell owns, the non-negotiable architecture, runtime config, commands, definition of done. |
| `.claude/rules/mfe-remotes.md` | computational | Scoped to `vite.config.ts`, `src/App.tsx`, `src/shell/**`: Module Federation remotes and routing. |
| `.claude/rules/cross-cutting-screens.md` | computational | Scoped to `src/features/**`, styles, tests: shell-owned screens on the ui-kit. |
| `.claude/rules/runtime-config-and-edge.md` | computational | Scoped to the runtime-config files, `src/main.tsx`, `nginx.conf`, `Dockerfile`, `charts/**`, `public/**`: one image for every environment, `/config.json`, the localhost edge. |
| `.claude/rules/fleet/readme-standard.md` | computational | Fleet README standard (copied from the template). |
| `.claude/skills/*/SKILL.md` | inferential | Register a remote, add a screen, run the console locally. |
| `.claude/agents/*.md` | inferential | `code-review`, `architecture-review`, `domain-review` subagents (template-managed). |
| `.claude/memory/MEMORY.md` | computational | Durable repo heuristics that are not incidents. |
| `INCIDENTS.md` | computational | Fleet incident log: every escape with its fix and the sensor that now guards it. |

## Sensors (feedback)

All jobs below are in `.github/workflows/ci.yml` (PR and push to develop/main) unless named otherwise.

| Sensor | What it runs | Lifecycle | Blocking? |
|---|---|---|---|
| `lint` | `npm run lint` (oxlint) | PR + push | yes |
| `file-length` | oxlint with `.oxlintrc.file-length.json` on the TypeScript files a PR into develop touches (plus a self-test); full-tree backlog report otherwise | PR into develop | yes (backlog report is informational) |
| `guide-lint` | `guide_lint.py` (skills load, cited paths and `make` targets exist, context budget), `repo_lint.py` (workflow paths, `needs:`, Dependabot, stale owner, placeholders), `test_hook.py`, `test_red_issue.py`, `test_repo_lint.py` | PR + push | yes |
| `test` | `npm test` (vitest + browser-script tests, Playwright chromium installed) | PR + push | yes |
| `typecheck` | `npm run typecheck` (`tsc -b --noEmit`) | PR + push | yes |
| `build` | `npm run build` | PR + push | yes |
| `docs` | Docusaurus site under `docs/`: typecheck + build | PR + push | yes |
| `trivy-fs-scan` | Trivy filesystem scan, CRITICAL/HIGH with a fix | PR + push | yes |
| `helm-lint` | `ct lint` on `charts/warehouse-console` | PR into main | yes |
| `trivy-scan` | image build + Trivy (CRITICAL/HIGH with a fix), SARIF upload | PR into main | yes |
| `verify-routes` | Playwright over the shell + every remote dev server | `.github/workflows/verify-routes.yml`: PRs touching routing files, weekly, manual | advisory |
| Docs site build/deploy | `.github/workflows/docs.yml` | PRs touching `docs/**`; deploy on main | build yes |
| CodeQL | `.github/workflows/codeql.yml` | PR, push, weekly | yes |
| Scorecard | `.github/workflows/scorecard.yml` | push to develop, weekly | no |
| AI review | `.github/workflows/ai-review.yml` (needs `ANTHROPIC_API_KEY`; path filter `internal/domain`, `apis`, `charts`) | PR into develop | no (advisory) |

`docker-publish` and `release` run only on push to main (publish, sign, SBOM); they are delivery,
not sensors.

Local gates: `make check-fast` (oxlint + typecheck; the agent Stop hook runs it), `make check` /
`make check-all` (lint, typecheck, test, build), `make guide-lint`, `make harness-test`.

## Agent runtime harness

| Piece | Files | Lifecycle |
|---|---|---|
| Guard + feedback hooks | `scripts/harness/hook.py` (`pre` / `post` / `stop`) with adapters `.claude/settings.json`, `.codex/hooks.json`, `.opencode/plugins/harness.ts` | every tool call; end of turn |
| Skills for Codex | `.agents/skills` symlink to `.claude/skills` | on task match |
| Red-sensor helper | `scripts/harness/red_issue.py` (tested; no scheduled job here calls it yet) | n/a |

The hooks block pushes to develop/main, `--no-verify`, force-push, bare `rm -rf` on non-scratch
paths, destructive git, and edits to generated files; the Stop hook runs `make check-fast` when code
changed. `HARNESS_OFF=1` disables them. The `scripts/harness/*.py` files and the three adapters are
template-managed copies: change them in `warehouse-harness-template`, never here.

## Incident protocol

Every failure that was not caught before CI ends with the fix, a sensor or guide that would have
caught it, that sensor rolled out fleet-wide, and a row in [INCIDENTS.md](INCIDENTS.md). A row with
no guard is an open gap and says so.
