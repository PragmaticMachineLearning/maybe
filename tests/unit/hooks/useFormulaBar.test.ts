import { describe, expect, it } from "bun:test";

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
    ).toBe("LN.CI(1.00, 2.00)");
    expect(
      formatFormulaBarCellValue({
        kind: "lognormal",
        source: "ci",
        lower: 1,
        upper: 2,
        confidenceLevel: 90,
      }),
    ).toBe("LN.CI(1.00, 2.00, 0.9)");
    expect(
      formatFormulaBarCellValue({
        kind: "uniform",
        source: "parameters",
        min: 1,
        max: 2,
      }),
    ).toBe("U(1.00, 2.00)");
  });

  it("preserves small CI bounds in formulas", () => {
    expect(
      formatFormulaBarCellValue({
        kind: "normal",
        source: "ci",
        lower: 0.009,
        upper: 0.011,
        confidenceLevel: 95,
      }),
    ).toBe("N.CI(0.009, 0.011)");
  });

  it("formats variance-backed sample summaries without input syntax", () => {
    expect(formatFormulaBarCellValue({ mean: 5, variance: 4 }))
      .toBe("sampled μ=5.00 σ=2.00");
    expect(formatFormulaBarCellValue({ mu: 3, sigma2: 9 }))
      .toBe("LN(μ=3.00, σ=3.00)");
  });
});
