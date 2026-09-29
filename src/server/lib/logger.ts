import 'server-only';

type Level = 'debug' | 'info' | 'warn' | 'error';
const RANK: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

type Fields = Record<string, unknown>;

function threshold(): number {
  const level = (process.env.LOG_LEVEL as Level | undefined) ?? 'info';
  return RANK[level] ?? RANK.info;
}

function serializeError(err: unknown): unknown {
  if (err instanceof Error) return { name: err.name, message: err.message, stack: err.stack };
  return err;
}

function write(level: Level, message: string, fields: Fields) {
  if (RANK[level] < threshold()) return;
  const entry: Fields = { level, time: new Date().toISOString(), msg: message, ...fields };
  if ('err' in entry) entry.err = serializeError(entry.err);

  if (process.env.NODE_ENV === 'production') {
    // One JSON object per line for log aggregation.
    process.stdout.write(`${JSON.stringify(entry)}\n`);
    return;
  }
  const { level: _l, time: _t, msg: _m, ...rest } = entry;
  const suffix = Object.keys(rest).length ? ` ${JSON.stringify(rest)}` : '';
  const line = `[${level}] ${message}${suffix}`;
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else process.stdout.write(`${line}\n`);
}

export interface Logger {
  debug(message: string, fields?: Fields): void;
  info(message: string, fields?: Fields): void;
  warn(message: string, fields?: Fields): void;
  error(message: string, fields?: Fields): void;
  child(bindings: Fields): Logger;
}

function createLogger(bindings: Fields = {}): Logger {
  return {
    debug: (m, f = {}) => write('debug', m, { ...bindings, ...f }),
    info: (m, f = {}) => write('info', m, { ...bindings, ...f }),
    warn: (m, f = {}) => write('warn', m, { ...bindings, ...f }),
    error: (m, f = {}) => write('error', m, { ...bindings, ...f }),
    child: (extra) => createLogger({ ...bindings, ...extra }),
  };
}

export const logger = createLogger();
