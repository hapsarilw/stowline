import type { ErrorBody } from './types';

/** A failed request. status is 0 when the server could not be reached. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: Record<string, unknown> | undefined;
  /** "GET /plans/042W-SGSIN · no response · 14:32:08", for the full page (design 14). */
  readonly request: string;
  constructor(status: number, body: ErrorBody, request = '') {
    super(body.message);
    this.name = 'ApiError';
    this.status = status;
    this.code = body.code;
    this.details = body.details;
    this.request = request;
  }
}

export const isApiError = (e: unknown): e is ApiError => e instanceof ApiError;

const two = (n: number) => String(n).padStart(2, '0');

/** The line a person can give to support: the request, what came back, and when. */
export function requestLine(method: string, path: string, status: number, at = new Date()): string {
  const got = status === 0 ? 'no response' : String(status);
  return `${method} ${path} · ${got} · ${two(at.getHours())}:${two(at.getMinutes())}:${two(at.getSeconds())}`;
}
