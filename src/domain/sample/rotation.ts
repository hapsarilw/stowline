export interface PortCall {
  code: string;
  name: string;
  state: 'done' | 'current' | 'next';
  when: string;
}

/** The sample port rotation, as shown in the top bar. */
export const ROTATION: readonly PortCall[] = [
  { code: 'IDJKT', name: 'Jakarta', state: 'done', when: 'Dep 04 Oct' },
  { code: 'SGSIN', name: 'Singapore', state: 'current', when: 'ETD 08 Oct 22:00' },
  { code: 'LKCMB', name: 'Colombo', state: 'next', when: 'ETA 12 Oct' },
  { code: 'AEJEA', name: 'Jebel Ali', state: 'next', when: 'ETA 18 Oct' },
  { code: 'NLRTM', name: 'Rotterdam', state: 'next', when: 'ETA 01 Nov' },
  { code: 'DEHAM', name: 'Hamburg', state: 'next', when: 'ETA 04 Nov' },
];

export const CURRENT_PORT = 'SGSIN';
export const PREVIOUS_PORT = 'IDJKT';
