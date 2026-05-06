import { describe, expect, it } from "bun:test";

import {
  documentationSections,
  quickStartSteps,
} from "../../../src/docs/documentationContent";

describe("documentation content", () => {
  it("documents the quick-start uncertainty workflow", () => {
    expect(quickStartSteps.map((step) => step.formula)).toEqual([
      "N.CI(10, 20)",
      "U(2, 5)",
      "=A1*B1",
    ]);
    expect(quickStartSteps[quickStartSteps.length - 1]?.result).toContain(
      "sampled μ=52.57 σ=15.88",
    );
  });

  it("explains that LN uses underlying normal parameters", () => {
    const joinedContent = documentationSections
      .flatMap((section) => section.blocks)
      .join("\n");

    expect(joinedContent).toContain("LN(mu, sigma)");
    expect(joinedContent).toContain("ln(X)");
    expect(joinedContent).toContain("LN.CI(lower, upper)");
  });

  it("documents the dependency graph view", () => {
    const section = documentationSections.find(
      (candidate) => candidate.id === "dependency-graph",
    );

    expect(section?.title).toBe("Dependency Graph");
    expect(section?.blocks.join("\n")).toContain("flow view");
  });
});
