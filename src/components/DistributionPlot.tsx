import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import ReactECharts from "echarts-for-react";
import { zScoreForConfidence } from "../utils/distributionUtils";

type DistributionKind = 'normal' | 'lognormal' | 'uniform' | 'sampled';
type DistributionParams =
  | { type: 'uniform'; a: number; b: number }
  | { type: 'lognormal'; mu: number; sigma: number }
  | { type: 'normal'; mean: number; std: number };

interface DistributionPlotProps {
  samples: number[];
  onClose: () => void;
  position?: { top: number; left: number };
  inline?: boolean;
  distributionType?: DistributionKind;
  confidenceInterval?: { lower: number; upper: number; confidenceLevel: number };
  onOpenAnalysis?: () => void;
}

interface QueryState {
  percentile: number;
  confidenceLevel: number;
  showPercentile: boolean;
  showCI: boolean;
}

const formatCompactNumber = (value: number) => {
  if (!Number.isFinite(value)) {
    return '';
  }
  if (value === 0) {
    return '0';
  }

  const formatExponential = (num: number) =>
    num
      .toExponential(2)
      .replace(/\.0+e/, 'e')
      .replace(/\.([1-9])0+e/, '.$1e')
      .replace('e+', 'e');

  const absValue = Math.abs(value);

  if (Number.isInteger(value)) {
    if (absValue >= 100) {
      return formatExponential(value);
    }
    return value.toString();
  }

  if (absValue >= 10000 || absValue < 0.01) {
    return formatExponential(value);
  }

  const fixed = value
    .toFixed(2)
    .replace(/\.0+$/, '')
    .replace(/(\.\d*[1-9])0+$/, '$1');

  return fixed.startsWith('-0') ? fixed.replace('-0', '0') : fixed;
};

const SettingsIcon: React.FC<{ size?: number; color?: string }> = ({ size = 16, color = "currentColor" }) => (
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

const CloseIcon: React.FC<{ size?: number; color?: string }> = ({ size = 16, color = "currentColor" }) => (
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

const DEFAULT_QUERY_STATE: QueryState = {
  percentile: 95,
  confidenceLevel: 95,
  showPercentile: false,
  showCI: true,
};

const toMeanAndStd = (values: number[]) => {
  if (!values.length) {
    return { mean: 0, std: 0 };
  }
  const mean = values.reduce((acc, value) => acc + value, 0) / values.length;
  const variance = values.reduce((acc, value) => acc + Math.pow(value - mean, 2), 0) / values.length;
  return { mean, std: Math.sqrt(Math.max(variance, 0)) };
};

const toLogNormalParams = (values: number[]) => {
  const positives = values.filter((value) => value > 0);
  if (positives.length < 2) {
    return null;
  }
  const logs = positives.map((value) => Math.log(value));
  const { mean, std } = toMeanAndStd(logs);
  if (!Number.isFinite(mean) || !Number.isFinite(std) || std === 0) {
    return null;
  }
  return { mu: mean, sigma: std };
};

const createUniformParams = (values: number[]) => {
  if (!values.length) {
    return null;
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) {
    return null;
  }
  return { a: min, b: max };
};

const percentileFromSorted = (sorted: number[], percentile: number) => {
  if (!sorted.length) {
    return NaN;
  }
  const clamped = Math.min(Math.max(percentile, 0), 100);
  const index = (clamped / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) {
    return sorted[lower];
  }
  const weight = index - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
};

const kernelDensityEstimate = (values: number[], points = 200) => {
  if (!values.length) {
    return [];
  }

  const sorted = [...values].sort((a, b) => a - b);
  const { std } = toMeanAndStd(sorted);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const range = Math.max(max - min, 1e-6);
  const bandwidth = std > 0 ? 1.06 * std * Math.pow(sorted.length, -1 / 5) : range / Math.sqrt(12);
  const safeBandwidth = bandwidth > 0 ? bandwidth : range / 25;

  const pad = range * 0.15 || 1;
  const start = min - pad;
  const step = (max + pad - start) / points;

  return Array.from({ length: points }, (_, idx) => {
    const x = start + idx * step;
    const density = sorted.reduce((acc, sample) => {
      const u = (x - sample) / safeBandwidth;
      return acc + Math.exp(-0.5 * u * u);
    }, 0) / (sorted.length * safeBandwidth * Math.sqrt(2 * Math.PI));
    return [x, density];
  });
};


const createNormalData = (mean: number, std: number, points = 200) => {
  if (!Number.isFinite(mean) || !Number.isFinite(std) || std <= 0) {
    return [];
  }
  const range = std * 4;
  const step = (range * 2) / points;
  return Array.from({ length: points }, (_, idx) => {
    const x = mean - range + idx * step;
    const pdfValue = (1 / (std * Math.sqrt(2 * Math.PI))) * Math.exp(-Math.pow(x - mean, 2) / (2 * std * std));
    return [x, pdfValue];
  });
};

const createLogNormalData = (mu: number, sigma: number, points = 200) => {
  if (!Number.isFinite(mu) || !Number.isFinite(sigma) || sigma <= 0) {
    return [];
  }
  const minX = Math.exp(mu - 4 * sigma);
  const maxX = Math.exp(mu + 4 * sigma);
  const step = (maxX - minX) / points;
  return Array.from({ length: points }, (_, idx) => {
    const x = minX + idx * step;
    if (x <= 0) {
      return [x, 0];
    }
    const lnX = Math.log(x);
    const pdfValue = (1 / (x * sigma * Math.sqrt(2 * Math.PI))) * Math.exp(-Math.pow(lnX - mu, 2) / (2 * sigma * sigma));
    return [x, pdfValue];
  });
};

const createUniformData = (a: number, b: number, points = 200) => {
  if (!Number.isFinite(a) || !Number.isFinite(b) || a >= b) {
    return [];
  }
  const height = 1 / (b - a);
  const step = (b - a) / points;
  const data: Array<[number, number]> = [];
  data.push([a - step, 0]);
  for (let idx = 0; idx <= points; idx += 1) {
    const x = a + idx * step;
    data.push([x, height]);
  }
  data.push([b + step, 0]);
  return data;
};

export const DistributionPlot: React.FC<DistributionPlotProps> = ({
  samples,
  onClose,
  position,
  inline = false,
  distributionType,
  confidenceInterval,
  onOpenAnalysis,
}) => {
  const accentColor = '#4e8376';
  const accentArea = 'rgba(78, 131, 118, 0.18)';
  const highlightColor = '#b67c68';

  const plotRef = useRef<HTMLDivElement>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [queryState, setQueryState] = useState<QueryState>(() => ({
    ...DEFAULT_QUERY_STATE,
    confidenceLevel: confidenceInterval?.confidenceLevel ?? DEFAULT_QUERY_STATE.confidenceLevel,
    showCI: Boolean(confidenceInterval),
  }));

  const distributionKind: DistributionKind = useMemo(() => {
    if (distributionType) {
      return distributionType;
    }
    return confidenceInterval ? 'normal' : 'sampled';
  }, [distributionType, confidenceInterval]);

  const sortedSamples = useMemo(() => [...samples].sort((a, b) => a - b), [samples]);

  const percentileValue = useMemo(
    () => percentileFromSorted(sortedSamples, queryState.percentile),
    [sortedSamples, queryState.percentile]
  );

  const ciBounds = useMemo(() => {
    const tail = (100 - queryState.confidenceLevel) / 2;
    return {
      lower: percentileFromSorted(sortedSamples, tail),
      upper: percentileFromSorted(sortedSamples, 100 - tail),
    };
  }, [sortedSamples, queryState.confidenceLevel]);

  const distributionParams = useMemo<DistributionParams | null>(() => {
    switch (distributionKind) {
      case 'uniform': {
        if (confidenceInterval) {
          return { type: 'uniform' as const, a: confidenceInterval.lower, b: confidenceInterval.upper };
        }
        const params = createUniformParams(samples);
        return params ? { type: 'uniform' as const, ...params } : null;
      }
      case 'lognormal': {
        if (confidenceInterval && confidenceInterval.lower > 0 && confidenceInterval.upper > 0) {
          const z = zScoreForConfidence(confidenceInterval.confidenceLevel);
          const lnLower = Math.log(confidenceInterval.lower);
          const lnUpper = Math.log(confidenceInterval.upper);
          const mu = (lnLower + lnUpper) / 2;
          const sigma = (lnUpper - lnLower) / (2 * z);
          if (Number.isFinite(mu) && Number.isFinite(sigma) && sigma > 0) {
            return { type: 'lognormal' as const, mu, sigma };
          }
        }
        const params = toLogNormalParams(samples);
        return params ? { type: 'lognormal' as const, ...params } : null;
      }
      case 'normal': {
        if (confidenceInterval) {
          const z = zScoreForConfidence(confidenceInterval.confidenceLevel);
          const mean = (confidenceInterval.lower + confidenceInterval.upper) / 2;
          const std = (confidenceInterval.upper - confidenceInterval.lower) / (2 * z);
          return { type: 'normal' as const, mean, std };
        }
        const { mean, std } = toMeanAndStd(samples);
        return std > 0 ? { type: 'normal' as const, mean, std } : null;
      }
      default:
        return null;
    }
  }, [distributionKind, confidenceInterval, samples]);

  const pdfData = useMemo(() => {
    switch (distributionKind) {
      case 'uniform':
        if (distributionParams?.type === 'uniform') {
          return createUniformData(distributionParams.a, distributionParams.b);
        }
        return kernelDensityEstimate(samples);
      case 'lognormal':
        if (distributionParams?.type === 'lognormal') {
          return createLogNormalData(distributionParams.mu, distributionParams.sigma);
        }
        const positive = samples.filter((value) => value > 0);
        return positive.length ? kernelDensityEstimate(positive) : kernelDensityEstimate(samples);
      case 'normal':
        if (distributionParams?.type === 'normal') {
          return createNormalData(distributionParams.mean, distributionParams.std);
        }
        return kernelDensityEstimate(samples);
      case 'sampled':
      default:
        return kernelDensityEstimate(samples);
    }
  }, [distributionKind, distributionParams, samples]);

  const densitySeriesData = pdfData.length
    ? pdfData
    : sortedSamples.length
      ? sortedSamples.map((value) => [value, 0])
      : [[0, 0]];

  const percentileEnabled = queryState.showPercentile && Number.isFinite(percentileValue);
  const ciEnabled = queryState.showCI && Number.isFinite(ciBounds.lower) && Number.isFinite(ciBounds.upper) && ciBounds.lower <= ciBounds.upper;

  const getDistributionTitle = useCallback((): string => {
    switch (distributionKind) {
      case 'normal':
        return 'Normal Distribution';
      case 'lognormal':
        return 'Log-Normal Distribution';
      case 'uniform':
        return 'Uniform Distribution';
      case 'sampled':
      default:
        return 'Empirical Distribution';
    }
  }, [distributionKind]);

  const option = useMemo(() => ({
    backgroundColor: 'transparent',
    title: {
      text: getDistributionTitle(),
      left: 'center',
      textStyle: {
        fontSize: 14,
        fontWeight: 500,
        color: '#2f3a3a',
      },
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: 'rgba(255,255,255,0.92)',
      borderColor: '#cedad6',
      borderWidth: 1,
      textStyle: { color: '#2f3a3a' },
      formatter: (params: any) => {
        if (!params || !params.length) return '';
        const datum = params[0].data;
        if (!Array.isArray(datum)) return '';
        const [x, y] = datum;
        return `Value: ${formatCompactNumber(Number(x))}<br/>Density: ${formatCompactNumber(Number(y))}`;
      },
    },
    grid: {
      top: 48,
      left: '10%',
      right: '6%',
      bottom: '12%',
      containLabel: true,
    },
    xAxis: {
      type: 'value',
      name: 'Value',
      nameLocation: 'middle',
      nameGap: 32,
      axisLine: {
        lineStyle: { color: '#6a7a78' },
      },
      axisLabel: {
        color: '#6a7a78',
        formatter: (value: number) => formatCompactNumber(Number(value)),
      },
      splitLine: {
        lineStyle: { color: 'rgba(206, 218, 214, 0.4)' },
      },
    },
    yAxis: {
      type: 'value',
      name: 'Density',
      nameLocation: 'middle',
      nameGap: 40,
      axisLine: {
        lineStyle: { color: '#6a7a78' },
      },
      axisLabel: {
        color: '#6a7a78',
        formatter: (value: number) => formatCompactNumber(Number(value)),
      },
      splitLine: {
        lineStyle: { color: 'rgba(206, 218, 214, 0.3)' },
      },
    },
    series: [
      {
        name: distributionKind === 'sampled' ? 'Empirical Density' : `${getDistributionTitle()} PDF`,
        type: 'line',
        smooth: true,
        showSymbol: false,
        data: densitySeriesData,
        areaStyle: {
          opacity: 1,
          color: accentArea,
        },
        lineStyle: {
          width: 2,
          color: accentColor,
        },
        markLine: percentileEnabled
          ? {
              silent: true,
              symbol: ['none', 'none'],
              label: {
                formatter: `${queryState.percentile}th percentile`,
                position: 'insideEndTop',
                color: highlightColor,
                fontWeight: 500,
              },
              data: [
                {
                  xAxis: percentileValue,
                  lineStyle: {
                    color: highlightColor,
                    type: 'dashed',
                    width: 1.5,
                  },
                },
              ],
            }
          : undefined,
        markArea: ciEnabled
          ? {
              silent: true,
              itemStyle: {
                color: 'rgba(78, 131, 118, 0.12)',
              },
              label: {
                show: true,
                formatter: `${queryState.confidenceLevel}% interval`,
                color: accentColor,
                fontSize: 11,
                position: 'inside',
              },
              data: [
                [
                  { xAxis: ciBounds.lower },
                  { xAxis: ciBounds.upper },
                ],
              ],
            }
          : undefined,
      },
    ],
  }), [
    accentArea,
    accentColor,
    ciBounds.lower,
    ciBounds.upper,
    ciEnabled,
    distributionKind,
    getDistributionTitle,
    highlightColor,
    densitySeriesData,
    percentileEnabled,
    percentileValue,
    queryState.confidenceLevel,
    queryState.percentile,
  ]);

  // Handle clicks outside the plot to close it
  useEffect(() => {
    if (inline) {
      return
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

  const handleQueryChange = (field: keyof QueryState, value: number | boolean) => {
    setQueryState((prev) => {
      if (field === 'percentile' && typeof value === 'number') {
        const clamped = Math.min(Math.max(value, 0), 100);
        return { ...prev, percentile: clamped };
      }
      if (field === 'confidenceLevel' && typeof value === 'number') {
        const clamped = Math.min(Math.max(value, 0), 100);
        return { ...prev, confidenceLevel: clamped };
      }
      if (field === 'showPercentile' && typeof value === 'boolean') {
        return { ...prev, showPercentile: value };
      }
      if (field === 'showCI' && typeof value === 'boolean') {
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
    if (confidenceInterval) {
      setQueryState((prev) => ({
        ...prev,
        confidenceLevel: confidenceInterval.confidenceLevel,
      }));
    } else {
      setQueryState((prev) => ({
        ...prev,
        showCI: false,
      }));
    }
  }, [confidenceInterval]);

  const containerStyle = useMemo(() => inline ? {
    position: "static" as const,
    backgroundColor: "transparent",
    padding: "0 10px",
    borderRadius: 0,
    boxShadow: "none",
    zIndex: "auto" as const,
    width: "100%",
    minHeight: "100%",
    boxSizing: "border-box" as const,
  } : {
    position: "fixed" as const,
    top: position?.top ?? 0,
    left: position?.left ?? 0,
    backgroundColor: "var(--bg-surface)",
    padding: "24px",
    borderRadius: "20px",
    boxShadow: "0 24px 60px rgba(15, 31, 31, 0.22)",
    zIndex: 1000,
    width: "min(420px, calc(100vw - 32px))",
    maxHeight: "calc(100vh - 32px)",
    minHeight: "min(360px, calc(100vh - 32px))",
    overflow: "hidden",
    boxSizing: "border-box" as const,
  }, [inline, position?.left, position?.top]);

  return (
    <div
      ref={plotRef}
      style={containerStyle}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: showSettings ? (inline ? "16px" : "20px") : (inline ? "12px" : "16px"),
          gap: "12px"
        }}
      >
        {onOpenAnalysis && (
          <button
            onClick={onOpenAnalysis}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              border: "1px solid var(--border-color)",
              backgroundColor: "var(--bg-surface)",
              color: "var(--text-secondary)",
              padding: "8px 14px",
              borderRadius: "999px",
              cursor: "pointer",
              boxShadow: "0 4px 12px rgba(15, 31, 31, 0.08)",
              transition: "all 0.2s ease",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              fontSize: "11px"
            }}
          >
            <SettingsIcon size={16} color="var(--text-secondary)" />
            Analysis
          </button>
        )}
        {!onOpenAnalysis && (
          <button
            onClick={() => setShowSettings(prev => !prev)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              border: "1px solid var(--border-color)",
              backgroundColor: showSettings ? "var(--bg-hover)" : "var(--bg-surface)",
              color: "var(--text-secondary)",
              padding: "8px 14px",
              borderRadius: "999px",
              cursor: "pointer",
              boxShadow: showSettings ? "0 12px 28px rgba(15, 31, 31, 0.14)" : "0 4px 12px rgba(15, 31, 31, 0.08)",
              transition: "all 0.2s ease",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              fontSize: "11px"
            }}
            aria-expanded={showSettings}
          >
            <SettingsIcon size={16} color="var(--text-secondary)" />
            Settings
          </button>
        )}
        {!inline && (
          <button
            onClick={onClose}
            style={{
              border: "1px solid var(--border-color)",
              backgroundColor: "var(--bg-surface)",
              color: "var(--text-secondary)",
              padding: "8px",
              borderRadius: "999px",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 4px 12px rgba(15, 31, 31, 0.08)"
            }}
            aria-label="Close analysis"
          >
            <CloseIcon size={14} color="var(--text-secondary)" />
          </button>
        )}
      </div>

      {showSettings && (
        <div
          style={{
            width: "100%",
            backgroundColor: "var(--bg-surface)",
            padding: inline ? "16px" : "18px",
            borderRadius: "18px",
            border: "1px solid var(--border-color)",
            boxShadow: "0 18px 40px rgba(15, 31, 31, 0.16)",
            marginBottom: inline ? "20px" : "24px",
            display: "grid",
            gap: "18px",
            boxSizing: "border-box"
          }}
        >
          <div style={{ display: "grid", gap: "10px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ color: "var(--text-secondary)", fontSize: "13px" }}>
                Percentile
              </label>
              <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={queryState.percentile}
                  onChange={(e) => handleQueryChange("percentile", Number(e.target.value))}
                  style={{
                    flex: 1,
                    padding: "10px 12px",
                    border: "1px solid var(--border-color)",
                    borderRadius: "12px",
                    backgroundColor: "var(--bg-secondary)",
                    color: "var(--text-primary)",
                    fontSize: "13px"
                  }}
                />
                <button
                  onClick={() => handleQueryChange("showPercentile", !queryState.showPercentile)}
                  style={{
                    background: queryState.showPercentile ? "var(--resize-handle-active)" : "var(--bg-secondary)",
                    color: queryState.showPercentile ? "var(--bg-surface)" : "var(--text-secondary)",
                    border: "1px solid var(--border-color)",
                    padding: "10px 16px",
                    borderRadius: "12px",
                    cursor: "pointer",
                    fontSize: "11px",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    transition: "all 0.2s ease",
                    whiteSpace: "nowrap"
                  }}
                >
                  {queryState.showPercentile ? "Hide" : "Show"}
                </button>
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gap: "10px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ color: "var(--text-secondary)", fontSize: "13px" }}>
                Confidence Level
              </label>
              <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={queryState.confidenceLevel}
                  onChange={(e) => handleQueryChange("confidenceLevel", Number(e.target.value))}
                  style={{
                    flex: 1,
                    padding: "10px 12px",
                    border: "1px solid var(--border-color)",
                    borderRadius: "12px",
                    backgroundColor: "var(--bg-secondary)",
                    color: "var(--text-primary)",
                    fontSize: "13px"
                  }}
                />
                <button
                  onClick={() => handleQueryChange("showCI", !queryState.showCI)}
                  style={{
                    background: queryState.showCI ? "var(--resize-handle-active)" : "var(--bg-secondary)",
                    color: queryState.showCI ? "var(--bg-surface)" : "var(--text-secondary)",
                    border: "1px solid var(--border-color)",
                    padding: "10px 16px",
                    borderRadius: "12px",
                    cursor: "pointer",
                    fontSize: "11px",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    transition: "all 0.2s ease",
                    whiteSpace: "nowrap"
                  }}
                >
                  {queryState.showCI ? "Hide" : "Show"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ReactECharts
        option={option}
        style={{ height: inline ? "260px" : "240px" }}
        opts={{ renderer: "svg" }}
      />
    </div>
  );
};
