import { useCallback, useContext, useEffect, useState } from "react";
import { SpreadsheetContext } from "../context/SpreadsheetContext";

interface SelectedCell {
  row: number;
  col: number;
}

const formatCellValue = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";

  if (typeof value === "object" && value !== null) {
    const v = value as Record<string, unknown>;
    if (typeof v.mean === "number" && typeof v.variance === "number")
      return `N(μ=${v.mean.toFixed(2)}, σ²=${v.variance.toFixed(2)})`;
    if (typeof v.mu === "number" && typeof v.sigma2 === "number")
      return `LN(μ=${v.mu.toFixed(2)}, σ²=${v.sigma2.toFixed(2)})`;
    if (typeof v.a === "number" && typeof v.b === "number")
      return `U[${v.a.toFixed(2)}, ${v.b.toFixed(2)}]`;
    if (typeof v.lower === "number" && typeof v.upper === "number" && typeof v.confidenceLevel === "number")
      return `CI[${v.lower.toFixed(2)}, ${v.upper.toFixed(2)}]`;
  }

  return String(value);
};

export function useFormulaBar(selectedCell: SelectedCell | null) {
  const { formulaEngine, submitFormula } = useContext(SpreadsheetContext);
  const [formulaInput, setFormulaInput] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  const updateFormulaInput = useCallback(() => {
    if (!selectedCell || !formulaEngine) {
      setFormulaInput((prev) => (prev === "" ? prev : ""));
      return;
    }

    const { row, col } = selectedCell;
    const formula = formulaEngine.getCellFormula({ sheet: 0, row, col });
    const value = formulaEngine.getCellValue({ sheet: 0, row, col });

    let nextValue = "";
    if (formula) {
      nextValue = formula;
    } else if (value !== null && value !== undefined) {
      nextValue = formatCellValue(value);
    }

    setFormulaInput((prev) => (prev === nextValue ? prev : nextValue));
  }, [selectedCell, formulaEngine]);

  useEffect(() => {
    updateFormulaInput();
  }, [updateFormulaInput]);

  useEffect(() => {
    if (!formulaEngine) return;
    const handler = () => {
      if (!isEditing) updateFormulaInput();
    };
    formulaEngine.on("valuesUpdated", handler);
    return () => {
      formulaEngine.off("valuesUpdated", handler);
    };
  }, [formulaEngine, isEditing, updateFormulaInput]);

  const handleChange = useCallback((value: string) => {
    setFormulaInput(value);
    setIsEditing(true);
  }, []);

  const handleCommit = useCallback(() => {
    if (selectedCell) {
      submitFormula(selectedCell.row, selectedCell.col, formulaInput);
    }
    setIsEditing(false);
  }, [selectedCell, formulaInput, submitFormula]);

  const handleCancel = useCallback(() => {
    updateFormulaInput();
    setIsEditing(false);
  }, [updateFormulaInput]);

  return {
    formulaValue: formulaInput,
    onFormulaChange: handleChange,
    onFormulaCommit: handleCommit,
    onFormulaCancel: handleCancel,
  };
}
