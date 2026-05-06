<p align="center">
  <img src="public/maybe-logo.png" alt="Maybe logo" width="420" />
</p>

# Maybe Spreadsheet

Maybe is a React-based spreadsheet application with built-in support for uncertainty through explicit probability distributions and sampled distributions.

## Features

- Full spreadsheet functionality powered by GaussFormula
- Support for formulas and calculations
- Built-in support for explicit distributions such as `N(mean, variance)`, `LN(mu, sigma)`, `U(min, max)`, `N.CI(lower, upper[, confidence])`, and `LN.CI(lower, upper[, confidence])`
- Interactive visualizations for distributions
- Statistical analysis tools including:
  - Percentile calculations
  - Confidence intervals
  - Distribution plotting

## Getting Started

### Prerequisites

- Bun 1.3 or newer

### Installation

1. Clone the repository
```bash
git clone git@github.com:PragmaticMachineLearning/maybe.git
cd maybe
```

2. Install dependencies
```bash
bun install
```

3. Start the development server
```bash
bun run dev
```

The dev command runs the Hono API server and Vite client together. Hono owns
`/api/*`; the client app should use non-API routes.

### Environment

Copy `.env.example` to `.env` for local values.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `OPENAI_API_KEY` | No | unset | Enables Ask Maybe. Without it, assistant requests return a setup error. |
| `MAYBE_DB_PATH` | No | `data/maybe.sqlite` | SQLite database file used for workbook persistence. |
| `PORT` | No | `3000` | Port used by the production Bun server. |
| `MAYBE_DIST_DIR` | No | `dist` | Directory served by the production server after `bun run build`. |

### Local persistence

Workbook persistence uses SQLite through the Bun server. By default, Maybe
stores workbook data in `data/maybe.sqlite`.

```bash
bun run build
bun run start
```

Set `MAYBE_DB_PATH` to choose a different SQLite file:

```bash
MAYBE_DB_PATH=/var/lib/maybe/maybe.sqlite bun run start
```

For production or self-hosted use, put `MAYBE_DB_PATH` on a persistent volume
and back up that file.

### Production smoke test

```bash
bun install
bun run build
MAYBE_DB_PATH=/tmp/maybe-smoke.sqlite bun run start
```

Open `http://localhost:3000`, edit a workbook cell, refresh the page, and
confirm the edit persists. Stop the server and remove the smoke-test database
when you are done.

## Usage

### Working with Distributions

The spreadsheet supports explicit probability distributions that can be created and manipulated using the GaussFormula engine. 

- Use the spreadsheet interface to input data and formulas
- Visualize distributions with the interactive plotting tool
- Analyze statistical properties of distributions

### Distribution notation

- `N(mean, variance)` uses normal-distribution parameters directly.
- `LN(mu, sigma)` uses log-space parameters: if `X ~ LN(mu, sigma)`, then `ln(X) ~ N(mu, sigma^2)`. `mu` and `sigma` are not the mean and standard deviation of `X`.
- Prefer `LN.CI(lower, upper[, confidence])` for user-facing lognormal inputs because the bounds are in the original value scale.
- `N.CI(lower, upper[, confidence])` derives a normal distribution from a value-scale confidence interval.
- `U(min, max)` represents a uniform range on the original value scale.

## Limitations

Maybe is currently intended for local or single-user self-hosted use.

- Workspaces are anonymous and identified by a browser cookie.
- There are no user accounts, authentication, authorization, quotas, or
  multi-user isolation guarantees.
- SQLite persistence is local to the server process. Operators are responsible
  for persistent storage, backups, and migrations.
- Ask Maybe is optional and uses the server-side `OPENAI_API_KEY`; the deployer
  controls and pays for that usage.

## Technical Details

This project is built with:

- React + TypeScript
- Vite for fast development
- Bun for package management, scripts, tests, and the production runtime
- Hono for `/api/*` routes
- SQLite for local workbook persistence
- GaussFormula as the calculation engine
- ECharts for data visualization
- Playwright for end-to-end tests

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for local setup, checks, and contribution
guidelines.

## License

This project is licensed under the GPL-3.0 License. See [LICENSE](LICENSE).
