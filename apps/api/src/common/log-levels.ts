import type { Env } from "@fixiyi/config";
import type { LogLevel } from "@nestjs/common";

/**
 * `LOG_LEVEL` -> the Nest levels it lets through (Decision 75).
 *
 * The variable was declared in the schema and validated by zod, but nothing
 * ever read it: `main.ts` created the app with `bufferLogs: true` and never
 * called `useLogger`, so the buffered lines were flushed at Nest's default
 * verbosity whatever the operator had configured.
 *
 * `fatal` is in every list on purpose. A level is a request for less noise,
 * never a request to hide the process dying.
 */
const LEVELS_BY_SETTING: Record<Env["LOG_LEVEL"], LogLevel[]> = {
  debug: ["fatal", "error", "warn", "log", "debug", "verbose"],
  info: ["fatal", "error", "warn", "log"],
  warn: ["fatal", "error", "warn"],
  error: ["fatal", "error"],
};

export function logLevelsFor(setting: Env["LOG_LEVEL"]): LogLevel[] {
  return LEVELS_BY_SETTING[setting];
}
