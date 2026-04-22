import { useCallback, useContext, useEffect, useState } from "react";
import { SpreadsheetContext } from "../context/SpreadsheetContext";
import {
  confidenceLevelToFormulaArgument,
  parseDistributionValue,
  parseSampledDistributionValue,
} from "../utils/distribution/distributionUtils";

interface SelectedCell {
  row: number;
  col: number;
}

export const formatFormulaBarCellValue = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";

  if (typeof value === "object" && value !== null) {
    const distribution = parseDistributionValue(value);
    if (distribution) {
      switch (distribution.kind) {
        case "normal":
          if (
            distribution.source === "ci" &&
            distribution.lower !== undefined &&
            distribution.upper !== undefined &&
            distribution.confidenceLevel !== undefined
          ) {
            return `N.CI(${distribution.lower.toFixed(2)}, ${distribution.upper.toFixed(2)}, ${confidenceLevelToFormulaArgument(distribution.confidenceLevel).toFixed(2)})`;
          }
          return `N(${(distribution.mean ?? 0).toFixed(2)}, ${(distribution.variance ?? 0).toFixed(2)})`;
        case "lognormal":
          if (
            distribution.source === "ci" &&
            distribution.lower !== undefined &&
            distribution.upper !== undefined &&
            distribution.confidenceLevel !== undefined
          ) {
            return `LN.CI(${distribution.lower.toFixed(2)}, ${distribution.upper.toFixed(2)}, ${confidenceLevelToFormulaArgument(distribution.confidenceLevel).toFixed(2)})`;
          }
          return `LN(${(distribution.mu ?? 0).toFixed(2)}, ${(distribution.sigma ?? 0).toFixed(2)})`;
        case "uniform":
          return `U(${(distribution.min ?? 0).toFixed(2)}, ${(distribution.max ?? 0).toFixed(2)})`;
      }
    }

    const sampled = parseSampledDistributionValue(value);
    if (sampled) {
      return `S(μ=${sampled.mean.toFixed(2)}, σ=${sampled.std.toFixed(2)})`;
    }

    const v = value as Record<string, unknown>;
    if (typeof v.mean === "number" && typeof v.variance === "number")
      return `S(μ=${v.mean.toFixed(2)}, σ=${Math.sqrt(v.variance).toFixed(2)})`;
    if (typeof v.mu === "number" && typeof v.sigma2 === "number")
      return `LN(μ=${v.mu.toFixed(2)}, σ=${Math.sqrt(v.sigma2).toFixed(2)})`;
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
      nextValue = formatFormulaBarCellValue(value);
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
