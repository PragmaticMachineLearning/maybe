import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  getConfidenceIntervalMedian,
  getSamplesFromDistribution,
  isConfidenceIntervalValue,
  isSampledDistributionValue,
  parseConfidenceIntervalValue,
  parseSampledDistributionValue,
  zScoreForConfidence,
} from "../utils/distributionUtils";

import { DistributionPlot } from "./DistributionPlot";
import { SpreadsheetContext } from "../SpreadsheetContext";

const ChevronDownIcon: React.FC<{ size?: number; color?: string }> = ({
  size = 14,
  color = "currentColor",
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path
      d="M6 9L12 15L18 9"
      stroke={color}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const DistributionIcon: React.FC = () => (
  <svg
    width={18}
    height={18}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path
      d="M4 18C6 14 8.5 9 12 9C15.5 9 16.5 14 20 6"
      stroke="var(--resize-handle-active)"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <line
      x1="4"
      y1="18"
      x2="20"
      y2="18"
      stroke="var(--border-color)"
      strokeWidth="1.25"
      strokeLinecap="round"
    />
  </svg>
);

const BooleanIcon: React.FC<{ value: boolean }> = ({ value }) => (
  <svg
    width={16}
    height={16}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <circle
      cx="12"
      cy="12"
      r="9"
      stroke="var(--border-header)"
      strokeWidth="1.5"
    />
    {value ? (
      <path
        d="M9 12.5L11 14.5L15 9.5"
        stroke="var(--resize-handle-active)"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ) : (
      <>
        <path
          d="M9 9L15 15"
          stroke="var(--text-muted)"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
        <path
          d="M15 9L9 15"
          stroke="var(--text-muted)"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
      </>
    )}
  </svg>
);

// Distribution interpretation options for the dropdown
interface DistributionViewOptions {
  type: "normal" | "lognormal" | "uniform";
}

interface CellRendererProps {
  row: number;
  col: number;
  value: CellValue;
  onEdit: (row: number, col: number, value: string) => void;
  onClick?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  isSelected?: boolean;
  onOpenAnalysis?: () => void;
}

type CellValue =
  | string
  | number
  | boolean
  | number[]
  | null
  | { samples: number[] }
  | { mean: number; variance: number };

export const CellRenderer: React.FC<CellRendererProps> = ({
  row,
  col,
  value,
  onEdit,
  onClick,
  onContextMenu,
  isSelected = false,
  onOpenAnalysis,
}) => {
  const {
    getCellFormula,
    liveEditingState,
    setLiveEditingState,
    getDistributionView,
    setDistributionView,
    clearDistributionView,
  } = useContext(SpreadsheetContext);
  const [editing, setEditing] = useState(false);
  const [tempValue, setTempValue] = useState("");
  const [showPlot, setShowPlot] = useState(false);
  const [plotPosition, setPlotPosition] = useState({ top: 0, left: 0 });
  const [showViewDropdown, setShowViewDropdown] = useState(false);
  const inferViewFromValue = () => {
    if (isConfidenceIntervalValue(value)) {
      const override = getDistributionView(row, col);
      if (override) {
        return override;
      }
      const ci = parseConfidenceIntervalValue(value);
      const interpretation = ci?.interpretation;
      if (interpretation === "lognormal") {
        return "lognormal";
      }
      if (interpretation === "uniform") {
        return "uniform";
      }
    }
    return "normal";
  };
  const [viewOptions, setViewOptions] = useState<DistributionViewOptions>(
    () => ({
      type: inferViewFromValue(),
    }),
  );
  const cellRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Update live editing state whenever tempValue changes
  useEffect(() => {
    if (editing) {
      setLiveEditingState({ row, col, value: tempValue });
    }
  }, [editing, tempValue, row, col, setLiveEditingState]);

  // Clear live editing state when cell stops editing
  useEffect(() => {
    if (
      !editing &&
      liveEditingState?.row === row &&
      liveEditingState?.col === col
    ) {
      setLiveEditingState(null);
    }
  }, [editing, row, col, liveEditingState, setLiveEditingState]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowViewDropdown(false);
      }
    };

    if (showViewDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showViewDropdown]);

  useEffect(() => {
    if (isConfidenceIntervalValue(value)) {
      const override = getDistributionView(row, col);
      const ci = parseConfidenceIntervalValue(value);
      let nextType: DistributionViewType = "normal";
      if (override) {
        nextType = override;
      } else if (ci?.interpretation === "lognormal") {
        nextType = "lognormal";
      } else if (ci?.interpretation === "uniform") {
        nextType = "uniform";
      }

      setViewOptions((prev) =>
        prev.type === nextType ? prev : { type: nextType },
      );

      if (!override) {
        setDistributionView(row, col, nextType);
      }
    } else {
      if (viewOptions.type !== "normal") {
        setViewOptions({ type: "normal" });
      }
      clearDistributionView(row, col);
    }
  }, [
    value,
    row,
    col,
    getDistributionView,
    setDistributionView,
    clearDistributionView,
    viewOptions.type,
  ]);

  const handleDoubleClick = () => {
    const formula = getCellFormula(row, col);
    if (formula) {
      setTempValue(formula);
      setEditing(true);
      return;
    }
    if (isConfidenceIntervalValue(value)) {
      const ci = parseConfidenceIntervalValue(value);
      if (ci) {
        const ciDistRepresentation = `[${ci.lower.toFixed(2)}, ${ci.upper.toFixed(2)}]`;
        setTempValue(ciDistRepresentation);
      } else {
        setTempValue("");
      }
    } else if (isSampledDistributionValue(value)) {
      const sampled = parseSampledDistributionValue(value);
      if (sampled) {
        const sampledDistRepresentation = `S(μ=${sampled.mean.toFixed(2)}, σ²=${(sampled.std ** 2).toFixed(2)})`;
        setTempValue(sampledDistRepresentation);
      } else {
        setTempValue("");
      }
    } else {
      setTempValue(value ? String(value) : "");
    }
    setEditing(true);
  };

  const handleBlur = () => {
    onEdit(row, col, tempValue);
    setEditing(false);
  };

  const handleTempValueChange = (newValue: string) => {
    setTempValue(newValue);
    // The useEffect above will automatically update the live editing state
  };

  const handleCustomContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if (onContextMenu) {
      onContextMenu(e);
    }

    if (typeof window !== "undefined") {
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const margin = 16;
      const clickX = e.clientX;
      const clickY = e.clientY;

      const panelWidth = Math.min(420, viewportWidth - margin * 2);
      const panelHeight = Math.min(360, viewportHeight - margin * 2);

      const desiredLeft = clickX + 12;
      const alternateLeft = clickX - panelWidth - 12;
      let left =
        desiredLeft + panelWidth + margin > viewportWidth
          ? Math.max(margin, alternateLeft)
          : desiredLeft;
      left = Math.max(
        margin,
        Math.min(left, viewportWidth - panelWidth - margin),
      );

      let top = clickY - panelHeight / 2;
      if (top < margin) {
        top = margin;
      } else if (top + panelHeight > viewportHeight - margin) {
        top = viewportHeight - panelHeight - margin;
      }

      setPlotPosition({
        top,
        left,
      });

      if (
        isConfidenceIntervalValue(value) ||
        isSampledDistributionValue(value)
      ) {
        setShowPlot(true);
      }
    }
  };

  // Update isDistribution to only include the two types we support in unified approach
  const isDistribution =
    isConfidenceIntervalValue(value) || isSampledDistributionValue(value);

  // Only show view options for confidence intervals, not sampled distributions
  const showViewOptions = isConfidenceIntervalValue(value);

  // Update formatValue to handle confidence intervals
  const formatValue = (
    val: CellValue,
    options: DistributionViewOptions,
  ): string => {
    if (val === null || val === undefined) return "";

    // Handle boolean values from comparison operations
    if (typeof val === "boolean") {
      return val ? "TRUE" : "FALSE";
    }

    // Handle primitive types
    if (typeof val === "string" || typeof val === "number") {
      return String(val);
    }

    // Format ConfidenceIntervalNumber
    if (isConfidenceIntervalValue(val)) {
      const ci = parseConfidenceIntervalValue(val);
      if (ci) {
        const median = getConfidenceIntervalMedian(ci);

        switch (options.type) {
          case "normal":
            // Show as normal distribution approximation
            const mean = (ci.lower + ci.upper) / 2;
            const zScore = zScoreForConfidence(ci.confidenceLevel);
            const std = (ci.upper - ci.lower) / (2 * zScore);
            return `N(μ=${mean.toFixed(2)}, σ=${std.toFixed(2)})`;

          case "lognormal":
            // Show as log-normal parameters
            if (ci.lower > 0 && ci.upper > 0) {
              const lnLower = Math.log(ci.lower);
              const lnUpper = Math.log(ci.upper);
              const mu = (lnLower + lnUpper) / 2;
              const sigma = (lnUpper - lnLower) / 3.29;
              return `LN(μ=${mu.toFixed(2)}, σ=${sigma.toFixed(2)})`;
            }
            return `${median.toFixed(2)} [${ci.lower}-${ci.upper}]`;

          case "uniform":
            // Show as uniform distribution
            return `U[${ci.lower.toFixed(2)}, ${ci.upper.toFixed(2)}]`;

          default:
            return `${median.toFixed(2)} [${ci.lower}-${ci.upper}]`;
        }
      }
    }
    // These distribution types no longer exist as input types in our unified approach
    // Format SampledDistribution objects (results from calculations)
    // Always show as samples with mean and std deviation
    if (isSampledDistributionValue(val)) {
      const sampled = parseSampledDistributionValue(val);
      if (sampled) {
        return `S(μ=${sampled.mean.toFixed(2)}, σ=${sampled.std.toFixed(2)})`;
      }
    }

    return String(val);
  };

  const leadingIcon = useMemo(() => {
    if (isConfidenceIntervalValue(value) || isSampledDistributionValue(value)) {
      return <DistributionIcon />;
    }

    if (typeof value === "boolean") {
      return <BooleanIcon value={value} />;
    }

    return null;
  }, [value]);

  const handleViewOptionChange = (newOptions: DistributionViewOptions) => {
    setViewOptions(newOptions);
    setDistributionView(row, col, newOptions.type);
    setShowViewDropdown(false);
  };

  const displayValue = useMemo(
    () => formatValue(value, viewOptions),
    [value, viewOptions],
  );

  const handleOpenAnalysis = useCallback(() => {
    setShowPlot(false);
    if (onOpenAnalysis) {
      onOpenAnalysis();
    }
  }, [onOpenAnalysis]);

  return (
    <>
      <div
        ref={cellRef}
        onClick={onClick}
        onContextMenu={handleCustomContextMenu}
        onDoubleClick={handleDoubleClick}
        style={{
          padding: "10px 14px",
          minHeight: "38px",
          backgroundColor: isSelected ? "var(--bg-hover)" : "var(--bg-surface)",
          color: "var(--text-primary)",
          cursor: "pointer",
          transition: "background-color 0.2s ease, box-shadow 0.2s ease",
          position: "relative",
          fontFamily:
            '"SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          width: "100%",
          boxSizing: "border-box",
          fontSize: "13px",
          display: "grid",
          gridTemplateColumns: showViewOptions
            ? "auto 1fr auto"
            : leadingIcon
              ? "auto 1fr"
              : "1fr",
          alignItems: "center",
          gap: "10px",
          boxShadow: isSelected
            ? "inset 0 0 0 1px var(--resize-handle-active)"
            : "none",
        }}
      >
        {editing ? (
          <input
            autoFocus
            value={tempValue}
            onChange={(e) => handleTempValueChange(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleBlur();
              if (e.key === "Escape") setEditing(false);
            }}
            style={{
              width: "100%",
              height: "100%",
              border: "none",
              outline: "none",
              padding: "0 2px",
              backgroundColor: "transparent",
              position: "absolute",
              top: 0,
              left: 0,
              color: "var(--text-primary)",
              fontFamily: "inherit",
              fontSize: "inherit",
              letterSpacing: "0.01em",
            }}
            aria-label={`Cell ${String.fromCharCode(65 + col)}${row + 1}`}
          />
        ) : (
          <>
            {leadingIcon}
            <span
              style={{
                display: "block",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                color: "var(--text-primary)",
                alignSelf: "stretch",
                letterSpacing: "0.01em",
              }}
              title={displayValue}
            >
              {displayValue}
            </span>
            {showViewOptions && !editing && (
              <div style={{ position: "relative" }} ref={dropdownRef}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowViewDropdown(!showViewDropdown);
                  }}
                  style={{
                    backgroundColor: showViewDropdown
                      ? "var(--bg-hover)"
                      : "var(--bg-surface)",
                    border: `1px solid ${showViewDropdown ? "var(--resize-handle-active)" : "var(--border-color)"}`,
                    cursor: "pointer",
                    padding: "6px",
                    color: "var(--text-secondary)",
                    fontSize: "12px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: "10px",
                    minWidth: "34px",
                    boxShadow: showViewDropdown
                      ? "0 6px 18px rgba(15, 31, 31, 0.12)"
                      : "0 2px 6px rgba(15, 31, 31, 0.06)",
                    transition: "all 0.2s ease",
                  }}
                  title="Change view"
                >
                  <ChevronDownIcon size={14} />
                </button>
                {showViewDropdown && (
                  <div
                    style={{
                      position: "absolute",
                      top: "100%",
                      right: 0,
                      backgroundColor: "var(--bg-surface)",
                      border: "1px solid var(--border-color)",
                      borderRadius: "12px",
                      boxShadow: "0 18px 40px rgba(15, 31, 31, 0.16)",
                      zIndex: 1000,
                      minWidth: "200px",
                      fontSize: "12px",
                      overflow: "hidden",
                    }}
                  >
                    <div style={{ padding: "6px 0" }}>
                      {/* Only show interpretation options for confidence intervals */}
                      {isConfidenceIntervalValue(value) && (
                        <>
                          <div
                            style={{
                              padding: "8px 14px",
                              borderBottom: "1px solid var(--border-color)",
                              fontWeight: "bold",
                              color: "var(--text-secondary)",
                              fontSize: "11px",
                              letterSpacing: "0.08em",
                              textTransform: "uppercase",
                            }}
                          >
                            View as:
                          </div>
                          <button
                            onClick={() =>
                              handleViewOptionChange({
                                type: "normal",
                              })
                            }
                            style={{
                              width: "100%",
                              padding: "10px 14px",
                              border: "none",
                              background:
                                viewOptions.type === "normal"
                                  ? "var(--bg-hover)"
                                  : "transparent",
                              color:
                                viewOptions.type === "normal"
                                  ? "var(--text-secondary)"
                                  : "var(--text-primary)",
                              textAlign: "left",
                              cursor: "pointer",
                              fontSize: "12px",
                              display: "flex",
                              alignItems: "center",
                              gap: "10px",
                            }}
                          >
                            <DistributionIcon />
                            Normal Distribution
                          </button>
                          <button
                            onClick={() =>
                              handleViewOptionChange({
                                type: "lognormal",
                              })
                            }
                            style={{
                              width: "100%",
                              padding: "10px 14px",
                              border: "none",
                              background:
                                viewOptions.type === "lognormal"
                                  ? "var(--bg-hover)"
                                  : "transparent",
                              color:
                                viewOptions.type === "lognormal"
                                  ? "var(--text-secondary)"
                                  : "var(--text-primary)",
                              textAlign: "left",
                              cursor: "pointer",
                              fontSize: "12px",
                              display: "flex",
                              alignItems: "center",
                              gap: "10px",
                            }}
                          >
                            <DistributionIcon />
                            Log-Normal Distribution
                          </button>
                          <button
                            onClick={() =>
                              handleViewOptionChange({
                                type: "uniform",
                              })
                            }
                            style={{
                              width: "100%",
                              padding: "10px 14px",
                              border: "none",
                              background:
                                viewOptions.type === "uniform"
                                  ? "var(--bg-hover)"
                                  : "transparent",
                              color:
                                viewOptions.type === "uniform"
                                  ? "var(--text-secondary)"
                                  : "var(--text-primary)",
                              textAlign: "left",
                              cursor: "pointer",
                              fontSize: "12px",
                              display: "flex",
                              alignItems: "center",
                              gap: "10px",
                            }}
                          >
                            <DistributionIcon />
                            Uniform Distribution
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
      {showPlot &&
        isDistribution &&
        (() => {
          const samples = getSamplesFromDistribution(value);
          if (!samples) return null;

          // Get distribution type and confidence interval info
          let distributionType: "normal" | "lognormal" | "uniform" | "sampled" =
            "sampled";
          let confidenceInterval:
            | { lower: number; upper: number; confidenceLevel: number }
            | undefined;

          if (isConfidenceIntervalValue(value)) {
            const ci = parseConfidenceIntervalValue(value);
            if (ci) {
              confidenceInterval = {
                lower: ci.lower,
                upper: ci.upper,
                confidenceLevel: ci.confidenceLevel,
              };

              // Map view options to distribution types
              switch (viewOptions.type) {
                case "normal":
                  distributionType = "normal";
                  break;
                case "lognormal":
                  distributionType = "lognormal";
                  break;
                case "uniform":
                  distributionType = "uniform";
                  break;
              }
            }
          } else if (isSampledDistributionValue(value)) {
            distributionType = "sampled";
          }

          return (
            <DistributionPlot
              position={plotPosition}
              samples={samples}
              onClose={() => setShowPlot(false)}
              distributionType={distributionType}
              confidenceInterval={confidenceInterval}
              onOpenAnalysis={onOpenAnalysis ? handleOpenAnalysis : undefined}
            />
          );
        })()}
    </>
  );
};
