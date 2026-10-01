import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { ZodError, type z } from 'zod';
import {
  AppError,
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  PayloadTooLargeError,
  UnauthorizedError,
  UnsupportedMediaTypeError,
  ValidationError,
  type ApiErrorBody,
  type FieldErrors,
} from '@/domain/errors';
import type { PublicDemoLock } from '@/domain/public-demo';
import type { AuthContext } from '../auth/context';
import { authFromRequest } from '../auth/request';
import { sessionCookieName } from '../auth/sessions';
import { env } from '../env';
import { logger, type Logger } from '../lib/logger';
import { enforcePublicDemoWrite } from './public-demo';

const MAX_JSON_BYTES = 1024 * 1024;
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** A handler's return value: data plus optional pagination meta and status. */
export class ApiResult<T> {
  constructor(
    readonly data: T,
    readonly meta?: Record<string, unknown> | object,
    readonly status = 200,
  ) {}
}
export const ok = <T>(data: T, meta?: Record<string, unknown> | object) => new ApiResult(data, meta);
export const created = <T>(data: T) => new ApiResult(data, undefined, 201);

type RouteParams = Record<string, string>;
interface RouteContextLike<P> {
  params: Promise<P>;
}

interface BaseArgs<P> {
  req: NextRequest;
  params: P;
  requestId: string;
  log: Logger;
}
export interface AuthedArgs<P> extends BaseArgs<P> {
  ctx: AuthContext;
}
export interface PublicArgs<P> extends BaseArgs<P> {
  ctx: AuthContext | null;
}

// ---------------------------------------------------------------------------
// Request guards
// ---------------------------------------------------------------------------

/**
 * CSRF defense. A mutating request must not originate from another site.
 *
 * When the request carries our session cookie it is browser-driven, and browsers
 * always send `Origin` on such requests — so we require a same-origin `Origin`
 * (a missing or mismatched one is rejected). Requests without the session cookie
 * (future bearer-token/service clients) cannot ride a victim's cookies and are
 * exempt from the header requirement; a present cross-origin header is still
 * rejected. SameSite=Lax cookies are a second layer.
 */
export function assertSameOrigin(req: NextRequest): void {
  if (!MUTATING_METHODS.has(req.method)) return;
  const origin = req.headers.get('origin');

  if (origin) {
    if (!isSameOrigin(req, origin)) throw new ForbiddenError('Cross-origin request rejected');
    return;
  }
  if (req.headers.get('sec-fetch-site') === 'cross-site') throw new ForbiddenError('Cross-origin request rejected');

  // Cookie-authenticated mutation with no Origin header: reject (a real browser
  // would have sent one). This closes the header-stripping gap for session auth.
  if (req.cookies.get(sessionCookieName())) throw new ForbiddenError('Missing Origin on a session-authenticated request');
}

/**
 * Whether the browser-set `Origin` names the site this request was addressed
 * to. Behind a TLS-terminating proxy (Railway, Cloudflare, nginx) the server
 * itself sees plain HTTP on an internal address, so hosts are compared with the
 * forwarded host rather than whole origins with the server's own URL. A
 * cross-site page cannot forge either side: browsers set `Origin` themselves,
 * and adding `X-Forwarded-Host` to a cross-origin request would need a CORS
 * preflight this app never approves.
 */
function isSameOrigin(req: NextRequest, origin: string): boolean {
  if (origin === req.nextUrl.origin || origin === new URL(env().APP_URL).origin) return true;
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return false; // e.g. the opaque origin "null"
  }
  const forwardedHost = req.headers.get('x-forwarded-host')?.split(',')[0]!.trim();
  const host = forwardedHost || req.headers.get('host');
  return host ? originHost === host.toLowerCase() : false;
}

export function zodFieldErrors(error: ZodError): FieldErrors {
  const fields: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.length ? issue.path.join('.') : '_form';
    (fields[key] ??= []).push(issue.message);
  }
  return fields;
}

export async function parseJson<S extends z.ZodType>(req: NextRequest, schema: S): Promise<z.output<S>> {
  const contentType = req.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().includes('application/json')) {
    throw new UnsupportedMediaTypeError('Send the request body as application/json');
  }
  const declared = Number(req.headers.get('content-length') ?? 0);
  if (declared > MAX_JSON_BYTES) throw new PayloadTooLargeError(MAX_JSON_BYTES);

  const text = await req.text();
  if (text.length > MAX_JSON_BYTES) throw new PayloadTooLargeError(MAX_JSON_BYTES);

  let body: unknown;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    throw new BadRequestError('Request body is not valid JSON');
  }
  return validate(schema, body);
}

export function parseQuery<S extends z.ZodType>(req: NextRequest, schema: S): z.output<S> {
  const raw: Record<string, string | string[]> = {};
  for (const [key, value] of req.nextUrl.searchParams) {
    const existing = raw[key];
    raw[key] = existing === undefined ? value : Array.isArray(existing) ? [...existing, value] : [existing, value];
  }
  return validate(schema, raw);
}

export function validate<S extends z.ZodType>(schema: S, value: unknown): z.output<S> {
  const result = schema.safeParse(value);
  if (!result.success) throw new ValidationError('Some fields are invalid', zodFieldErrors(result.error));
  return result.data;
}

// ---------------------------------------------------------------------------
// Error mapping
// ---------------------------------------------------------------------------

interface PgErrorLike {
  code?: string;
  constraint_name?: string;
  constraint?: string;
}

function pgError(err: unknown): PgErrorLike | null {
  const candidates = [err, (err as { cause?: unknown })?.cause];
  for (const c of candidates) {
    if (c && typeof c === 'object' && typeof (c as PgErrorLike).code === 'string' && /^[0-9A-Z]{5}$/.test((c as PgErrorLike).code!)) {
      return c as PgErrorLike;
    }
  }
  return null;
}

export function toAppError(err: unknown): AppError | null {
  if (err instanceof AppError) return err;
  if (err instanceof ZodError) return new ValidationError('Some fields are invalid', zodFieldErrors(err));
  const pg = pgError(err);
  if (pg?.code === '23505') {
    return new ConflictError('A record with the same unique value already exists', {
      constraint: pg.constraint_name ?? pg.constraint,
    });
  }
  if (pg?.code === '23503') return new BadRequestError('A referenced record does not exist');
  if (pg?.code === '23514') return new ValidationError('A value violates a data rule');
  // Bodies and query strings are validated, so a malformed value reaching
  // Postgres comes from a path segment such as /milestones/not-a-uuid.
  if (pg?.code === '22P02') return new NotFoundError('Resource');
  return null;
}

function errorResponse(err: AppError, requestId: string): NextResponse<ApiErrorBody> {
  const body: ApiErrorBody = {
    error: { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}), requestId },
  };
  const res = NextResponse.json(body, { status: err.status });
  const retryAfter = err.details?.retryAfterSeconds;
  if (typeof retryAfter === 'number') res.headers.set('Retry-After', String(retryAfter));
  return res;
}

function finalize(res: Response, requestId: string): Response {
  res.headers.set('x-request-id', requestId);
  if (!res.headers.has('cache-control')) res.headers.set('cache-control', 'no-store');
  return res;
}

function toResponse(result: unknown): Response {
  if (result instanceof Response) return result;
  if (result instanceof ApiResult) {
    return NextResponse.json(
      result.meta ? { data: result.data, meta: result.meta } : { data: result.data },
      { status: result.status },
    );
  }
  if (result === undefined) return new Response(null, { status: 204 });
  return NextResponse.json({ data: result });
}

// ---------------------------------------------------------------------------
// Route wrappers
// ---------------------------------------------------------------------------

export interface RouteOptions {
  /**
   * Refuse this handler when the deployment is a public demo (PUBLIC_DEMO=true).
   * Declared on the handler itself, so no alternate spelling of its URL can
   * reach it unguarded.
   */
  publicDemoLock?: PublicDemoLock;
}

function wrap<P extends RouteParams, A>(
  requireAuth: boolean,
  handler: (args: A) => Promise<unknown>,
  options: RouteOptions = {},
) {
  return async (req: NextRequest, routeContext: RouteContextLike<P>): Promise<Response> => {
    const requestId = req.headers.get('x-request-id')?.slice(0, 64) || crypto.randomUUID();
    const log = logger.child({ requestId, method: req.method, path: req.nextUrl.pathname });
    try {
      assertSameOrigin(req);
      const ctx = await authFromRequest(req, requestId);
      if (requireAuth && !ctx) throw new UnauthorizedError();
      if (requireAuth && (options.publicDemoLock || MUTATING_METHODS.has(req.method))) {
        enforcePublicDemoWrite(req.headers, options.publicDemoLock);
      }
      const params = (await routeContext.params) ?? ({} as P);
      const result = await handler({ req, params, ctx, requestId, log } as A);
      return finalize(toResponse(result), requestId);
    } catch (err) {
      const appError = toAppError(err);
      if (appError) {
        if (appError.status >= 500) log.error('request failed', { err });
        else log.debug('request rejected', { code: appError.code, status: appError.status });
        return finalize(errorResponse(appError, requestId), requestId);
      }
      log.error('unhandled error', { err });
      const internal = new AppError('internal_error', 'Something went wrong on our side', 500);
      return finalize(errorResponse(internal, requestId), requestId);
    }
  };
}

/** Authenticated API route. */
export function api<P extends RouteParams = RouteParams>(
  handler: (args: AuthedArgs<P>) => Promise<unknown>,
  options?: RouteOptions,
) {
  return wrap<P, AuthedArgs<P>>(true, handler, options);
}

/** Route reachable without a session (sign-in, health). The context is provided when present. */
export function publicApi<P extends RouteParams = RouteParams>(handler: (args: PublicArgs<P>) => Promise<unknown>) {
  return wrap<P, PublicArgs<P>>(false, handler);
}
