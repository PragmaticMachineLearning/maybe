export const formatNumber = (value: number): string => {
  if (!Number.isFinite(value)) {
    return '—';
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
