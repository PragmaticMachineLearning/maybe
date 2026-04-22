import { describe, expect, it } from "vitest";

import { formatFormulaBarCellValue } from "./useFormulaBar";

describe("formatFormulaBarCellValue", () => {
  it("formats variance-backed summaries as standard deviation", () => {
    expect(formatFormulaBarCellValue({ mean: 5, variance: 4 }))
      .toBe("S(μ=5.00, σ=2.00)");
    expect(formatFormulaBarCellValue({ mu: 3, sigma2: 9 }))
      .toBe("LN(μ=3.00, σ=3.00)");
  });
});
