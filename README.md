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

- Node.js 24
- pnpm

### Installation

1. Clone the repository
```bash
git clone git@github.com:PragmaticMachineLearning/maybe.git
cd maybe
```

2. Install dependencies
```bash
pnpm install
```

3. Start the development server
```bash
pnpm dev
```

### Cloudflare D1 persistence

Workbook persistence uses Cloudflare D1 with Drizzle ORM. Create a D1 database
before deploying:

```bash
pnpm exec wrangler d1 create maybe
```

Create a local `wrangler.jsonc` file for your Cloudflare deployment. It is
ignored by git because it contains deployment-specific resource ids. The D1
binding must be named `DB`:

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "maybe",
  "main": "src/worker.ts",
  "compatibility_date": "2026-04-24",
  "observability": {
    "enabled": true
  },
  "assets": {
    "binding": "ASSETS",
    "not_found_handling": "single-page-application"
  },
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "maybe",
      "database_id": "replace-with-your-d1-database-id",
      "migrations_dir": "drizzle/migrations"
    }
  ],
  "compatibility_flags": ["nodejs_compat"]
}
```

Copy the database id returned by Wrangler into `database_id`, then apply
migrations:

```bash
pnpm db:migrate:remote
```

For local Wrangler preview, apply the migration locally:

```bash
pnpm db:migrate:local
```

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

## Technical Details

This project is built with:

- React + TypeScript
- Vite for fast development
- GaussFormula as the calculation engine
- ECharts for data visualization

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the GPL-3.0 License.
