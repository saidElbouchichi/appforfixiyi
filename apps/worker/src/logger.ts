import type { Env } from "@fixiyi/config";

/** Most verbose first: a level lets through itself and everything after it. */
export const LOG_LEVEL_ORDER = ["debug", "info", "warn", "error"] as const;

export type LogLevel = (typeof LOG_LEVEL_ORDER)[number];

export interface Logger {
  debug: (message: string, fields?: Record<string, unknown>) => void;
  info: (message: string, fields?: Record<string, unknown>) => void;
  warn: (message: string, fields?: Record<string, unknown>) => void;
  error: (message: string, fields?: Record<string, unknown>) => void;
}

/** An `Error` serialises to `{}`; its message and stack are the only reason it was logged. */
function serialise(value: unknown): unknown {
  if (value instanceof Error) {
    return { message: value.message, stack: value.stack };
  }
  return value;
}

/**
 * One JSON object per line, honouring `LOG_LEVEL` (Decision 75).
 *
 * The worker has no HTTP surface and no Nest container, so it had no logger
 * at all — three `console.*` calls that ignored the configured level. This is
 * the smallest thing that makes `LOG_LEVEL` mean something here, and it stays
 * dependency-free on purpose: a log line is a string, and the worker does not
 * need a logging framework to write one.
 */
export function createLogger(level: LogLevel, write: (line: string) => void = (line) => void process.stdout.write(line + "\n")): Logger {
  const floor = LOG_LEVEL_ORDER.indexOf(level);

  const at =
    (entryLevel: LogLevel) =>
    (message: string, fields: Record<string, unknown> = {}): void => {
      if (LOG_LEVEL_ORDER.indexOf(entryLevel) < floor) {
        return;
      }
      const payload: Record<string, unknown> = { time: new Date().toISOString(), level: entryLevel, message };
      for (const [key, value] of Object.entries(fields)) {
        payload[key] = serialise(value);
      }
      // JSON.stringify escapes newlines, so an entry is always exactly one line.
      write(JSON.stringify(payload));
    };

  return { debug: at("debug"), info: at("info"), warn: at("warn"), error: at("error") };
}

/** The logger this process runs with, from the validated environment. */
export function loggerFor(env: Env): Logger {
  return createLogger(env.LOG_LEVEL);
}
