import { tool } from "ai";
import { z } from "zod";

import { GaussFormulaEngine } from "../lib/formulaEngine";
import { cellAddressFromA1 } from "./address";
import {
  assistantProposalSchema,
  normalizeAssistantProposal,
} from "./proposals";
import {
  buildWorkbookSnapshot,
  type WorkbookSnapshot,
} from "./workbookSnapshot";

const workbookContextInputSchema = z.object({
  range: z.string().optional(),
  include: z
    .object({
      cells: z.boolean().optional(),
      formulas: z.boolean().optional(),
      distributions: z.boolean().optional(),
      selection: z.boolean().optional(),
      dependencyGraph: z.boolean().optional(),
    })
    .optional(),
}).strict();

const validateFormulaInputSchema = z.object({
  cell: z.string(),
  formula: z.string(),
}).strict();

const createFormulaEngineFromSnapshot = (snapshot: WorkbookSnapshot) => {
  const formulaEngine = GaussFormulaEngine.buildEmpty({
    licenseKey: "gpl-v3",
    language: "enGB",
    useColumnIndex: true,
    sampleSize: 10000,
  });

  formulaEngine.addSheet(snapshot.sheetName || "Sheet1");

  const rows = Math.max(1, snapshot.dimensions.height);
  const cols = Math.max(1, snapshot.dimensions.width);
  const sheetData: Array<Array<string | null>> = Array.from(
    { length: rows },
    () => Array.from({ length: cols }, () => null),
  );

  for (const cell of snapshot.cells) {
    if (cell.row < 0 || cell.col < 0 || cell.row >= rows || cell.col >= cols) {
      continue;
    }

    sheetData[cell.row][cell.col] = cell.formula ?? cell.displayValue;
  }

  formulaEngine.setSheetContent(0, sheetData);
  return formulaEngine;
};

const validateFormulaAgainstSnapshot = (
  snapshot: WorkbookSnapshot,
  input: z.infer<typeof validateFormulaInputSchema>,
) => {
  const normalizedCell = input.cell.trim().toUpperCase();
  const address = cellAddressFromA1(normalizedCell, snapshot.dimensions);

  if (!address) {
    return {
      cell: normalizedCell,
      formula: input.formula,
      valid: false,
      error: `${normalizedCell} is outside the current sheet.`,
    };
  }

  const formulaEngine = createFormulaEngineFromSnapshot(snapshot);

  try {
    formulaEngine.setCellContents(
      { sheet: 0, row: address.row, col: address.col },
      input.formula,
    );
    const validationSnapshot = buildWorkbookSnapshot({
      formulaEngine,
      selectedCell: { row: address.row, col: address.col },
      maxCells: snapshot.dimensions.width * snapshot.dimensions.height,
      minimumDimensions: snapshot.dimensions,
    });
    const targetCell = validationSnapshot.cells.find(
      (cell) => cell.address === normalizedCell,
    );
    const errorMessage =
      targetCell?.kind === "error" ? targetCell.displayValue : undefined;

    return {
      cell: normalizedCell,
      formula: formulaEngine.getCellFormula({
        sheet: 0,
        row: address.row,
        col: address.col,
      }) ?? input.formula,
      valid: targetCell !== undefined && targetCell.kind !== "error",
      displayValue: targetCell?.displayValue ?? "",
      kind: targetCell?.kind ?? "text",
      error: errorMessage,
    };
  } catch (error) {
    return {
      cell: normalizedCell,
      formula: input.formula,
      valid: false,
      error:
        error instanceof Error
          ? error.message
          : "Unable to validate this formula.",
    };
  } finally {
    formulaEngine.destroy();
  }
};

export const createAssistantTools = (workbookSnapshot: WorkbookSnapshot) => ({
  getWorkbookContext: tool({
    description:
      "Inspect the current Maybe workbook snapshot, including cells, formulas, selected cell, and distribution summaries.",
    inputSchema: workbookContextInputSchema,
    execute: async () => workbookSnapshot,
  }),
  validateFormula: tool({
    description:
      "Validate a Maybe/GaussFormula cell formula or value against the current workbook before proposing it.",
    inputSchema: validateFormulaInputSchema,
    execute: async (input) =>
      validateFormulaAgainstSnapshot(workbookSnapshot, input),
  }),
  proposeCellChanges: tool({
    description:
      "Return typed spreadsheet cell changes for the user to review and apply. This tool does not mutate the workbook.",
    inputSchema: assistantProposalSchema,
    execute: async (proposal) => normalizeAssistantProposal(proposal),
  }),
});
