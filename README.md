<p align="center">
  <img src="public/maybe-logo.png" alt="Maybe logo" width="420" />
</p>

# Maybe Spreadsheet

Maybe is a React-based spreadsheet application with built-in support for uncertainty through Gaussian distributions and sampled distributions.

## Features

- Full spreadsheet functionality powered by GaussFormula
- Support for formulas and calculations
- Built-in support for Gaussian distributions
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

## Usage

### Working with Distributions

The spreadsheet supports Gaussian distributions that can be created and manipulated using the GaussFormula engine. 

- Use the spreadsheet interface to input data and formulas
- Visualize distributions with the interactive plotting tool
- Analyze statistical properties of distributions

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
