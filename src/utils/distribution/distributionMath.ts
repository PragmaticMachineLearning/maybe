/**
 * Pure statistical / distribution math helpers extracted from DistributionPlot.
 */

export const toMeanAndStd = (values: number[]) => {
  if (!values.length) {
    return { mean: 0, std: 0 };
  }
  const mean = values.reduce((acc, value) => acc + value, 0) / values.length;
  const variance =
    values.reduce((acc, value) => acc + Math.pow(value - mean, 2), 0) /
    values.length;
  return { mean, std: Math.sqrt(Math.max(variance, 0)) };
};

export const toLogNormalParams = (values: number[]) => {
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

export const createUniformParams = (values: number[]) => {
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

export const percentileFromSorted = (sorted: number[], percentile: number) => {
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

export const kernelDensityEstimate = (values: number[], points = 200) => {
  if (!values.length) {
    return [];
  }

  const sorted = [...values].sort((a, b) => a - b);
  const { std } = toMeanAndStd(sorted);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const range = Math.max(max - min, 1e-6);
  const bandwidth =
    std > 0
      ? 1.06 * std * Math.pow(sorted.length, -1 / 5)
      : range / Math.sqrt(12);
  const safeBandwidth = bandwidth > 0 ? bandwidth : range / 25;

  const pad = range * 0.15 || 1;
  const start = min - pad;
  const step = (max + pad - start) / points;

  return Array.from({ length: points }, (_, idx) => {
    const x = start + idx * step;
    const density =
      sorted.reduce((acc, sample) => {
        const u = (x - sample) / safeBandwidth;
        return acc + Math.exp(-0.5 * u * u);
      }, 0) /
      (sorted.length * safeBandwidth * Math.sqrt(2 * Math.PI));
    return [x, density];
  });
};

export const createNormalData = (mean: number, std: number, points = 200) => {
  if (!Number.isFinite(mean) || !Number.isFinite(std) || std <= 0) {
    return [];
  }
  const range = std * 4;
  const step = (range * 2) / points;
  return Array.from({ length: points }, (_, idx) => {
    const x = mean - range + idx * step;
    const pdfValue =
      (1 / (std * Math.sqrt(2 * Math.PI))) *
      Math.exp(-Math.pow(x - mean, 2) / (2 * std * std));
    return [x, pdfValue];
  });
};

export const createLogNormalData = (
  mu: number,
  sigma: number,
  points = 200,
) => {
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
    const pdfValue =
      (1 / (x * sigma * Math.sqrt(2 * Math.PI))) *
      Math.exp(-Math.pow(lnX - mu, 2) / (2 * sigma * sigma));
    return [x, pdfValue];
  });
};

export const createUniformData = (a: number, b: number, points = 200) => {
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
