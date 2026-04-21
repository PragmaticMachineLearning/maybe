import { describe, expect, it } from "vitest";

import type { WorkbookSnapshot } from "./workbookSnapshot";
import {
  extractAssistantProposalFromText,
  stripAssistantProposalFromText,
  validateAssistantProposal,
} from "./proposals";

const snapshot: WorkbookSnapshot = {
  sheetName: "Sheet1",
  dimensions: { width: 5, height: 5 },
  selectedCell: "C1",
  includedCellCount: 2,
  totalNonEmptyCellCount: 2,
  truncated: false,
  cells: [
    {
      address: "A1",
      row: 0,
      col: 0,
      formula: null,
      displayValue: "CI[10, 20]",
      kind: "confidence_interval",
    },
    {
      address: "B1",
      row: 0,
      col: 1,
      formula: "=A1*2",
      displayValue: "samples(mean=30, p10=24, p90=36)",
      kind: "sampled_distribution",
    },
  ],
};

const text = [
  "I suggest adding percentile review cells.",
  "```maybe-proposal",
  JSON.stringify({
    title: "Add percentile outputs",
    summary: "Surface the p10, p50, and p90 values beside the sampled distribution.",
    changes: [
      {
        cell: " C1 ",
        before: "",
        after: "=B1",
        reason: "Show the p50 estimate next to the sample output.",
        kind: "add",
      },
      {
        cell: "B1",
        before: "=A1*2",
        after: "=A1*2",
        reason: "Keep the distribution formula in sync with the current sheet state.",
        kind: "update",
      },
      {
        cell: "A1",
        before: "stale value",
        after: "CI[10, 20]",
        reason: "Document the confidence interval for reviewers.",
        kind: "review",
      },
    ],
  }),
  "```",
].join("\n");

describe("assistant proposal parsing", () => {
  it("extracts and strips hidden maybe-proposal block", () => {
    expect(extractAssistantProposalFromText(text)?.title).toBe(
      "Add percentile outputs",
    );
    expect(stripAssistantProposalFromText(text)).toBe(
      "I suggest adding percentile review cells.",
    );
  });

  it("validates add, update, and review changes", () => {
    const proposal = extractAssistantProposalFromText(text);

    expect(proposal).not.toBeNull();

    const result = validateAssistantProposal(proposal, snapshot);

    expect(result.valid).toBe(true);
    expect(result.applyableChanges.map((change) => change.cell)).toEqual([
      "C1",
      "B1",
    ]);
    expect(result.errors).toEqual([]);
  });

  it("rejects stale before values, out-of-bounds cells, and empty reasons", () => {
    const proposal = extractAssistantProposalFromText(
      [
        "```maybe-proposal",
        JSON.stringify({
          title: "Bad proposal",
          summary: "Contains validation problems.",
          changes: [
            {
              cell: "B1",
              before: "stale",
              after: "=A1*3",
              reason: "Should fail because before is stale.",
              kind: "update",
            },
            {
              cell: "Z99",
              before: "",
              after: "1",
              reason: "Outside bounds.",
              kind: "add",
            },
            {
              cell: "C1",
              before: "",
              after: "1",
              reason: "   ",
              kind: "add",
            },
          ],
        }),
        "```",
      ].join("\n"),
    );

    expect(proposal).not.toBeNull();

    const result = validateAssistantProposal(proposal, snapshot);

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual([
      "B1 has changed since Sage prepared this proposal.",
      "Z99 is outside the current sheet.",
      "C1 needs a reason before it can be applied.",
    ]);
  });
});
