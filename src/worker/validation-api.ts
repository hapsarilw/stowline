import {
  createStowContext,
  createStowState,
  summarize,
  validateAll,
  type Container,
  type Placement,
  type PortInfo,
  type Vessel,
  type Violation,
} from '@/domain';

// Full validation (FR-41), run in a Web Worker so it stays off the main thread (NFR-04).
// Plain data in and out, so it can cross postMessage.

export interface ValidationInput {
  vessel: Vessel;
  containers: Container[];
  placements: Placement[];
  ports?: PortInfo[];
}

export interface ValidationReport {
  violations: Violation[];
  errors: number;
  warnings: number;
  /** Time spent in the worker, in milliseconds. */
  durationMs: number;
}

export const validationApi = {
  validate(input: ValidationInput): ValidationReport {
    const t0 = performance.now();
    const ctx = createStowContext(input);
    const violations = validateAll(createStowState(input.placements), ctx);
    return { violations, ...summarize(violations), durationMs: performance.now() - t0 };
  },
};

export type ValidationApi = typeof validationApi;
