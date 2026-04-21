/* eslint-disable react-refresh/only-export-components */

import React from "react";

import {
  getConfidenceIntervalMedian,
  isConfidenceIntervalValue,
  isSampledDistributionValue,
  parseConfidenceIntervalValue,
  parseSampledDistributionValue,
  zScoreForConfidence,
} from "../../utils/distribution/distributionUtils";

export interface DistributionViewOptions {
  type: "normal" | "lognormal" | "uniform";
}

export type CellValue =
  | string
  | number
  | boolean
  | number[]
  | null
  | undefined
  | { samples: number[] }
  | { mean: number; variance: number }
  | { lower: number; upper: number; confidenceLevel: number };

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

export const formatCellValue = (
  val: CellValue,
  options: DistributionViewOptions,
): string => {
  if (val === null || val === undefined) return "";

  if (typeof val === "boolean") {
    return val ? "TRUE" : "FALSE";
  }

  if (typeof val === "string" || typeof val === "number") {
    return String(val);
  }

  if (isConfidenceIntervalValue(val)) {
    const ci = parseConfidenceIntervalValue(val);
    if (ci) {
      const median = getConfidenceIntervalMedian(ci);

      switch (options.type) {
        case "normal": {
          const mean = (ci.lower + ci.upper) / 2;
          const zScore = zScoreForConfidence(ci.confidenceLevel);
          const std = (ci.upper - ci.lower) / (2 * zScore);
          return `N(μ=${mean.toFixed(2)}, σ=${std.toFixed(2)})`;
        }
        case "lognormal":
          if (ci.lower > 0 && ci.upper > 0) {
            const lnLower = Math.log(ci.lower);
            const lnUpper = Math.log(ci.upper);
            const mu = (lnLower + lnUpper) / 2;
            const sigma = (lnUpper - lnLower) / 3.29;
            return `LN(μ=${mu.toFixed(2)}, σ=${sigma.toFixed(2)})`;
          }
          return `${median.toFixed(2)} [${ci.lower}-${ci.upper}]`;
        case "uniform":
          return `U[${ci.lower.toFixed(2)}, ${ci.upper.toFixed(2)}]`;
        default:
          return `${median.toFixed(2)} [${ci.lower}-${ci.upper}]`;
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
