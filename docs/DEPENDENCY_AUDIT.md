# Dependency Audit: Removal Value

Ranked findings on which direct dependencies could be dropped or replaced
cheaply to cut the number of third-party packages that need security patches.
This report only. Nothing was removed or upgraded, and bun.lock is unchanged.

## How the numbers were produced

- Import sites: one per import/export-from statement naming the package (or a
  subpath of it) in src, tests, and root config files (vite.config.ts,
  eslint.config.js, playwright.config.ts).
  Type-only imports count. Packages with no import site are used implicitly
  (type packages, the compiler, the linter CLI, knip).
- Transitive packages removed: packages in bun.lock (275 entries in total)
  that are reachable only through that dependency, i.e. would leave the
  lockfile if it were removed and nothing else changed. A package that another
  direct dependency also needs does not count. Peer dependencies count as
  edges. Counts exclude the package itself.
- Effort: easy means about one import site and under a day.

## Ranked table

| Rank | Package | Import sites | Replacement | Effort | Transitive packages removed | Verdict |
|---|---|---|---|---|---|---|
| 1 | echarts-for-react | 1 | Small hook calling the echarts instance directly | Easy (under a day) | 1 (size-sensor) | Easy to remove |
| 2 | @tanstack/react-table | 1 | Local column-width state and resize handlers | Medium (1-2 days) | 1 (@tanstack/table-core) | Easy to remove, low payoff |
| 3 | eslint-plugin-react-hooks | 1 (eslint.config.js) | None equivalent; drop the rules | Easy to do, loses lint coverage | 38 (mostly @babel/*, hermes-*, browserslist data) | Keep (see notes) |
| 4 | hono | 2 | Bun.serve with a small router | Medium | 0 | Not worth removing |
| 5 | gaussformula | 1 file, 2 statements | Own formula parser/evaluator | Large (weeks) | 3 (chevrotain, regexp-to-ast, tiny-emitter) | Keep |
| 6 | @ai-sdk/react | 1 | Own fetch/stream hook | Large | 4 (swr, throttleit, dequal, use-sync-external-store) | Keep |
| 7 | ai | 7 | None practical | Large | 0 (shared with @ai-sdk/react and @ai-sdk/openai) | Keep |
| 8 | @ai-sdk/openai | 1 | None practical | Large | 0 (shared with ai) | Keep |
| 9 | zod | 4 | None practical | Large | 0 | Keep |
| 10 | echarts | 3 files (5 statements) | None practical | Large | 0 (zrender is shared with nothing else, but it is core) | Keep |
| 11 | react-dom | 1 | None | n/a | 0 | Keep |
| 12 | react | 15 | None | n/a | 0 | Keep |

Dev dependencies (all are in use; none flagged by this manual review):

| Package | Import sites | Transitive packages removed | Verdict |
|---|---|---|---|
| eslint-plugin-react-hooks | 1 | 38 | Keep (ranked above) |
| knip | 0 (CLI) | 51 | Keep; 42 of the 51 are optional per-platform oxc binaries that install only for the host platform |
| typescript-eslint | 1 | 11 | Keep |
| @playwright/test | 2 | 2 (playwright, playwright-core) | Keep, used by the e2e suite |
| @types/bun | 0 (ambient types) | 1 (bun-types) | Keep |
| eslint, @eslint/js, eslint-plugin-react-refresh, globals | 0, 1, 1, 1 | 0 unique (shared) | Keep |
| vite, @vitejs/plugin-react | 1 each | 0 unique (shared) | Keep, build tool is out of scope |
| typescript, @types/node, @types/react, @types/react-dom | 0 | 0 unique | Keep |

## Corrections to the earlier findings

- echarts-for-react pulls in size-sensor and fast-deep-equal, but fast-deep-equal
  is also required by ajv and eslint, so it stays in the lockfile. Removal
  saves 1 transitive package, not 2.
- hono is imported in 2 files (src/server/index.ts, src/server/apiApp.ts), not
  3. src/server/workbookRoute.ts has no hono import. index.ts plus apiApp.ts
  is 139 lines; with workbookRoute.ts the server code is 328 lines.
- echarts-for-react has 1 import site (src/lib/echarts.ts, subpath
  echarts-for-react/lib/core). DistributionPlot.tsx imports the local wrapper,
  not the package.

## Notes on candidates

echarts-for-react (rank 1). The wrapper owns chart init, option updates,
disposal on unmount, and resize handling through size-sensor. A replacement
hook must call echarts.init once, call setOption on option changes, dispose on
unmount, and resize via ResizeObserver. Risks: leaked instances under React
strict-mode double effects, and missed resizes when the container changes size
without a window resize. src/types/echarts-for-react-core.d.ts goes with it.
The real benefit is small: one fewer package and one fewer type shim.

@tanstack/react-table (rank 2). Spreadsheet.tsx uses only getCoreRowModel
and column resizing; sorting and filtering are off. The risk is the resize
logic: pointer drag handling, minimum widths, and touch support need to be
re-implemented and tested. Saves one tiny package (table-core, zero deps).

eslint-plugin-react-hooks (rank 3). The 38 packages are almost all Babel
tooling used by its React Compiler lint rules. Dropping it would remove the
most packages of any cheap change but also removes rules-of-hooks and
exhaustive-deps checks. These catch real bugs, and the packages are dev-only
and not shipped, so the CVE exposure is lower. Keep unless the team accepts
losing those checks.

hono (rank 4). Zero transitive packages, so removal reduces no patch surface
beyond hono itself. Replacing it with Bun.serve means rewriting routing,
static file serving, and error handling in about 139 lines plus tests.

gaussformula (rank 5). It is the sole formula engine (src/lib/formulaEngine.ts).
It depends on chevrotain 6.5.0 (2020 era, long behind the current major) and
tiny-emitter 2.1.0, and gaussformula 0.1.10 is a young, low-version package.
Treat these as the likeliest source of unmaintained-dependency advisories, but
replacing a formula engine is a large project. Keep, and watch it.

AI packages, zod, echarts, react, react-dom. Core to the assistant, schemas,
charts, and UI. zod is also a peer dependency of ai. Keep.

## Verification status

- Import counts come from a grep over src, tests, and root config files.
- Transitive counts come from a script that walks bun.lock dependency edges.
- bun is not installed on the machine that wrote this report, so bun run knip,
  lint, test, and build were not run. The only change is this file. Knip output
  is therefore not included. Run bun run knip and add any flagged entries here.
