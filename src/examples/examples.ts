export type ExampleCell = string | number | null;

export interface ExampleDefinition {
  id: string;
  name: string;
  description: string;
  data: ExampleCell[][];
}

const llmPricingExample: ExampleDefinition = {
  id: "prompt-cost-uncertainty",
  name: "Prompt Cost Forecast",
  description:
    "Mean-aligned prompt-cost forecast with explicit uncertainty inputs.",
  data: [
    [null, null, null, null, null],
    [null, null, null, null, null],
    [null, null, null, null, null],
    [
      "Inputs",
      null,
      null,
      "Calculated",
      "Outputs update automatically as you adjust uncertainty inputs.",
    ],
    [
      "Average Document Length (Pages)",
      "N.CI(18, 22, 0.95)",
      null,
      "Input Tokens Per Doc",
      "=B5*B20",
    ],
    [
      "Number of Prompt Revisions",
      0,
      null,
      "Chunks Per Doc",
      "=CEILING(E5/B13,1)",
    ],
    [
      "Number of Documents To Label",
      "N.CI(160, 240, 0.95)",
      null,
      "Field Batches Per Doc",
      "=CEILING(B8/B21,1)",
    ],
    ["Number of Fields", 20, null, "Document Input Tokens", "=E5*E7"],
    [null, null, null, "Text-prompt Input Tokens", "=B14*E6*E7"],
    ["Constants", null, null, "Per-Field Input Tokens", "=E6*B8*B15"],
    [
      "LLM Cost Per 1000 Tokens (Prompt)",
      "N.CI(0.009, 0.011, 0.95)",
      null,
      "Total Input Tokens",
      "=E8+E9+E10",
    ],
    [
      "LLM Cost per 1000 Tokens (Completion)",
      "N.CI(0.028, 0.032, 0.95)",
      null,
      "Response Tokens Per Doc",
      "=E6*B8*B19",
    ],
    [
      "Chunk Length (tokens)",
      "N.CI(1948, 2148, 0.95)",
      null,
      "Total Cost Per Doc",
      "=(E11*B11+E12*B12)/1000",
    ],
    ["Prompt Length", "N.CI(90, 110, 0.95)", null, null, null],
    [
      "Per Field Prompt Length",
      "N.CI(22, 38, 0.95)",
      null,
      "Total Cost",
      "=B6*B16*E13 + B7*E13",
    ],
    ["Num Docs Shown in Prompt-studio", "N.CI(4, 6, 0.95)", null, null, null],
    [null, null, null, null, null],
    ["Assumptions", null, null, null, null],
    [
      "Average Completion Length Per Field per chunk",
      "N.CI(35, 45, 0.95)",
      null,
      null,
      null,
    ],
    ["Num Tokens per Page", "N.CI(950, 1050, 0.95)", null, null, null],
    ["Field Batch Size", 10, null, null, null],
  ],
};

export const spreadsheetExamples: ExampleDefinition[] = [llmPricingExample];
