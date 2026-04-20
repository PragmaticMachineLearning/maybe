import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  getSamplesFromDistribution,
  isConfidenceIntervalValue,
  isSampledDistributionValue,
  parseConfidenceIntervalValue,
  parseSampledDistributionValue,
} from "../../utils/distribution/distributionUtils";
import {
  BooleanIcon,
  MicroSparkline,
  formatCellValue,
  type CellValue,
  type DistributionViewOptions,
} from "./cellFormatting";

import { DistributionPlot } from "../charts/DistributionPlot";
import {
  SpreadsheetContext,
  type DistributionViewType,
} from "../../context/SpreadsheetContext";
import { DistributionViewDropdown } from "./DistributionViewDropdown";
import styles from "./CellRenderer.module.css";

interface CellRendererProps {
  row: number;
  col: number;
  value: CellValue;
  onEdit: (row: number, col: number, value: string) => void;
  onClick?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  isSelected?: boolean;
  isEditing?: boolean;
  onRequestEdit?: (row: number, col: number) => void;
  onStopEdit?: () => void;
  onOpenAnalysis?: () => void;
}

export const CellRenderer: React.FC<CellRendererProps> = ({
  row,
  col,
  value,
  onEdit,
  onClick,
  onContextMenu,
  isSelected = false,
  isEditing = false,
  onRequestEdit,
  onStopEdit,
  onOpenAnalysis,
}) => {
  const {
    getCellFormula,
    getDistributionView,
    setDistributionView,
    clearDistributionView,
  } = useContext(SpreadsheetContext);
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

  const getDistributionColors = useCallback(() => {
    if (isSampledDistributionValue(value)) {
      return {
        bg: "var(--dist-sampled-bg)",
        border: "var(--dist-sampled-border)",
        accent: "var(--dist-sampled-accent)",
        variant: "sampled" as const,
      };
    }
    if (isConfidenceIntervalValue(value)) {
      switch (viewOptions.type) {
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
  }, [value, viewOptions.type]);

  const distColors = getDistributionColors();

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

  const startEditing = () => {
    const formula = getCellFormula(row, col);
    if (formula) {
      setTempValue(formula);
      onRequestEdit?.(row, col);
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
    onRequestEdit?.(row, col);
  };

  const handleCellClick = (event: React.MouseEvent) => {
    onClick?.();

    if (event.detail === 2) {
      startEditing();
    }
  };

  const handleBlur = () => {
    onEdit(row, col, tempValue);
    onStopEdit?.();
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

  const leadingIcon = useMemo(() => {
    if (isConfidenceIntervalValue(value) || isSampledDistributionValue(value)) {
      const sparkType = isSampledDistributionValue(value)
        ? ("sampled" as const)
        : viewOptions.type;
      const sparkColor = distColors?.accent ?? "var(--text-muted)";
      return <MicroSparkline type={sparkType} color={sparkColor} />;
    }

    if (typeof value === "boolean") {
      return <BooleanIcon value={value} />;
    }

    return null;
  }, [value, viewOptions.type, distColors]);

  const handleViewOptionChange = (type: "normal" | "lognormal" | "uniform") => {
    setViewOptions({ type });
    setDistributionView(row, col, type);
    setShowViewDropdown(false);
  };

  const displayValue = useMemo(
    () => formatCellValue(value, viewOptions),
    [value, viewOptions],
  );

  const handleOpenAnalysis = useCallback(() => {
    setShowPlot(false);
    if (onOpenAnalysis) {
      onOpenAnalysis();
    }
  }, [onOpenAnalysis]);

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
          gridTemplateColumns: showViewOptions
            ? "auto 1fr auto"
            : leadingIcon
              ? "auto 1fr"
              : "1fr",
        }}
      >
        {isEditing ? (
          <input
            autoFocus
            value={tempValue}
            onChange={(e) => setTempValue(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleBlur();
              if (e.key === "Escape") onStopEdit?.();
            }}
            className={styles.editInput}
            aria-label={`Cell ${String.fromCharCode(65 + col)}${row + 1}`}
          />
        ) : (
          <>
            {leadingIcon}
            <span className={styles.cellText} title={displayValue}>
              {displayValue}
            </span>
            {showViewOptions && !isEditing && (
              <DistributionViewDropdown
                viewType={viewOptions.type}
                showDropdown={showViewDropdown}
                onToggleDropdown={() => setShowViewDropdown(!showViewDropdown)}
                onSelectView={handleViewOptionChange}
                dropdownRef={dropdownRef}
              />
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
