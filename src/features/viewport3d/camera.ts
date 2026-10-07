// Camera presets of the 3D view (FR-19), as the toolbar shows them. No three.js here.

export type CameraPreset = 'iso' | 'port' | 'stbd' | 'top' | 'bow';

export const CAMERA_PRESETS: readonly { id: CameraPreset; label: string; title: string }[] = [
  { id: 'iso', label: 'Iso', title: 'Three-quarter view' },
  { id: 'port', label: 'Port', title: 'From port side' },
  { id: 'stbd', label: 'Stbd', title: 'From starboard' },
  { id: 'top', label: 'Top', title: 'Plan view' },
  { id: 'bow', label: 'Bow', title: 'From ahead' },
];
