/**
 * Sample segregation table from the SRS. Demonstration data, not the IMDG segregation table.
 * Kept as data so it can be replaced.
 */
export const SEGREGATION: Readonly<Record<string, readonly string[]>> = {
  '3': ['5.1', '2.1', '1.4'],
  '5.1': ['3', '2.1'],
  '2.1': ['3', '5.1'],
  '1.4': ['3'],
};

export const incompatible = (a: string, b: string): boolean =>
  (SEGREGATION[a]?.includes(b) ?? false) || (SEGREGATION[b]?.includes(a) ?? false);
