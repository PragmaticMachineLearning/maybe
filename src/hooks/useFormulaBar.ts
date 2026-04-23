import { useCallback, useContext, useEffect, useState } from "react";
import { SpreadsheetContext } from "../context/SpreadsheetContext";
import {
  confidenceLevelToFormulaArgument,
  formatDistributionFormulaNumber,
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
        case "normal": {
          if (
            distribution.source === "ci" &&
            distribution.lower !== undefined &&
            distribution.upper !== undefined &&
            distribution.confidenceLevel !== undefined
          ) {
            const lower = formatDistributionFormulaNumber(distribution.lower);
            const upper = formatDistributionFormulaNumber(distribution.upper);
            const confidence = formatDistributionFormulaNumber(
              confidenceLevelToFormulaArgument(distribution.confidenceLevel),
            );
            return `N.CI(${lower}, ${upper}, ${confidence})`;
          }
          const mean = formatDistributionFormulaNumber(distribution.mean ?? 0);
          const variance = formatDistributionFormulaNumber(
            distribution.variance ?? 0,
          );
          return `N(${mean}, ${variance})`;
        }
        case "lognormal": {
          if (
            distribution.source === "ci" &&
            distribution.lower !== undefined &&
            distribution.upper !== undefined &&
            distribution.confidenceLevel !== undefined
          ) {
            const lower = formatDistributionFormulaNumber(distribution.lower);
            const upper = formatDistributionFormulaNumber(distribution.upper);
            const confidence = formatDistributionFormulaNumber(
              confidenceLevelToFormulaArgument(distribution.confidenceLevel),
            );
            return `LN.CI(${lower}, ${upper}, ${confidence})`;
          }
          const mu = formatDistributionFormulaNumber(distribution.mu ?? 0);
          const sigma = formatDistributionFormulaNumber(
            distribution.sigma ?? 0,
          );
          return `LN(${mu}, ${sigma})`;
        }
        case "uniform": {
          const min = formatDistributionFormulaNumber(distribution.min ?? 0);
          const max = formatDistributionFormulaNumber(distribution.max ?? 0);
          return `U(${min}, ${max})`;
        }
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
