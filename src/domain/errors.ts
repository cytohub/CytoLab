/**
 * Application errors. Services throw these; the HTTP layer maps them to status
 * codes and a uniform envelope. They are plain classes so they are safe anywhere.
 */

export const ERROR_CODES = [
  'bad_request',
  'validation_error',
  'unauthorized',
  'forbidden',
  'not_found',
  'conflict',
  'rate_limited',
  'payload_too_large',
  'unsupported_media_type',
  'internal_error',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

/** Field path → messages, as returned in `error.details.fields`. */
export type FieldErrors = Record<string, string[]>;

export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly status: number,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'The request could not be processed', details?: Record<string, unknown>) {
    super('bad_request', message, 400, details);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, fields: FieldErrors = {}) {
    super('validation_error', message, 422, { fields });
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Sign in to continue') {
    super('unauthorized', message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'You do not have permission to do that') {
    super('forbidden', message, 403);
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super('not_found', `${resource} not found`, 404);
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('conflict', message, 409, details);
  }
}

export class RateLimitError extends AppError {
  constructor(retryAfterSeconds: number, message = 'Too many attempts. Try again shortly.') {
    super('rate_limited', message, 429, { retryAfterSeconds });
  }
}

export class PayloadTooLargeError extends AppError {
  constructor(limitBytes: number) {
    super('payload_too_large', `Payload exceeds the ${Math.round(limitBytes / 1024 / 1024)} MB limit`, 413, { limitBytes });
  }
}

export class UnsupportedMediaTypeError extends AppError {
  constructor(message = 'Unsupported content type') {
    super('unsupported_media_type', message, 415);
  }
}

/** Shape of every API error response body. */
export interface ApiErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    details?: Record<string, unknown>;
    requestId?: string;
  };
}
