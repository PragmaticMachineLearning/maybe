import GaussFormulaEngine from "gaussformula";
import type { RawCellContent } from "gaussformula";
import type { VisualDependencyGraph } from "../types/visualDependencyGraph";

export { GaussFormulaEngine };

interface SimpleCellAddress {
  sheet: number;
  row: number;
  col: number;
}

export interface FormulaEngine {
  addSheet(name: string): void;
  setSheetContent(sheetId: number, data: unknown[][]): void;
  destroy(): void;
  setCellContents(
    address: SimpleCellAddress,
    content: RawCellContent | RawCellContent[][],
  ): void;
  getCellValue(address: SimpleCellAddress): unknown;
  getCellSerialized(address: SimpleCellAddress): RawCellContent;
  getCellFormula(address: SimpleCellAddress): string | undefined;
  getSheetSerialized(sheetId: number): RawCellContent[][];
  getSheetDimensions(sheetId: number): { width: number; height: number };
  getSheetName(sheetId: number): string | undefined;
  validateFormula(formula: string): boolean;
  on(event: "valuesUpdated", callback: () => void): void;
  off(event: "valuesUpdated", callback: () => void): void;
  getVisualDependencyGraph(): VisualDependencyGraph;
}
