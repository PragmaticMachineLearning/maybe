/**
 * Pure statistical / distribution math helpers extracted from DistributionPlot.
 */

export const toMeanAndStd = (values: ArrayLike<number>) => {
  const count = values.length;
  if (!count) {
    return { mean: 0, std: 0 };
  }
  let sum = 0;
  for (let i = 0; i < count; i += 1) {
    sum += values[i];
  }
  const mean = sum / count;
  let squares = 0;
  for (let i = 0; i < count; i += 1) {
    const delta = values[i] - mean;
    squares += delta * delta;
  }
  return { mean, std: Math.sqrt(Math.max(squares / count, 0)) };
};

export const toLogNormalParams = (values: number[]) => {
  const logs = new Float64Array(values.length);
  let count = 0;
  for (let i = 0; i < values.length; i += 1) {
    if (values[i] > 0) {
      logs[count] = Math.log(values[i]);
      count += 1;
    }
  }
  if (count < 2) {
    return null;
  }
  const { mean, std } = toMeanAndStd(logs.subarray(0, count));
  if (!Number.isFinite(mean) || !Number.isFinite(std) || std === 0) {
    return null;
  }
  return { mu: mean, sigma: std };
};

/** Expects values sorted ascending; the ends are the min and max. */
export const createUniformParams = (sortedValues: number[]) => {
  if (!sortedValues.length) {
    return null;
  }
  const min = sortedValues[0];
  const max = sortedValues[sortedValues.length - 1];
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

// Linear-binning resolution: fine bins per bandwidth, and kernel cutoff.
const KDE_BINS_PER_BANDWIDTH = 8;
const KDE_MAX_SUBDIVISIONS = 64;
const KDE_WINDOW_BANDWIDTHS = 5;

/**
 * Gaussian kernel density estimate on a `points`-wide grid.
 * Expects values sorted ascending and never mutates them. Samples are linearly
 * binned onto a grid finer than the output grid, then smoothed with a
 * precomputed kernel truncated at KDE_WINDOW_BANDWIDTHS bandwidths, so the cost
 * is O(n + points * window) rather than O(n * points).
 */
export const kernelDensityEstimate = (sortedValues: number[], points = 200) => {
  const count = sortedValues.length;
  if (!count) {
    return [];
  }

  const { std } = toMeanAndStd(sortedValues);
  const min = sortedValues[0];
  const max = sortedValues[count - 1];
  const range = Math.max(max - min, 1e-6);
  const bandwidth =
    std > 0 ? 1.06 * std * Math.pow(count, -1 / 5) : range / Math.sqrt(12);
  const safeBandwidth = bandwidth > 0 ? bandwidth : range / 25;

  const pad = range * 0.15 || 1;
  const start = min - pad;
  const step = (max + pad - start) / points;

  const subdivisions = Math.min(
    KDE_MAX_SUBDIVISIONS,
    Math.max(1, Math.ceil((step * KDE_BINS_PER_BANDWIDTH) / safeBandwidth)),
  );
  const binWidth = step / subdivisions;
  const binCount = points * subdivisions + 1;

  const weights = new Float64Array(binCount);
  for (let i = 0; i < count; i += 1) {
    const position = (sortedValues[i] - start) / binWidth;
    const lower = Math.min(Math.max(Math.floor(position), 0), binCount - 2);
    const fraction = Math.min(Math.max(position - lower, 0), 1);
    weights[lower] += 1 - fraction;
    weights[lower + 1] += fraction;
  }

  const halfWindow = Math.ceil(
    (KDE_WINDOW_BANDWIDTHS * safeBandwidth) / binWidth,
  );
  const kernel = new Float64Array(halfWindow + 1);
  for (let d = 0; d <= halfWindow; d += 1) {
    const u = (d * binWidth) / safeBandwidth;
    kernel[d] = Math.exp(-0.5 * u * u);
  }

  const norm = 1 / (count * safeBandwidth * Math.sqrt(2 * Math.PI));
  return Array.from({ length: points }, (_, idx) => {
    const center = idx * subdivisions;
    const from = Math.max(0, center - halfWindow);
    const to = Math.min(binCount - 1, center + halfWindow);
    let acc = 0;
    for (let j = from; j <= to; j += 1) {
      acc += weights[j] * kernel[Math.abs(j - center)];
    }
    return [start + idx * step, acc * norm];
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
