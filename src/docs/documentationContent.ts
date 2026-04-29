interface QuickStartStep {
  cell: string;
  formula: string;
  note: string;
  result?: string;
}

interface DocumentationSection {
  id: string;
  title: string;
  blocks: string[];
  formulas?: Array<{
    notation: string;
    description: string;
  }>;
}

export const quickStartSteps: QuickStartStep[] = [
  {
    cell: "A1",
    formula: "N.CI(10, 20)",
    note: "Creates a normal distribution from a default 95% confidence interval.",
  },
  {
    cell: "B1",
    formula: "U(2, 5)",
    note: "Creates a continuous uniform distribution between 2 and 5.",
  },
  {
    cell: "C1",
    formula: "=A1*B1",
    note: "Propagates uncertainty by multiplying aligned samples from A1 and B1.",
    result: "Expected sampled result is around sampled μ=52.57 σ=15.88.",
  },
];

export const documentationSections: DocumentationSection[] = [
  {
    id: "quick-start",
    title: "Quick Start",
    blocks: [
      "Use Maybe like a spreadsheet, but put uncertainty directly into cells. When formulas reference uncertain cells, Maybe propagates samples instead of collapsing the result to one scalar.",
      "Try the three-cell flow below, then select C1 to inspect the sampled result.",
    ],
  },
  {
    id: "uncertain-values",
    title: "Uncertain Values",
    blocks: [
      "Uncertain cells are explicit. The notation tells Maybe which distribution to create and how to sample from it.",
      "For lognormal values, LN(mu, sigma) uses the parameters of the underlying normal distribution, so ln(X) is normally distributed with mean mu and standard deviation sigma. For original-scale inputs, LN.CI(lower, upper) is usually easier.",
    ],
    formulas: [
      {
        notation: "N(mean, variance)",
        description: "Normal distribution using mean and variance.",
      },
      {
        notation: "N.CI(lower, upper)",
        description: "Normal distribution from a default 95% confidence interval.",
      },
      {
        notation: "LN(mu, sigma)",
        description:
          "Lognormal distribution where ln(X) has mean mu and standard deviation sigma.",
      },
      {
        notation: "LN.CI(lower, upper)",
        description:
          "Lognormal distribution from a default 95% confidence interval on the original value scale.",
      },
      {
        notation: "U(a, b)",
        description: "Continuous uniform distribution from a to b.",
      },
    ],
  },
  {
    id: "sampling",
    title: "Sampling Behavior",
    blocks: [
      "Sampled results display as derived summaries such as sampled μ=<mean> σ=<standard deviation>. S(...) is not valid cell input syntax.",
      "Summary values are approximate because they come from samples, but they are deterministic for the same sampling configuration.",
    ],
  },
  {
    id: "dependency-graph",
    title: "Dependency Graph",
    blocks: [
      "Use the graph button in the toolbar to switch between the spreadsheet and the flow view.",
      "The dependency graph shows how cells feed into each other, including formulas and uncertain values, so you can trace how a sampled output is built from its inputs.",
    ],
  },
  {
    id: "functions",
    title: "Built-In Functions",
    blocks: [
      "Most built-in spreadsheet functions work with uncertain values by applying the operation over samples.",
      "If a formula combines uncertain and scalar values, Maybe broadcasts scalar values across the sample set.",
    ],
  },
  {
    id: "assistant",
    title: "Assistant",
    blocks: [
      "The assistant can inspect the workbook, explain formulas and uncertainty, validate suggested formulas, and prepare model changes.",
      "Assistant features require the deployment or local environment to provide an OpenAI API key.",
    ],
  },
];
