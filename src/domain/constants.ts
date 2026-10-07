import type { ContainerType } from './types';

export type PodCode = 'LKCMB' | 'AEJEA' | 'NLRTM' | 'DEHAM';

export interface Pod {
  code: PodCode;
  short: string;
  name: string;
  /** Discharge order along the rotation. Lower leaves the ship first. */
  order: number;
}

export const PODS: Readonly<Record<PodCode, Pod>> = {
  LKCMB: { code: 'LKCMB', short: 'CMB', name: 'Colombo', order: 1 },
  AEJEA: { code: 'AEJEA', short: 'JEA', name: 'Jebel Ali', order: 2 },
  NLRTM: { code: 'NLRTM', short: 'RTM', name: 'Rotterdam', order: 3 },
  DEHAM: { code: 'DEHAM', short: 'HAM', name: 'Hamburg', order: 4 },
};

export const POD_LIST: readonly PodCode[] = ['LKCMB', 'AEJEA', 'NLRTM', 'DEHAM'];

export interface ContainerTypeInfo {
  iso: string;
  lengthFt: 20 | 40;
  height: string;
  name: string;
}

export const CONTAINER_TYPES: Readonly<Record<ContainerType, ContainerTypeInfo>> = {
  '20GP': { iso: '22G1', lengthFt: 20, height: '8\'6"', name: '20ft general purpose' },
  '40GP': { iso: '42G1', lengthFt: 40, height: '8\'6"', name: '40ft general purpose' },
  '40HC': { iso: '45G1', lengthFt: 40, height: '9\'6"', name: '40ft high cube' },
  RF: { iso: '45R1', lengthFt: 40, height: '9\'6"', name: '40ft reefer' },
  TK: { iso: '22T6', lengthFt: 20, height: '8\'6"', name: '20ft tank' },
  OT: { iso: '42U1', lengthFt: 40, height: '8\'6"', name: '40ft open top' },
};

/** Whole tenths of a tonne, so limit checks at 90.0 and 10.0 are exact. */
export const toTenths = (tonnes: number): number => Math.round(tonnes * 10);
