import React, { useCallback, useEffect, useRef, useState } from "react";
import { DistributionPlot } from "../charts/DistributionPlot";
import type { ParsedConfidenceInterval } from "../../utils/distribution/distributionUtils";
import { formatNumber } from "../../utils/formatting/formatUtils";
import styles from "./AnalysisPanel.module.css";

interface AnalysisPanelProps {
  cellLabel: string;
  samples: number[] | null;
  distributionType: "normal" | "lognormal" | "uniform" | "sampled";
  confidenceInterval?: ParsedConfidenceInterval | null;
  onClose: () => void;
  message?: string;
  compact?: boolean;
}

const DEFAULT_PANEL_WIDTH = 320;
const MIN_PANEL_WIDTH = 260;
const MAX_PANEL_WIDTH = 640;

const clampPanelWidth = (value: number) =>
  Math.min(MAX_PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, value));

const percentile = (sorted: number[], p: number) => {
  if (!sorted.length) {
    return NaN;
  }
  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) {
    return sorted[lower];
  }
  const weight = index - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
};

const buildSummary = (samples: number[]) => {
  if (!samples.length) {
    return null;
  }
  const sorted = [...samples].sort((a, b) => a - b);
  const mean = samples.reduce((acc, value) => acc + value, 0) / samples.length;
  const variance =
    samples.reduce((acc, value) => acc + Math.pow(value - mean, 2), 0) /
    samples.length;
  const std = Math.sqrt(variance);
  return {
    mean,
    std,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    p10: percentile(sorted, 10),
    p50: percentile(sorted, 50),
    p90: percentile(sorted, 90),
  };
};

/* ── Helper Components ──────────────────────────────────────────────── */

const RangeBar: React.FC<{
  lower: number;
  upper: number;
  median: number;
  color: string;
}> = ({ lower, upper, median, color }) => {
  const range = upper - lower;
  const medianPct = range > 0 ? ((median - lower) / range) * 100 : 50;

  return (
    <div className={styles.rangeBarWrapper}>
      <div className={styles.rangeBarTrack}>
        <div
          className={styles.rangeBarFill}
          style={{
            background: `linear-gradient(90deg, ${color}44, ${color}aa, ${color}44)`,
          }}
        />
        <div
          className={styles.rangeBarMedianDot}
          style={{
            left: `${medianPct}%`,
            backgroundColor: color,
          }}
        />
      </div>
      <div className={styles.rangeBarLabels}>
        <span className={styles.rangeBarLabel}>{formatNumber(lower)}</span>
        <span className={styles.rangeBarLabelMedian}>
          {formatNumber(median)}
        </span>
        <span className={styles.rangeBarLabel}>{formatNumber(upper)}</span>
      </div>
    </div>
  );
};

const StatChip: React.FC<{ label: string; value: string }> = ({
  label,
  value,
}) => (
  <div className={styles.statChip}>
    <span className={styles.statChipLabel}>{label}</span>
    <span className={styles.statChipValue}>{value}</span>
  </div>
);

const StatCard: React.FC<{ label: string; value: string }> = ({
  label,
  value,
}) => (
  <div className={styles.statCard}>
    <div className={styles.statCardLabel}>{label}</div>
    <div className={styles.statCardValue}>{value}</div>
  </div>
);

/* ── Badge class map ────────────────────────────────────────────────── */

const badgeClassMap: Record<string, string> = {
  normal: styles.badgeNormal,
  lognormal: styles.badgeLognormal,
  uniform: styles.badgeUniform,
  sampled: styles.badgeSampled,
};

const badgeLabelMap: Record<string, string> = {
  normal: "Normal",
  lognormal: "Log-Normal",
  uniform: "Uniform",
  sampled: "Sampled",
};

/* ── Main Component ─────────────────────────────────────────────────── */

export const AnalysisPanel: React.FC<AnalysisPanelProps> = ({
  cellLabel,
  samples,
  distributionType,
  confidenceInterval,
  onClose,
  message,
  compact = false,
}) => {
  const summary = samples ? buildSummary(samples) : null;
  const [panelWidth, setPanelWidth] = useState(DEFAULT_PANEL_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const [statsExpanded, setStatsExpanded] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const resizeStateRef = useRef<{ startX: number; startWidth: number } | null>(
    null,
  );

  /* ── Badge info ─────────────────────────────────────────────────── */

  const badgeClass = badgeClassMap[distributionType] ?? styles.badgeNormal;
  const distributionLabel = badgeLabelMap[distributionType] ?? "Distribution";

  /* ── Resize logic (unchanged) ───────────────────────────────────── */

  const handleResizeStart = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (compact) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      const container = panelRef.current;
      const startWidth = container?.getBoundingClientRect().width ?? panelWidth;
      resizeStateRef.current = {
        startX: event.clientX,
        startWidth: clampPanelWidth(startWidth),
      };
      setIsResizing(true);
    },
    [compact, panelWidth],
  );

  useEffect(() => {
    if (typeof window === "undefined" || !isResizing || compact) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (!resizeStateRef.current) {
        return;
      }
      const { startX, startWidth } = resizeStateRef.current;
      const delta = startX - event.clientX;
      setPanelWidth(clampPanelWidth(startWidth + delta));
    };

    const handlePointerEnd = () => {
      resizeStateRef.current = null;
      setIsResizing(false);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerEnd);
    window.addEventListener("pointercancel", handlePointerEnd);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerEnd);
      window.removeEventListener("pointercancel", handlePointerEnd);
    };
  }, [compact, isResizing]);

  useEffect(() => {
    if (typeof document === "undefined" || !isResizing) {
      return;
    }

    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    return () => {
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
    };
  }, [isResizing]);

  useEffect(() => {
    if (!compact) {
      return;
    }
    resizeStateRef.current = null;
    setIsResizing(false);
  }, [compact]);

  const effectiveWidth = compact ? "100%" : `${panelWidth}px`;
  const effectiveFlex = compact ? "1 1 auto" : `0 0 ${panelWidth}px`;

  /* ── Render ─────────────────────────────────────────────────────── */

  return (
    <aside
      ref={panelRef}
      className={`${styles.panel}${isResizing ? ` ${styles.panelResizing}` : ""}`}
      style={{
        width: effectiveWidth,
        maxWidth: compact ? "100%" : `${MAX_PANEL_WIDTH}px`,
        minWidth: compact ? "100%" : `${MIN_PANEL_WIDTH}px`,
        flex: effectiveFlex,
        maxHeight: compact ? "none" : "calc(100vh - 120px)",
      }}
    >
      {/* Resize Handle */}
      {!compact && (
        <div
          onPointerDown={handleResizeStart}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize analysis panel"
          className={styles.resizeHandle}
        >
          <div
            className={`${styles.resizeHandleDot}${isResizing ? ` ${styles.resizeHandleDotActive}` : ""}`}
          />
        </div>
      )}

      {/* ── Zone A: Distribution Header Card ──────────────────────── */}
      <header className={styles.header}>
        <div className={styles.headerRow}>
          <div className={styles.headerLeft}>
            {/* Distribution badge pill */}
            <span className={`${styles.badge} ${badgeClass}`}>
              {distributionLabel}
            </span>
            {/* Cell label */}
            <span className={styles.cellLabel}>{cellLabel}</span>
          </div>
          {/* Close button */}
          <button
            onClick={onClose}
            className={styles.closeButton}
            title="Close analysis mode"
          >
            ×
          </button>
        </div>

        {/* Range bar for CI */}
        {confidenceInterval && summary && (
          <RangeBar
            lower={confidenceInterval.lower}
            upper={confidenceInterval.upper}
            median={summary.p50}
            color={
              badgeClassMap[distributionType]
                ? `var(--dist-${distributionType}-accent)`
                : "var(--dist-normal-accent)"
            }
          />
        )}
      </header>

      {/* ── Message fallback ──────────────────────────────────────── */}
      {message ? (
        <div className={styles.messageFallback}>{message}</div>
      ) : (
        <>
          {/* ── Zone B: Interactive Plot ───────────────────────────── */}
          {samples && samples.length > 0 && (
            <div className={styles.plotZone}>
              <div className={styles.plotZoneLabel}>Distribution</div>
              <div className={styles.plotContainer}>
                <DistributionPlot
                  samples={samples}
                  onClose={onClose}
                  inline
                  distributionType={distributionType}
                  confidenceInterval={
                    confidenceInterval
                      ? {
                          lower: confidenceInterval.lower,
                          upper: confidenceInterval.upper,
                          confidenceLevel: confidenceInterval.confidenceLevel,
                        }
                      : undefined
                  }
                />
              </div>
            </div>
          )}

          {/* ── Zone C: Collapsible Stats Drawer ──────────────────── */}
          {summary && (
            <div>
              {/* Collapsed strip */}
              <div
                onClick={() => setStatsExpanded(!statsExpanded)}
                className={`${styles.statsStrip}${statsExpanded ? ` ${styles.statsStripExpanded}` : ""}`}
              >
                <div className={styles.statsStripChips}>
                  <StatChip label="P10" value={formatNumber(summary.p10)} />
                  <StatChip label="Median" value={formatNumber(summary.p50)} />
                  <StatChip label="P90" value={formatNumber(summary.p90)} />
                </div>
                <span
                  className={`${styles.chevron}${statsExpanded ? ` ${styles.chevronExpanded}` : ""}`}
                >
                  ▾
                </span>
              </div>

              {/* Expanded grid */}
              {statsExpanded && (
                <div className={styles.statsGrid}>
                  <StatCard label="Mean" value={formatNumber(summary.mean)} />
                  <StatCard label="Std Dev" value={formatNumber(summary.std)} />
                  <StatCard label="Min" value={formatNumber(summary.min)} />
                  <StatCard label="Max" value={formatNumber(summary.max)} />
                  <StatCard label="10th %" value={formatNumber(summary.p10)} />
                  <StatCard label="90th %" value={formatNumber(summary.p90)} />
                </div>
              )}
            </div>
          )}
        </>
      )}
    </aside>
  );
};
