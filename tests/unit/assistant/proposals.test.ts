import { describe, expect, it } from "bun:test";

import { cellAddressToA1 } from "../../../src/assistant/address";
import {
  applyAssistantChangesToEngine,
  extractAssistantProposalFromText,
  stripAssistantProposalFromText,
  validateAssistantProposal,
} from "../../../src/assistant/proposals";
import { GaussFormulaEngine } from "../../../src/lib/formulaEngine";
import type { WorkbookSnapshot } from "../../../src/schemas/workbook";

const snapshot: WorkbookSnapshot = {
  sheetName: "Sheet1",
  dimensions: { width: 5, height: 5 },
  selectedCell: "C1",
  serializedContent: [
    ["N.CI(10, 20)", "=A1*2", null, null, null],
    [null, null, null, null, null],
    [null, null, null, null, null],
    [null, null, null, null, null],
    [null, null, null, null, null],
  ],
  includedCellCount: 2,
  totalNonEmptyCellCount: 2,
  truncated: false,
  cells: [
    {
      address: "A1",
      row: 0,
      col: 0,
      formula: null,
      displayValue: "N.CI(10, 20)",
      kind: "distribution",
      distribution: {
        kind: "normal",
        source: "ci",
        lower: 10,
        upper: 20,
        confidenceLevel: 95,
      },
    },
    {
      address: "B1",
      row: 0,
      col: 1,
      formula: "=A1*2",
      displayValue: "sampled μ=30 σ=4 p10=24 p90=36",
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
        after: "N.CI(10, 20)",
        reason: "Document the uncertainty for reviewers.",
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

  it("extracts and strips proposal JSON when the model labels the fence as json", () => {
    const jsonFenceText = [
      "I prepared the workbook changes for review.",
      "```json",
      JSON.stringify({
        title: "JSON fence proposal",
        summary: "Accept valid proposal JSON from a generic code fence.",
        changes: [
          {
            cell: "C1",
            before: "",
            after: "=B1",
            reason: "Add the visible summary output.",
            kind: "add",
          },
        ],
      }),
      "```",
    ].join("\n");

    expect(extractAssistantProposalFromText(jsonFenceText)?.title).toBe(
      "JSON fence proposal",
    );
    expect(stripAssistantProposalFromText(jsonFenceText)).toBe(
      "I prepared the workbook changes for review.",
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

  it("rejects blank reasons and omits those changes from applyable changes", () => {
    const proposal = extractAssistantProposalFromText(
      [
        "```maybe-proposal",
        JSON.stringify({
          title: "Blank reason proposal",
          summary: "One change is missing a reason.",
          changes: [
            {
              cell: "C1",
              before: "",
              after: "=B1",
              reason: "   ",
              kind: "add",
            },
            {
              cell: "B1",
              before: "=A1*2",
              after: "=A1*3",
              reason: "Expand the sampled output.",
              kind: "update",
            },
          ],
        }),
        "```",
      ].join("\n"),
    );

    expect(proposal).not.toBeNull();

    const result = validateAssistantProposal(proposal, snapshot);

    expect(result.valid).toBe(false);
    expect(result.applyableChanges.map((change) => change.cell)).toEqual([
      "B1",
    ]);
    expect(result.errors).toEqual([
      "C1 needs a reason before it can be applied.",
    ]);
  });

  it("finds the first valid proposal among multiple maybe-proposal blocks", () => {
    const textWithMultipleBlocks = [
      "Intro text.",
      "```maybe-proposal",
      "{not valid json",
      "```",
      "Middle text.",
      "```maybe-proposal",
      JSON.stringify({
        title: "Second proposal",
        summary: "The first block is invalid, so this one should win.",
        changes: [
          {
            cell: "C1",
            before: "",
            after: "=B1",
            reason: "Add the visible summary output.",
            kind: "add",
          },
        ],
      }),
      "```",
    ].join("\n");

    expect(extractAssistantProposalFromText(textWithMultipleBlocks)?.title).toBe(
      "Second proposal",
    );
  });

  it("removes multiple maybe-proposal blocks from visible text", () => {
    const stripped = stripAssistantProposalFromText(
      [
        "Keep this.",
        "```maybe-proposal",
        JSON.stringify({
          title: "Hidden one",
          summary: "First hidden block.",
          changes: [],
        }),
        "```",
        "And this.",
        "```maybe-proposal",
        JSON.stringify({
          title: "Hidden two",
          summary: "Second hidden block.",
          changes: [],
        }),
        "```",
      ].join("\n"),
    );

    expect(stripped).toBe("Keep this.\n\nAnd this.");
  });

  it("rejects extra keys in proposal and change JSON", () => {
    expect(
      extractAssistantProposalFromText(
        [
          "```maybe-proposal",
          JSON.stringify({
            title: "Extra keys",
            summary: "Should fail strict parsing.",
            changes: [
              {
                cell: "C1",
                before: "",
                after: "=B1",
                reason: "Valid body.",
                kind: "add",
                extra: true,
              },
            ],
            extra: "nope",
          }),
          "```",
        ].join("\n"),
      ),
    ).toBeNull();
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
      "B1 has changed since Maybe prepared this proposal.",
      "Z99 is outside the current sheet.",
      "C1 needs a reason before it can be applied.",
    ]);
  });

  it("rejects duplicate add and update target cells", () => {
    const proposal = extractAssistantProposalFromText(
      [
        "```maybe-proposal",
        JSON.stringify({
          title: "Duplicate targets",
          summary: "Two changes target the same normalized cell.",
          changes: [
            {
              cell: " c1 ",
              before: "",
              after: "=B1",
              reason: "Add the first output.",
              kind: "add",
            },
            {
              cell: "C1",
              before: "",
              after: "=B1+1",
              reason: "Add the second output.",
              kind: "update",
            },
          ],
        }),
        "```",
      ].join("\n"),
    );

    expect(proposal).not.toBeNull();

    const result = validateAssistantProposal(proposal, snapshot);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("C1 has more than one proposed edit.");
    expect(result.applyableChanges).toEqual([]);
  });

  it("applies add and update changes to the formula engine while skipping review changes", () => {
    const engine = GaussFormulaEngine.buildEmpty({
      licenseKey: "gpl-v3",
      language: "enGB",
      useColumnIndex: true,
    });

    try {
      engine.addSheet("Sheet1");
      engine.setSheetContent(0, [[10, "=A1*2", null]]);

      applyAssistantChangesToEngine(
        engine,
        { width: 3, height: 1 },
        [
          {
            cell: "B1",
            before: "=A1*2",
            after: "=A1*3",
            reason: "Update the sampled distribution.",
            kind: "update",
          },
          {
            cell: "C1",
            before: "",
            after: "=B1+1",
            reason: "Add a follow-up calculation.",
            kind: "add",
          },
          {
            cell: "A1",
            before: "10",
            after: "N.CI(15, 25)",
            reason: "Flag for manual review.",
            kind: "review",
          },
        ],
      );

      expect(engine.getCellFormula({ sheet: 0, row: 0, col: 1 })).toBe(
        "=A1*3",
      );
      expect(engine.getCellFormula({ sheet: 0, row: 0, col: 2 })).toBe(
        "=B1+1",
      );
      expect(
        engine.getCellFormula({ sheet: 0, row: 0, col: 0 }) ?? null,
      ).toBeNull();
    } finally {
      engine.destroy();
    }
  });

  it("rejects stale updates before mutating the formula engine", () => {
    const engine = GaussFormulaEngine.buildEmpty({
      licenseKey: "gpl-v3",
      language: "enGB",
      useColumnIndex: true,
    });

    try {
      engine.addSheet("Sheet1");
      engine.setSheetContent(0, [[10, "=A1*2"]]);

      let error: unknown;
      try {
        applyAssistantChangesToEngine(
          engine,
          { width: 2, height: 1 },
          [
            {
              cell: "B1",
              before: "=A1*99",
              after: "=A1*3",
              reason: "Update the sampled distribution.",
              kind: "update",
            },
          ],
        );
      } catch (caughtError) {
        error = caughtError;
      }

      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe(
        "B1 has changed since Maybe prepared this proposal.",
      );
      expect(engine.getCellFormula({ sheet: 0, row: 0, col: 1 })).toBe(
        "=A1*2",
      );
    } finally {
      engine.destroy();
    }
  });

  it("rejects blank reasons before mutating the target cell", () => {
    const engine = GaussFormulaEngine.buildEmpty({
      licenseKey: "gpl-v3",
      language: "enGB",
      useColumnIndex: true,
    });

    try {
      engine.addSheet("Sheet1");
      engine.setSheetContent(0, [[10, "=A1*2", null]]);

      let error: unknown;
      try {
        applyAssistantChangesToEngine(
          engine,
          { width: 3, height: 1 },
          [
            {
              cell: "C1",
              before: "",
              after: "=B1+1",
              reason: "   ",
              kind: "add",
            },
          ],
        );
      } catch (caughtError) {
        error = caughtError;
      }

      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe(
        "C1 needs a reason before it can be applied.",
      );
      expect(
        engine.getCellFormula({ sheet: 0, row: 0, col: 2 }) ?? null,
      ).toBeNull();
    } finally {
      engine.destroy();
    }
  });

  it("rejects duplicate target cells before mutating the formula engine", () => {
    const engine = GaussFormulaEngine.buildEmpty({
      licenseKey: "gpl-v3",
      language: "enGB",
      useColumnIndex: true,
    });

    try {
      engine.addSheet("Sheet1");
      engine.setSheetContent(0, [[null, "=A1*2"]]);

      let error: unknown;
      try {
        applyAssistantChangesToEngine(
          engine,
          { width: 2, height: 1 },
          [
            {
              cell: "B1",
              before: "=A1*2",
              after: "=A1*3",
              reason: "Update the sampled distribution.",
              kind: "update",
            },
            {
              cell: " b1 ",
              before: "=A1*2",
              after: "=A1*4",
              reason: "Update the same cell again.",
              kind: "update",
            },
          ],
        );
      } catch (caughtError) {
        error = caughtError;
      }

      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe(
        "B1 has more than one proposed edit.",
      );
      expect(engine.getCellFormula({ sheet: 0, row: 0, col: 1 })).toBe(
        "=A1*2",
      );
    } finally {
      engine.destroy();
    }
  });

  it("rejects stale updates for populated cells beyond the default snapshot cutoff", () => {
    const engine = GaussFormulaEngine.buildEmpty({
      licenseKey: "gpl-v3",
      language: "enGB",
      useColumnIndex: true,
    });
    const targetCol = 204;
    const targetCell = cellAddressToA1(0, targetCol);

    try {
      engine.addSheet("Sheet1");
      engine.setSheetContent(0, [
        Array.from({ length: 205 }, (_, col) =>
          col === targetCol ? "=A1" : col + 1,
        ),
      ]);

      let error: unknown;
      try {
        applyAssistantChangesToEngine(
          engine,
          { width: 205, height: 1 },
          [
            {
              cell: targetCell,
              before: "",
              after: "=A1*2",
              reason: "Update the far-right formula.",
              kind: "update",
            },
          ],
        );
      } catch (caughtError) {
        error = caughtError;
      }

      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe(
        `${targetCell} has changed since Maybe prepared this proposal.`,
      );
      expect(engine.getCellFormula({ sheet: 0, row: 0, col: targetCol })).toBe(
        "=A1",
      );
    } finally {
      engine.destroy();
    }
  });
});
