<p align="center">
  <img src="public/maybe-logo.png" alt="Maybe logo" width="420" />
</p>

<p align="center">
  <img alt="Bun" src="https://img.shields.io/badge/runtime-Bun-black" />
  <img alt="React" src="https://img.shields.io/badge/ui-React-149ECA" />
  <img alt="TypeScript" src="https://img.shields.io/badge/language-TypeScript-3178C6" />
  <img alt="SQLite" src="https://img.shields.io/badge/storage-SQLite-003B57" />
  <img alt="License" src="https://img.shields.io/badge/license-GPL--3.0--only-blue" />
</p>

# Maybe Spreadsheet

Maybe is an opinionated spreadsheet for uncertain models.

Most spreadsheets make you collapse uncertainty into a single scalar value.
Maybe lets cells represent distributions, confidence intervals, and ranges, then
propagates that uncertainty through formulas.

## Features

- Spreadsheet editing powered by
  [GaussFormula](https://github.com/Tobiadefami/gaussformula)
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

Set `MAYBE_DB_PATH` if you want to use a different SQLite file.

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

## Project Status

Maybe is still a work in progress. The core spreadsheet, uncertainty notation,
sampling behavior, persistence, and Assistant workflows are usable, but APIs,
file formats, and modeling conventions may change as the project evolves.

## Formula Engine

Maybe is powered by [GaussFormula](https://github.com/Tobiadefami/gaussformula),
a spreadsheet formula engine adapted from HyperFormula to support uncertain
cell values and sampled calculations. GaussFormula is maintained by the same
author as Maybe and is also available on
[npm](https://www.npmjs.com/package/gaussformula).

## Tech Stack

- React + TypeScript
- Vite
- Bun
- Hono
- SQLite
- [GaussFormula](https://github.com/Tobiadefami/gaussformula)
- ECharts
- Playwright

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for local setup, checks, and contribution
guidelines.

## License

Maybe is licensed under GPL-3.0-only. See [LICENSE](LICENSE).
