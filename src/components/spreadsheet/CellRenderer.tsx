import React, {
  Suspense,
  lazy,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  getSamplesFromDistribution,
  isDistributionValue,
  isSampledDistributionValue,
  parseDistributionValue,
} from "../../utils/distribution/distributionUtils";
import {
  BooleanIcon,
  MicroSparkline,
  formatCellEditValue,
  formatCellValue,
  type CellValue,
} from "./cellFormatting";

import type { DistributionParams } from "../charts/distributionChartOptions";
import { SpreadsheetContext } from "../../context/SpreadsheetContext";
import styles from "./CellRenderer.module.css";

const DistributionPlot = lazy(() =>
  import("../charts/DistributionPlot").then((module) => ({
    default: module.DistributionPlot,
  })),
);

interface CellEditInputProps {
  initialValue: string;
  onCommit: (value: string) => void;
  onCancel: () => void;
  ariaLabel: string;
}

// Keeps the in-progress edit value in local state so typing does not
// re-render the parent Spreadsheet (and therefore every other cell) on
// every keystroke. This component mounts when editing begins and unmounts
// when it ends, so `initialValue` is captured fresh each edit session.
const CellEditInput: React.FC<CellEditInputProps> = ({
  initialValue,
  onCommit,
  onCancel,
  ariaLabel,
}) => {
  const [value, setValue] = useState(initialValue);
  return (
    <input
      autoFocus
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => onCommit(value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") onCommit(value);
        if (e.key === "Escape") onCancel();
      }}
      className={styles.editInput}
      aria-label={ariaLabel}
    />
  );
};

interface CellRendererProps {
  row: number;
  col: number;
  value: CellValue;
  onEdit: (row: number, col: number, value: string) => void;
  onClick?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  isSelected?: boolean;
  isEditing?: boolean;
  editValue?: string;
  onEditValueChange?: (value: string) => void;
  onRequestEdit?: (row: number, col: number, value: string) => void;
  onStopEdit?: () => void;
}

const CellRendererComponent: React.FC<CellRendererProps> = ({
  row,
  col,
  value,
  onEdit,
  onClick,
  onContextMenu,
  isSelected = false,
  isEditing = false,
  editValue = "",
  onRequestEdit,
  onStopEdit,
}) => {
  const { getCellFormula } = React.useContext(SpreadsheetContext);
  const [showPlot, setShowPlot] = useState(false);
  const [plotPosition, setPlotPosition] = useState({ top: 0, left: 0 });
  const explicitDistribution = useMemo(
    () => parseDistributionValue(value),
    [value],
  );
  // Only read samples while the viewer is open, and only once per value so the
  // plot's memoized chart data stays stable across re-renders.
  const plotSamples = useMemo(
    () => (showPlot ? getSamplesFromDistribution(value) : null),
    [showPlot, value],
  );
  const cellRef = useRef<HTMLDivElement>(null);

  const getDistributionColors = useCallback(() => {
    if (isSampledDistributionValue(value)) {
      return {
        bg: "var(--dist-sampled-bg)",
        border: "var(--dist-sampled-border)",
        accent: "var(--dist-sampled-accent)",
        variant: "sampled" as const,
      };
    }
    if (explicitDistribution) {
      switch (explicitDistribution.kind) {
        case "lognormal":
          return {
            bg: "var(--dist-lognormal-bg)",
            border: "var(--dist-lognormal-border)",
            accent: "var(--dist-lognormal-accent)",
            variant: "lognormal" as const,
          };
        case "uniform":
          return {
            bg: "var(--dist-uniform-bg)",
            border: "var(--dist-uniform-border)",
            accent: "var(--dist-uniform-accent)",
            variant: "uniform" as const,
          };
        case "normal":
        default:
          return {
            bg: "var(--dist-normal-bg)",
            border: "var(--dist-normal-border)",
            accent: "var(--dist-normal-accent)",
            variant: "normal" as const,
          };
      }
    }
    return null;
  }, [value, explicitDistribution]);

  const distColors = getDistributionColors();

  const startEditing = () => {
    const formula = getCellFormula(row, col);
    if (formula) {
      onRequestEdit?.(row, col, formula);
      return;
    }
    onRequestEdit?.(row, col, formatCellEditValue(value));
  };

  const handleCellClick = () => {
    onClick?.();
  };

  const handleChartHintClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!cellRef.current) return;
    const rect = cellRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const margin = 16;
    const panelWidth = Math.min(420, viewportWidth - margin * 2);
    const panelHeight = Math.min(360, viewportHeight - margin * 2);

    let left = rect.right + 12;
    if (left + panelWidth + margin > viewportWidth) {
      left = rect.left - panelWidth - 12;
    }
    left = Math.max(
      margin,
      Math.min(left, viewportWidth - panelWidth - margin),
    );

    let top = rect.top + rect.height / 2 - panelHeight / 2;
    top = Math.max(
      margin,
      Math.min(top, viewportHeight - panelHeight - margin),
    );

    setPlotPosition({ top, left });
    setShowPlot(true);
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

      if (isDistributionValue(value) || isSampledDistributionValue(value)) {
        setShowPlot(true);
      }
    }
  };

  const isDistribution =
    isDistributionValue(value) || isSampledDistributionValue(value);

  const leadingIcon = useMemo(() => {
    if (isDistributionValue(value) || isSampledDistributionValue(value)) {
      const sparkType = isSampledDistributionValue(value)
        ? ("sampled" as const)
        : (explicitDistribution?.kind ?? "normal");
      const sparkColor = distColors?.accent ?? "var(--text-muted)";
      return <MicroSparkline type={sparkType} color={sparkColor} />;
    }

    if (typeof value === "boolean") {
      return <BooleanIcon value={value} />;
    }

    return null;
  }, [value, explicitDistribution, distColors]);

  const displayValue = useMemo(() => formatCellValue(value), [value]);

  const cellClassName = [
    styles.cell,
    isSelected && styles.cellSelected,
    distColors?.variant === "normal" && styles.cellDistNormal,
    distColors?.variant === "lognormal" && styles.cellDistLognormal,
    distColors?.variant === "uniform" && styles.cellDistUniform,
    distColors?.variant === "sampled" && styles.cellDistSampled,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <div
        ref={cellRef}
        onClick={handleCellClick}
        onContextMenu={handleCustomContextMenu}
        onDoubleClick={startEditing}
        className={cellClassName}
        style={{
          gridTemplateColumns: isDistribution
            ? leadingIcon
              ? "auto 1fr auto"
              : "1fr auto"
            : leadingIcon
              ? "auto 1fr"
              : "1fr",
        }}
      >
        {isEditing ? (
          <CellEditInput
            initialValue={editValue}
            onCommit={(committed) => {
              onEdit(row, col, committed);
              onStopEdit?.();
            }}
            onCancel={() => onStopEdit?.()}
            ariaLabel={`Cell ${String.fromCharCode(65 + col)}${row + 1}`}
          />
        ) : (
          <>
            {leadingIcon}
            <span className={styles.cellText} title={displayValue}>
              {displayValue}
            </span>
            {isDistribution && !isEditing && (
              <button
                type="button"
                className={styles.chartHint}
                onClick={handleChartHintClick}
                title="View distribution"
                aria-label="View distribution chart"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <path d="M3 20 C6,20 8,18 10,14 C12,8 13,4 15,4 C17,4 18,8 20,14 C21,17 22,19 23,20" />
                  <line x1="3" y1="20" x2="23" y2="20" />
                </svg>
              </button>
            )}
          </>
        )}
      </div>
      {showPlot &&
        isDistribution &&
        (() => {
          const samples = plotSamples;
          if (!samples) return null;

          let distributionType: "normal" | "lognormal" | "uniform" | "sampled" =
            "sampled";
          let distributionParams: DistributionParams | null = null;
          let confidenceInterval:
            | { lower: number; upper: number; confidenceLevel: number }
            | undefined;

          if (explicitDistribution) {
            distributionType = explicitDistribution.kind;
            switch (explicitDistribution.kind) {
              case "normal":
                if (
                  explicitDistribution.mean !== undefined &&
                  explicitDistribution.variance !== undefined
                ) {
                  distributionParams = {
                    type: "normal",
                    mean: explicitDistribution.mean,
                    std: Math.sqrt(explicitDistribution.variance),
                  };
                }
                break;
              case "lognormal":
                if (
                  explicitDistribution.mu !== undefined &&
                  explicitDistribution.sigma !== undefined
                ) {
                  distributionParams = {
                    type: "lognormal",
                    mu: explicitDistribution.mu,
                    sigma: explicitDistribution.sigma,
                  };
                }
                break;
              case "uniform":
                if (
                  explicitDistribution.min !== undefined &&
                  explicitDistribution.max !== undefined
                ) {
                  distributionParams = {
                    type: "uniform",
                    a: explicitDistribution.min,
                    b: explicitDistribution.max,
                  };
                }
                break;
            }

            if (
              explicitDistribution.source === "ci" &&
              explicitDistribution.lower !== undefined &&
              explicitDistribution.upper !== undefined &&
              explicitDistribution.confidenceLevel !== undefined
            ) {
              confidenceInterval = {
                lower: explicitDistribution.lower,
                upper: explicitDistribution.upper,
                confidenceLevel: explicitDistribution.confidenceLevel,
              };
            }
          } else if (isSampledDistributionValue(value)) {
            distributionType = "sampled";
          }

          return (
            <Suspense fallback={null}>
              <DistributionPlot
                position={plotPosition}
                samples={samples}
                onClose={() => setShowPlot(false)}
                distributionType={distributionType}
                distributionParams={distributionParams}
                confidenceInterval={confidenceInterval}
              />
            </Suspense>
          );
        })()}
    </>
  );
};

// Memoized so cells whose props didn't change skip re-rendering when
// unrelated cells update (e.g. selection changes elsewhere in the grid).
export const CellRenderer = React.memo(CellRendererComponent);
