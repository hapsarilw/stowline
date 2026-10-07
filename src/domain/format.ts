/** One decimal with thousands separators, as the design prints weights: 1,240.0 */
export const fmt1 = (n: number): string =>
  n.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** Formats a weight held in whole tenths of a tonne. */
export const fmtTenths = (tenths: number): string => fmt1(tenths / 10);

export const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`;
