import { wrap, type Remote } from 'comlink';
import type { ValidationApi } from './validation-api';

export interface ValidationClient {
  api: Remote<ValidationApi>;
  terminate(): void;
}

/** Starts the validation worker. Call terminate when it is no longer needed. */
export function createValidationClient(): ValidationClient {
  const worker = new Worker(new URL('./validation.worker.ts', import.meta.url), { type: 'module' });
  return { api: wrap<ValidationApi>(worker), terminate: () => worker.terminate() };
}
