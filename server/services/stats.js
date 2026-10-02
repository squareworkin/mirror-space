/**
 * Pure statistics helpers for the pattern engine.
 * No DB access, no throws — degenerate input returns null so callers can
 * branch on "unavailable" explicitly instead of catching exceptions.
 */

export function mean(numbers) {
  if (!numbers || numbers.length === 0) return null;
  return numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
}

export function stddev(numbers) {
  if (!numbers || numbers.length === 0) return null;
  if (numbers.length === 1) return 0;
  const m = mean(numbers);
  const variance = numbers.reduce((sum, n) => sum + (n - m) ** 2, 0) / numbers.length;
  return Math.sqrt(variance);
}

// null if the baseline is flat (stddev 0/null) — a flat baseline means "no signal", not an infinite z-score
export function zScore(value, baselineMean, baselineStddev) {
  if (baselineMean === null || baselineMean === undefined) return null;
  if (!baselineStddev) return null;
  return (value - baselineMean) / baselineStddev;
}

export function pearsonCorrelation(xs, ys) {
  if (!xs || !ys || xs.length !== ys.length || xs.length < 2) return null;

  const n = xs.length;
  const meanX = mean(xs);
  const meanY = mean(ys);

  let numerator = 0;
  let sumSqX = 0;
  let sumSqY = 0;

  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    numerator += dx * dy;
    sumSqX += dx * dx;
    sumSqY += dy * dy;
  }

  if (sumSqX === 0 || sumSqY === 0) return null; // zero variance, r is undefined

  const r = numerator / Math.sqrt(sumSqX * sumSqY);
  return { r, n };
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
