import React, { useEffect, useMemo, useRef, useState } from "react";

import ReactEChartsCore, { echarts } from "../../lib/echarts";
import {
  createDistributionChartData,
  createDistributionChartModelFromData,
  type DistributionKind,
  type DistributionQueryState,
} from "./distributionChartOptions";
import styles from "./DistributionPlot.module.css";

interface DistributionPlotProps {
  samples: number[];
  onClose: () => void;
  position?: { top: number; left: number };
  inline?: boolean;
  distributionType?: DistributionKind;
  confidenceInterval?: {
    lower: number;
    upper: number;
    confidenceLevel: number;
  };
}

const computePercentile = (sorted: number[], p: number): number => {
  if (!sorted.length) return NaN;
  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  const weight = index - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
};

const SettingsIcon: React.FC<{ size?: number; color?: string }> = ({
  size = 16,
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
      d="M12 15.5C13.933 15.5 15.5 13.933 15.5 12C15.5 10.067 13.933 8.5 12 8.5C10.067 8.5 8.5 10.067 8.5 12C8.5 13.933 10.067 15.5 12 15.5Z"
      stroke={color}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M19.4 15.5C19.547 15.05 19.647 14.575 19.694 14.084L21.5 12L19.694 9.916C19.647 9.425 19.547 8.95 19.4 8.5L21 6L18.5 4.4C18.05 4.253 17.575 4.153 17.084 4.106L15 2.3L12.916 4.106C12.425 4.153 11.95 4.253 11.5 4.4L9 3L7.4 5.5C7.253 5.95 7.153 6.425 7.106 6.916L5.3 9L7.106 11.084C7.153 11.575 7.253 12.05 7.4 12.5L6 15L8.5 16.6C8.95 16.747 9.425 16.847 9.916 16.894L12 18.7L14.084 16.894C14.575 16.847 15.05 16.747 15.5 16.6L18 18L19.4 15.5Z"
      stroke={color}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const CloseIcon: React.FC<{ size?: number; color?: string }> = ({
  size = 16,
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
      d="M7 7L17 17"
      stroke={color}
      strokeWidth="1.6"
      strokeLinecap="round"
    />
    <path
      d="M17 7L7 17"
      stroke={color}
      strokeWidth="1.6"
      strokeLinecap="round"
    />
  </svg>
);

const DEFAULT_QUERY_STATE: DistributionQueryState = {
  percentile: 95,
  confidenceLevel: 95,
  showPercentile: false,
  showCI: true,
};

export const DistributionPlot: React.FC<DistributionPlotProps> = ({
  samples,
  onClose,
  position,
  inline = false,
  distributionType,
  confidenceInterval,
}) => {
  const confidenceLower = confidenceInterval?.lower;
  const confidenceUpper = confidenceInterval?.upper;
  const confidenceLevel = confidenceInterval?.confidenceLevel;

  const normalizedConfidenceInterval = useMemo(
    () =>
      confidenceLower === undefined ||
      confidenceUpper === undefined ||
      confidenceLevel === undefined
        ? undefined
        : {
            lower: confidenceLower,
            upper: confidenceUpper,
            confidenceLevel,
          },
    [confidenceLower, confidenceUpper, confidenceLevel],
  );

  const [themeColors, setThemeColors] = useState(() => ({
    textPrimary: "#2f3a3a",
    textSecondary: "#6a7a78",
    bgSurface: "#ffffff",
    borderColor: "#cedad6",
    splitLine: "rgba(206, 218, 214, 0.4)",
    splitLineLight: "rgba(206, 218, 214, 0.3)",
    accent: "#4e8376",
    accentArea: "rgba(78, 131, 118, 0.18)",
    highlight: "#b67c68",
  }));

  useEffect(() => {
    const root = document.documentElement;
    const style = getComputedStyle(root);
    const read = (prop: string) => style.getPropertyValue(prop).trim();

    const update = () => {
      const isDark = root.classList.contains("dark");
      setThemeColors({
        textPrimary: read("--text-primary") || (isDark ? "#f2f6f4" : "#1f2d2d"),
        textSecondary: read("--text-muted") || (isDark ? "#8fa19d" : "#6a7a78"),
        bgSurface: read("--bg-surface") || (isDark ? "#141f1f" : "#ffffff"),
        borderColor:
          read("--border-color") ||
          (isDark ? "rgba(207,222,216,0.18)" : "#cedad6"),
        splitLine: isDark
          ? "rgba(207, 222, 216, 0.08)"
          : "rgba(206, 218, 214, 0.4)",
        splitLineLight: isDark
          ? "rgba(207, 222, 216, 0.06)"
          : "rgba(206, 218, 214, 0.3)",
        accent:
          read("--resize-handle-active") || (isDark ? "#6fb6a3" : "#4e8376"),
        accentArea: isDark
          ? "rgba(111, 182, 163, 0.2)"
          : "rgba(78, 131, 118, 0.18)",
        highlight: isDark ? "#c99480" : "#b67c68",
      });
    };

    update();

    // Watch for theme class changes
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.attributeName === "class") {
          update();
        }
      }
    });
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });

    return () => observer.disconnect();
  }, []);

  const plotRef = useRef<HTMLDivElement>(null);
  const [showSettings, setShowSettings] = useState(false);
  const previousConfidenceIntervalKeyRef = useRef<string | undefined>(
    normalizedConfidenceInterval
      ? `${normalizedConfidenceInterval.lower}|${normalizedConfidenceInterval.upper}|${normalizedConfidenceInterval.confidenceLevel}`
      : undefined,
  );
  const confidenceIntervalSuppressedByMissingRef = useRef(false);
  const hasSeenConfidenceIntervalRef = useRef(
    Boolean(normalizedConfidenceInterval),
  );
  const stats = useMemo(() => {
    if (!samples || samples.length === 0) return null;
    const sorted = [...samples].sort((a, b) => a - b);
    const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
    return {
      p10: computePercentile(sorted, 10),
      median: computePercentile(sorted, 50),
      p90: computePercentile(sorted, 90),
      mean,
    };
  }, [samples]);

  const [queryState, setQueryState] = useState<DistributionQueryState>(() => ({
    ...DEFAULT_QUERY_STATE,
    confidenceLevel:
      normalizedConfidenceInterval?.confidenceLevel ??
      DEFAULT_QUERY_STATE.confidenceLevel,
    showCI: Boolean(normalizedConfidenceInterval),
  }));

  const distributionKind: DistributionKind = useMemo(() => {
    if (distributionType) {
      return distributionType;
    }
    return normalizedConfidenceInterval ? "normal" : "sampled";
  }, [distributionType, normalizedConfidenceInterval]);

  const chartData = useMemo(
    () =>
      createDistributionChartData({
        samples,
        distributionKind,
        confidenceInterval: normalizedConfidenceInterval,
      }),
    [samples, distributionKind, normalizedConfidenceInterval],
  );

  const chartModel = useMemo(
    () =>
      createDistributionChartModelFromData({
        chartData,
        queryState,
        themeColors,
      }),
    [chartData, queryState, themeColors],
  );

  const { option } = chartModel;

  // Handle clicks outside the plot to close it
  useEffect(() => {
    if (inline) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (plotRef.current && !plotRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [inline, onClose]);

  const handleQueryChange = (
    field: keyof DistributionQueryState,
    value: number | boolean,
  ) => {
    setQueryState((prev) => {
      if (field === "percentile" && typeof value === "number") {
        const clamped = Math.min(Math.max(value, 0), 100);
        return { ...prev, percentile: clamped };
      }
      if (field === "confidenceLevel" && typeof value === "number") {
        const clamped = Math.min(Math.max(value, 0), 100);
        return { ...prev, confidenceLevel: clamped };
      }
      if (field === "showPercentile" && typeof value === "boolean") {
        return { ...prev, showPercentile: value };
      }
      if (field === "showCI" && typeof value === "boolean") {
        return { ...prev, showCI: value };
      }
      return prev;
    });
  };

  useEffect(() => {
    if (inline) {
      setShowSettings(true);
    }
  }, [inline]);

  useEffect(() => {
    const nextConfidenceIntervalKey = normalizedConfidenceInterval
      ? `${normalizedConfidenceInterval.lower}|${normalizedConfidenceInterval.upper}|${normalizedConfidenceInterval.confidenceLevel}`
      : undefined;

    if (
      previousConfidenceIntervalKeyRef.current === nextConfidenceIntervalKey
    ) {
      return;
    }

    previousConfidenceIntervalKeyRef.current = nextConfidenceIntervalKey;

    setQueryState((prev) => {
      if (!normalizedConfidenceInterval) {
        if (prev.showCI) {
          confidenceIntervalSuppressedByMissingRef.current = true;
          return {
            ...prev,
            showCI: false,
          };
        }

        confidenceIntervalSuppressedByMissingRef.current = false;
        return prev;
      }

      const hadSeenIntervalBefore = hasSeenConfidenceIntervalRef.current;
      hasSeenConfidenceIntervalRef.current = true;

      const nextState: DistributionQueryState = {
        ...prev,
        confidenceLevel: normalizedConfidenceInterval.confidenceLevel,
      };

      if (confidenceIntervalSuppressedByMissingRef.current) {
        nextState.showCI = true;
        confidenceIntervalSuppressedByMissingRef.current = false;
      } else if (!hadSeenIntervalBefore && !prev.showCI) {
        nextState.showCI = true;
      }

      return nextState;
    });
  }, [normalizedConfidenceInterval]);

  const containerClassName = inline
    ? styles.containerInline
    : styles.containerPopup;

  const headerClassName = [
    styles.header,
    showSettings
      ? inline
        ? styles.headerSettingsInline
        : styles.headerSettingsPopup
      : inline
        ? styles.headerCollapsedInline
        : styles.headerCollapsedPopup,
  ].join(" ");

  const settingsPanelClassName = [
    styles.settingsPanel,
    inline ? styles.settingsPanelInline : styles.settingsPanelPopup,
  ].join(" ");

  return (
    <div
      ref={plotRef}
      className={containerClassName}
      style={
        !inline
          ? { top: position?.top ?? 0, left: position?.left ?? 0 }
          : undefined
      }
    >
      <div className={headerClassName}>
        <button
          onClick={() => setShowSettings((prev) => !prev)}
          className={[styles.pillBtn, showSettings ? styles.pillBtnActive : ""]
            .filter(Boolean)
            .join(" ")}
          aria-expanded={showSettings}
        >
          <SettingsIcon size={16} color="var(--text-secondary)" />
          Settings
        </button>
        {!inline && (
          <button
            onClick={onClose}
            className={styles.closeBtn}
            aria-label="Close analysis"
          >
            <CloseIcon size={14} color="var(--text-secondary)" />
          </button>
        )}
      </div>

      {showSettings && (
        <div className={settingsPanelClassName}>
          <div className={styles.settingsGroup}>
            <div className={styles.settingsField}>
              <label className={styles.settingsLabel}>Percentile</label>
              <div className={styles.settingsRow}>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={queryState.percentile}
                  onChange={(e) =>
                    handleQueryChange("percentile", Number(e.target.value))
                  }
                  className={styles.settingsInput}
                />
                <button
                  onClick={() =>
                    handleQueryChange(
                      "showPercentile",
                      !queryState.showPercentile,
                    )
                  }
                  className={[
                    styles.toggleBtn,
                    queryState.showPercentile ? styles.toggleBtnActive : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {queryState.showPercentile ? "Hide" : "Show"}
                </button>
              </div>
            </div>
          </div>

          <div className={styles.settingsGroup}>
            <div className={styles.settingsField}>
              <label className={styles.settingsLabel}>Confidence Level</label>
              <div className={styles.settingsRow}>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={queryState.confidenceLevel}
                  onChange={(e) =>
                    handleQueryChange("confidenceLevel", Number(e.target.value))
                  }
                  className={styles.settingsInput}
                />
                <button
                  onClick={() =>
                    handleQueryChange("showCI", !queryState.showCI)
                  }
                  className={[
                    styles.toggleBtn,
                    queryState.showCI ? styles.toggleBtnActive : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {queryState.showCI ? "Hide" : "Show"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ReactEChartsCore
        echarts={echarts}
        key={`${themeColors.textPrimary}-${themeColors.accent}`}
        option={option}
        style={{ height: inline ? "260px" : "240px" }}
        opts={{ renderer: "svg" }}
      />

      {stats && (
        <div className={styles.statsStrip}>
          <div className={styles.statChip}>
            <span className={styles.statLabel}>P10</span>
            <span className={styles.statValue}>{stats.p10.toFixed(2)}</span>
          </div>
          <div className={styles.statChip}>
            <span className={styles.statLabel}>MEDIAN</span>
            <span className={styles.statValue}>{stats.median.toFixed(2)}</span>
          </div>
          <div className={styles.statChip}>
            <span className={styles.statLabel}>P90</span>
            <span className={styles.statValue}>{stats.p90.toFixed(2)}</span>
          </div>
        </div>
      )}
    </div>
  );
};
