import { zScoreForConfidence } from "../../utils/distribution/distributionUtils";
import { formatNumber } from "../../utils/formatting/formatUtils";
import {
  createLogNormalData,
  createNormalData,
  createUniformData,
  createUniformParams,
  kernelDensityEstimate,
  percentileFromSorted,
  toLogNormalParams,
  toMeanAndStd,
} from "../../utils/distribution/distributionMath";

export type DistributionKind = "normal" | "lognormal" | "uniform" | "sampled";

export type DistributionParams =
  | { type: "uniform"; a: number; b: number }
  | { type: "lognormal"; mu: number; sigma: number }
  | { type: "normal"; mean: number; std: number };

type TooltipParam = { data?: unknown };

export interface DistributionQueryState {
  percentile: number;
  confidenceLevel: number;
  showPercentile: boolean;
  showCI: boolean;
}

export interface ChartThemeColors {
  textPrimary: string;
  textSecondary: string;
  bgSurface: string;
  borderColor: string;
  splitLine: string;
  splitLineLight: string;
  accent: string;
  accentArea: string;
  highlight: string;
}

export interface ChartConfidenceInterval {
  lower: number;
  upper: number;
  confidenceLevel: number;
}

export interface DistributionChartModelInput {
  samples: number[];
  distributionKind: DistributionKind;
  queryState: DistributionQueryState;
  confidenceInterval?: ChartConfidenceInterval;
  themeColors: ChartThemeColors;
}

export interface DistributionChartDataInput {
  samples: number[];
  distributionKind: DistributionKind;
  confidenceInterval?: ChartConfidenceInterval;
}

export interface DistributionChartData {
  sortedSamples: number[];
  distributionKind: DistributionKind;
  confidenceInterval?: ChartConfidenceInterval;
  distributionParams: DistributionParams | null;
  pdfData: number[][];
  densitySeriesData: number[][];
}

export interface DistributionChartModelFromDataInput {
  chartData: DistributionChartData;
  queryState: DistributionQueryState;
  themeColors: ChartThemeColors;
}

export interface DistributionChartModel {
  sortedSamples: number[];
  percentileValue: number;
  ciBounds: { lower: number; upper: number };
  distributionParams: DistributionParams | null;
  pdfData: number[][];
  densitySeriesData: number[][];
  option: Record<string, unknown>;
}

const getTooltipParams = (params: unknown): TooltipParam[] => {
  if (!Array.isArray(params)) {
    return [];
  }

  return params.filter(
    (param): param is TooltipParam =>
      Boolean(param) && typeof param === "object" && "data" in param,
  );
};

const getDistributionTitle = (distributionKind: DistributionKind): string => {
  switch (distributionKind) {
    case "normal":
      return "Normal Distribution";
    case "lognormal":
      return "Log-Normal Distribution";
    case "uniform":
      return "Uniform Distribution";
    case "sampled":
    default:
      return "Empirical Distribution";
  }
};

export const createDistributionChartData = (
  input: DistributionChartDataInput,
): DistributionChartData => {
  const { samples, distributionKind, confidenceInterval } = input;

  const sortedSamples = [...samples].sort((a, b) => a - b);

  const distributionParams = (() => {
    switch (distributionKind) {
      case "uniform": {
        if (confidenceInterval) {
          return {
            type: "uniform" as const,
            a: confidenceInterval.lower,
            b: confidenceInterval.upper,
          };
        }

        const params = createUniformParams(samples);
        return params ? { type: "uniform" as const, ...params } : null;
      }
      case "lognormal": {
        if (
          confidenceInterval &&
          confidenceInterval.lower > 0 &&
          confidenceInterval.upper > 0
        ) {
          const z = zScoreForConfidence(confidenceInterval.confidenceLevel);
          const lnLower = Math.log(confidenceInterval.lower);
          const lnUpper = Math.log(confidenceInterval.upper);
          const mu = (lnLower + lnUpper) / 2;
          const sigma = (lnUpper - lnLower) / (2 * z);
          if (Number.isFinite(mu) && Number.isFinite(sigma) && sigma > 0) {
            return { type: "lognormal" as const, mu, sigma };
          }
        }

        const params = toLogNormalParams(samples);
        return params ? { type: "lognormal" as const, ...params } : null;
      }
      case "normal": {
        if (confidenceInterval) {
          const z = zScoreForConfidence(confidenceInterval.confidenceLevel);
          const mean = (confidenceInterval.lower + confidenceInterval.upper) / 2;
          const std =
            (confidenceInterval.upper - confidenceInterval.lower) / (2 * z);
          return { type: "normal" as const, mean, std };
        }

        const { mean, std } = toMeanAndStd(samples);
        return std > 0 ? { type: "normal" as const, mean, std } : null;
      }
      default:
        return null;
    }
  })();

  const pdfData = (() => {
    switch (distributionKind) {
      case "uniform":
        if (distributionParams?.type === "uniform") {
          return createUniformData(distributionParams.a, distributionParams.b);
        }
        return kernelDensityEstimate(samples);
      case "lognormal": {
        if (distributionParams?.type === "lognormal") {
          return createLogNormalData(
            distributionParams.mu,
            distributionParams.sigma,
          );
        }

        const positive = samples.filter((value) => value > 0);
        return positive.length
          ? kernelDensityEstimate(positive)
          : kernelDensityEstimate(samples);
      }
      case "normal":
        if (distributionParams?.type === "normal") {
          return createNormalData(
            distributionParams.mean,
            distributionParams.std,
          );
        }
        return kernelDensityEstimate(samples);
      case "sampled":
      default:
        return kernelDensityEstimate(samples);
    }
  })();

  const densitySeriesData = pdfData.length
    ? pdfData
      : sortedSamples.length
      ? sortedSamples.map((value) => [value, 0])
      : [[0, 0]];

  return {
    sortedSamples,
    distributionKind,
    confidenceInterval,
    distributionParams,
    pdfData,
    densitySeriesData,
  };
};

export const createDistributionChartModelFromData = (
  input: DistributionChartModelFromDataInput,
): DistributionChartModel => {
  const { chartData, queryState, themeColors } = input;

  const percentileValue = percentileFromSorted(
    chartData.sortedSamples,
    queryState.percentile,
  );

  const tail = (100 - queryState.confidenceLevel) / 2;
  const ciBounds = {
    lower: percentileFromSorted(chartData.sortedSamples, tail),
    upper: percentileFromSorted(chartData.sortedSamples, 100 - tail),
  };

  const percentileEnabled =
    queryState.showPercentile && Number.isFinite(percentileValue);
  const ciEnabled =
    queryState.showCI &&
    Number.isFinite(ciBounds.lower) &&
    Number.isFinite(ciBounds.upper) &&
    ciBounds.lower <= ciBounds.upper;

  const distributionTitle = getDistributionTitle(chartData.distributionKind);

  const option: Record<string, unknown> = {
    backgroundColor: "transparent",
    title: {
      text: distributionTitle,
      left: "center",
      textStyle: {
        fontSize: 14,
        fontWeight: 500,
        color: themeColors.textPrimary,
      },
    },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      backgroundColor: themeColors.bgSurface,
      borderColor: themeColors.borderColor,
      borderWidth: 1,
      textStyle: { color: themeColors.textPrimary },
      formatter: (params: unknown) => {
        const tooltipParams = getTooltipParams(params);
        if (!tooltipParams.length) return "";
        const datum = tooltipParams[0].data;
        if (!Array.isArray(datum)) return "";
        const [x, y] = datum;
        return `Value: ${formatNumber(Number(x))}<br/>Density: ${formatNumber(Number(y))}`;
      },
    },
    grid: {
      top: 48,
      left: "10%",
      right: "6%",
      bottom: "12%",
      containLabel: true,
    },
    xAxis: {
      type: "value",
      name: "Value",
      nameLocation: "middle",
      nameGap: 32,
      axisLine: {
        lineStyle: { color: themeColors.textSecondary },
      },
      axisLabel: {
        color: themeColors.textSecondary,
        formatter: (value: number) => formatNumber(Number(value)),
      },
      splitLine: {
        lineStyle: { color: themeColors.splitLine },
      },
    },
    yAxis: {
      type: "value",
      name: "Density",
      nameLocation: "middle",
      nameGap: 40,
      axisLine: {
        lineStyle: { color: themeColors.textSecondary },
      },
      axisLabel: {
        color: themeColors.textSecondary,
        formatter: (value: number) => formatNumber(Number(value)),
      },
      splitLine: {
        lineStyle: { color: themeColors.splitLineLight },
      },
    },
    series: [
      {
        name:
          chartData.distributionKind === "sampled"
            ? "Empirical Density"
            : `${distributionTitle} PDF`,
        type: "line",
        smooth: true,
        showSymbol: false,
        data: chartData.densitySeriesData,
        areaStyle: {
          opacity: 1,
          color: themeColors.accentArea,
        },
        lineStyle: {
          width: 2,
          color: themeColors.accent,
        },
        markLine: percentileEnabled
          ? {
              silent: true,
              symbol: ["none", "none"],
              label: {
                formatter: `${queryState.percentile}th percentile`,
                position: "insideEndTop",
                color: themeColors.highlight,
                fontWeight: 500,
              },
              data: [
                {
                  xAxis: percentileValue,
                  lineStyle: {
                    color: themeColors.highlight,
                    type: "dashed",
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
                color: themeColors.accentArea,
              },
              label: {
                show: true,
                formatter: `${queryState.confidenceLevel}% interval`,
                color: themeColors.accent,
                fontSize: 11,
                position: "inside",
              },
              data: [[{ xAxis: ciBounds.lower }, { xAxis: ciBounds.upper }]],
            }
          : undefined,
      },
    ],
  };

  return {
    sortedSamples: chartData.sortedSamples,
    percentileValue,
    ciBounds,
    distributionParams: chartData.distributionParams,
    pdfData: chartData.pdfData,
    densitySeriesData: chartData.densitySeriesData,
    option,
  };
};

export const createDistributionChartModel = (
  input: DistributionChartModelInput,
): DistributionChartModel =>
  createDistributionChartModelFromData({
    chartData: createDistributionChartData(input),
    queryState: input.queryState,
    themeColors: input.themeColors,
  });
