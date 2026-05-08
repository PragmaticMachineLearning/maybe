<p align="center">
  <img src="public/maybe-logo.png" alt="Maybe logo" width="420" />
</p>

# Maybe Spreadsheet

Maybe is a local-first probabilistic spreadsheet. It works like a familiar
spreadsheet, but it lets you put uncertainty directly into cells with explicit
probability distributions and then propagate that uncertainty through formulas.

Maybe is intended for people who want spreadsheet modeling with ranges,
confidence intervals, and sampled outcomes instead of a single point estimate.

## Features

- Spreadsheet editing powered by GaussFormula
- Standard values, formulas, and formula-bar editing
- Explicit uncertainty notation:
  - `N(mean, variance)`
  - `N.CI(lower, upper[, confidence])`
  - `LN(mu, sigma)`
  - `LN.CI(lower, upper[, confidence])`
  - `U(min, max)`
- Sampled calculations when formulas reference uncertain cells
- Distribution charts for uncertain values
- Dependency graph view for tracing formula relationships
- Optional Assistant panel for workbook inspection and model changes
- SQLite-backed local workbook persistence

## Quick Start

### Requirements

- Bun 1.3 or newer

### Run the Development App

```bash
git clone https://github.com/PragmaticMachineLearning/maybe.git
cd maybe
bun install
bun run dev
```

Open `http://localhost:5173`.

The development command starts two processes:

- the Hono API server on `http://localhost:3000`
- the Vite client on `http://localhost:5173`

The client proxies `/api/*` requests to the API server.

### Try the First Model

In the spreadsheet, enter:

| Cell | Input | Meaning |
| --- | --- | --- |
| `A1` | `N.CI(10, 20)` | Normal distribution from a default 95% confidence interval |
| `B1` | `U(2, 5)` | Uniform distribution between 2 and 5 |
| `C1` | `=A1*B1` | Sampled result that propagates both uncertain inputs |

Select `C1` to inspect the sampled output. Use the chart control on an
uncertain cell to view its distribution, or use the graph button to inspect
formula dependencies.

For a fuller walkthrough, see [docs/USER_GUIDE.md](docs/USER_GUIDE.md).

## Configuration

Copy `.env.example` to `.env` for local configuration.

```bash
cp .env.example .env
```

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `OPENAI_API_KEY` | No | unset | Enables the Assistant. Without it, assistant requests return a setup error. |
| `MAYBE_DB_PATH` | No | `data/maybe.sqlite` | SQLite database file used for workbook persistence. |
| `PORT` | No | `3000` | Port used by the production Bun server and default development API server. |
| `MAYBE_DIST_DIR` | No | `dist` | Directory served by the production server after `bun run build`. |

The Assistant is optional. The spreadsheet works without an OpenAI API key.

## Production Build

Build and run the production server:

```bash
bun run build
bun run start
```

Open `http://localhost:3000`.

The production server serves the built client from `dist` and owns `/api/*`.

### Production Smoke Test

```bash
bun install
bun run build
MAYBE_DB_PATH=/tmp/maybe-smoke.sqlite bun run start
```

Open `http://localhost:3000`, edit a workbook cell, refresh the page, and
confirm the edit persists. Stop the server and remove the smoke-test database
when you are done.

## Persistence

Workbook persistence uses SQLite through the Bun server. By default, Maybe
stores workbook data in `data/maybe.sqlite`.

For self-hosted use, set `MAYBE_DB_PATH` to a location on persistent storage:

```bash
MAYBE_DB_PATH=/var/lib/maybe/maybe.sqlite bun run start
```

Back up that SQLite file if the workbook matters.

## Checks

Run the full project check before opening a pull request:

```bash
bun run check
```

This runs linting, unit tests, TypeScript checks, production build, Playwright
end-to-end tests, and unused-file checks.

Useful narrower commands:

```bash
bun run lint
bun run test
bun run build
bun run test:e2e
bun run knip
```

## Limitations

Maybe is currently intended for local or single-user self-hosted use.

- Workspaces are anonymous and identified by a browser cookie.
- There are no user accounts, authentication, authorization, quotas, or
  multi-user isolation guarantees.
- SQLite persistence is local to the server process.
- Operators are responsible for persistent storage, backups, and migrations.
- The Assistant uses the server-side `OPENAI_API_KEY`; the deployer controls and
  pays for that usage.

## Tech Stack

- React + TypeScript
- Vite
- Bun
- Hono
- SQLite
- GaussFormula
- ECharts
- Playwright

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for local setup, checks, and contribution
guidelines.

## License

Maybe is licensed under GPL-3.0-only. See [LICENSE](LICENSE).
