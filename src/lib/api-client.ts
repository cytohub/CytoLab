import type { ApiErrorBody, ErrorCode, FieldErrors } from '@/domain/errors';

/** Error thrown by the API client; carries the server's structured error. */
export class ApiClientError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode | 'network_error',
    message: string,
    readonly details?: Record<string, unknown>,
    readonly requestId?: string,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }

  /** Field-level validation messages, when present. */
  get fieldErrors(): FieldErrors {
    const fields = this.details?.fields;
    return (fields && typeof fields === 'object' ? fields : {}) as FieldErrors;
  }
}

const BASE = '/api/v1';

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
  /** FormData for uploads; sets no JSON content-type. */
  form?: FormData;
}

interface Envelope<T> {
  data: T;
  meta?: Record<string, unknown>;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<Envelope<T>> {
  const method = options.method ?? 'GET';
  const headers: Record<string, string> = {};
  let body: BodyInit | undefined;

  if (options.form) {
    body = options.form;
  } else if (options.body !== undefined) {
    headers['content-type'] = 'application/json';
    body = JSON.stringify(options.body);
  }

  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body,
      signal: options.signal,
      credentials: 'same-origin',
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new ApiClientError(0, 'network_error', 'Network error — check your connection and try again.');
  }

  if (response.status === 204) return { data: undefined as T };

  const text = await response.text();
  const payload = text ? (JSON.parse(text) as unknown) : {};

  if (!response.ok) {
    const error = (payload as ApiErrorBody).error;
    throw new ApiClientError(
      response.status,
      error?.code ?? 'internal_error',
      error?.message ?? 'Something went wrong.',
      error?.details,
      error?.requestId,
    );
  }
  return payload as Envelope<T>;
}

function toQuery(params?: Record<string, unknown>): string {
  if (!params) return '';
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) value.forEach((v) => search.append(key, String(v)));
    else search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

export const api = {
  get: <T>(path: string, params?: Record<string, unknown>, signal?: AbortSignal) => request<T>(`${path}${toQuery(params)}`, { signal }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  upload: <T>(path: string, form: FormData) => request<T>(path, { method: 'POST', form }),
};

/** Extracts a user-facing message from any thrown value. */
export function errorMessage(err: unknown): string {
  if (err instanceof ApiClientError) return err.message;
  if (err instanceof Error) return err.message;
  return 'Something went wrong.';
}
