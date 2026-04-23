/* eslint-disable react-refresh/only-export-components */

import React from "react";

import {
  confidenceLevelToFormulaArgument,
  formatDistributionFormulaNumber,
  isDistributionValue,
  isSampledDistributionValue,
  parseDistributionValue,
  parseSampledDistributionValue,
} from "../../utils/distribution/distributionUtils";

export type CellValue =
  | string
  | number
  | boolean
  | number[]
  | null
  | undefined
  | { samples: number[] }
  | { mean: number; variance: number }
  | {
      kind: "normal" | "lognormal" | "uniform";
      source?: "parameters" | "ci";
      mean?: number;
      variance?: number;
      mu?: number;
      sigma?: number;
      min?: number;
      max?: number;
      lower?: number;
      upper?: number;
      confidenceLevel?: number;
      toSamples?: () => number[];
    };

export const BooleanIcon: React.FC<{ value: boolean }> = ({ value }) => (
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

export const MicroSparkline: React.FC<{
  type: "normal" | "lognormal" | "uniform" | "sampled";
  color: string;
}> = ({ type, color }) => {
  const getPath = () => {
    switch (type) {
      case "normal":
        return "M0,16 C5,16 7,13 10,9 C13,4 14,1 18,1 C22,1 23,4 26,9 C29,13 31,16 36,16";
      case "lognormal":
        return "M0,16 C3,16 4,15 6,9 C8,5 9,1 12,1 C14,1 17,5 21,9 C25,13 29,15 36,16";
      case "uniform":
        return "M0,16 L0,16 L5,16 L5,3 L31,3 L31,16 L36,16";
      case "sampled":
        return "M0,16 L4,14 L8,9 L12,11 L15,5 L18,2 L21,4 L25,8 L29,12 L32,14 L36,16";
      default:
        return "M0,16 L36,16";
    }
  };

  return (
    <svg
      width={36}
      height={16}
      viewBox="0 0 36 16"
      style={{ flexShrink: 0, opacity: 0.8 }}
      aria-hidden="true"
    >
      <path
        d={getPath()}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

const formatCompactNumber = (value: number): string => {
  const abs = Math.abs(value);
  const fractionDigits = abs > 0 && abs < 1 ? 4 : 2;
  return value
    .toFixed(fractionDigits)
    .replace(/(\.\d*?)0+$/, "$1")
    .replace(/\.$/, "");
};

const formatConfidencePercent = (confidenceLevel: number): string => {
  const normalized = confidenceLevel > 1 ? confidenceLevel : confidenceLevel * 100;
  return `${formatCompactNumber(normalized)}%`;
};

export const formatCellEditValue = (val: CellValue): string => {
  if (val === null || val === undefined) return "";

  if (typeof val === "boolean") {
    return val ? "TRUE" : "FALSE";
  }

  if (typeof val === "string" || typeof val === "number") {
    return String(val);
  }

  if (isDistributionValue(val)) {
    const distribution = parseDistributionValue(val);
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
  }

  if (isSampledDistributionValue(val)) {
    const sampled = parseSampledDistributionValue(val);
    if (sampled) {
      return `S(μ=${sampled.mean.toFixed(2)}, σ=${sampled.std.toFixed(2)})`;
    }
  }

  return String(val);
};

export const formatCellValue = (val: CellValue): string => {
  if (val === null || val === undefined) return "";

  if (typeof val === "boolean") {
    return val ? "TRUE" : "FALSE";
  }

  if (typeof val === "string" || typeof val === "number") {
    return String(val);
  }

  if (isDistributionValue(val)) {
    const distribution = parseDistributionValue(val);
    if (distribution) {
      switch (distribution.kind) {
        case "normal":
          if (
            distribution.source === "ci" &&
            distribution.lower !== undefined &&
            distribution.upper !== undefined &&
            distribution.confidenceLevel !== undefined
          ) {
            return `N ${formatConfidencePercent(distribution.confidenceLevel)} CI [${formatCompactNumber(distribution.lower)}, ${formatCompactNumber(distribution.upper)}]`;
          }
          return `N μ=${formatCompactNumber(distribution.mean ?? 0)} σ²=${formatCompactNumber(distribution.variance ?? 0)}`;
        case "lognormal":
          if (
            distribution.source === "ci" &&
            distribution.lower !== undefined &&
            distribution.upper !== undefined &&
            distribution.confidenceLevel !== undefined
          ) {
            return `LN ${formatConfidencePercent(distribution.confidenceLevel)} CI [${formatCompactNumber(distribution.lower)}, ${formatCompactNumber(distribution.upper)}]`;
          }
          return `LN μlog=${formatCompactNumber(distribution.mu ?? 0)} σlog=${formatCompactNumber(distribution.sigma ?? 0)}`;
        case "uniform":
          return `U [${formatCompactNumber(distribution.min ?? 0)}, ${formatCompactNumber(distribution.max ?? 0)}]`;
      }
    }
  }

  if (isSampledDistributionValue(val)) {
    const sampled = parseSampledDistributionValue(val);
    if (sampled) {
      return `S(μ=${sampled.mean.toFixed(2)}, σ=${sampled.std.toFixed(2)})`;
    }
  }

  return String(val);
};
