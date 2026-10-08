import type { ErrorBody } from './types';

/** A failed request. status is 0 when the server could not be reached. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: Record<string, unknown> | undefined;
  constructor(status: number, body: ErrorBody) {
    super(body.message);
    this.name = 'ApiError';
    this.status = status;
    this.code = body.code;
    this.details = body.details;
  }
}

export const isApiError = (e: unknown): e is ApiError => e instanceof ApiError;
