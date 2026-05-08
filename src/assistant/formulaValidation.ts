import { GaussFormulaEngine } from "../lib/formulaEngine";
import { maybeFormulaEngineConfig } from "../config/simulation";
import { cellAddressFromA1 } from "./address";
import type { ValidateFormulaInput } from "../schemas/tools";
import type {
  SerializedCellContent,
  WorkbookSnapshot,
} from "../schemas/workbook";
import { buildWorkbookSnapshot } from "./workbookSnapshot";

const buildReplaySheetContent = (
  serializedContent: SerializedCellContent[][],
  rows: number,
  cols: number,
): SerializedCellContent[][] =>
  Array.from({ length: rows }, (_, row) =>
    Array.from(
      { length: cols },
      (_, col) => serializedContent[row]?.[col] ?? null,
    ),
  );

const createFormulaEngineFromSnapshot = (snapshot: WorkbookSnapshot) => {
  const formulaEngine = GaussFormulaEngine.buildEmpty(maybeFormulaEngineConfig);

  formulaEngine.addSheet(snapshot.sheetName || "Sheet1");

  const rows = Math.max(1, snapshot.dimensions.height);
  const cols = Math.max(1, snapshot.dimensions.width);
  const sheetData = buildReplaySheetContent(
    snapshot.serializedContent,
    rows,
    cols,
  );

  formulaEngine.setSheetContent(0, sheetData);
  return formulaEngine;
};

export const validateFormulaAgainstSnapshot = (
  snapshot: WorkbookSnapshot,
  input: ValidateFormulaInput,
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
      formula:
        formulaEngine.getCellFormula({
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
