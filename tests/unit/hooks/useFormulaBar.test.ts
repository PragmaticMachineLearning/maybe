import { describe, expect, it } from "vitest";

import { formatFormulaBarCellValue } from "../../../src/hooks/useFormulaBar";

describe("formatFormulaBarCellValue", () => {
  it("formats explicit distributions as formulas", () => {
    expect(
      formatFormulaBarCellValue({
        kind: "normal",
        source: "parameters",
        mean: 1,
        variance: 2,
      }),
    ).toBe("N(1.00, 2.00)");
    expect(
      formatFormulaBarCellValue({
        kind: "lognormal",
        source: "ci",
        lower: 1,
        upper: 2,
        confidenceLevel: 95,
      }),
    ).toBe("LN.CI(1.00, 2.00, 0.95)");
    expect(
      formatFormulaBarCellValue({
        kind: "uniform",
        source: "parameters",
        min: 1,
        max: 2,
      }),
    ).toBe("U(1.00, 2.00)");
  });

  it("formats variance-backed summaries as standard deviation", () => {
    expect(formatFormulaBarCellValue({ mean: 5, variance: 4 }))
      .toBe("S(μ=5.00, σ=2.00)");
    expect(formatFormulaBarCellValue({ mu: 3, sigma2: 9 }))
      .toBe("LN(μ=3.00, σ=3.00)");
  });
});
