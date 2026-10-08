// One formatter, made once. toLocaleString with options builds a new one on every call, and
// the bay view and the Inspector print hundreds of weights per command: it was the largest
// cost of a command in the M7 profile (11.6 ms of 50).
const ONE_DECIMAL = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** One decimal with thousands separators, as the design prints weights: 1,240.0 */
export const fmt1 = (n: number): string => ONE_DECIMAL.format(n);

/** Formats a weight held in whole tenths of a tonne. */
export const fmtTenths = (tenths: number): string => fmt1(tenths / 10);

export const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`;
