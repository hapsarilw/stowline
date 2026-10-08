import { generateBenchCall, generateSampleCall } from '@/domain';
import { createValidationClient } from '@/worker/client';

/** What e2e/worker.spec.ts calls in the page. Loaded only with test hooks on. */
export const hook = { createValidationClient, generateBenchCall, generateSampleCall };
