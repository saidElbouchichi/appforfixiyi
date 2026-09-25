import type { Env } from "@fixiyi/config";
import { describe, expect, it, vi } from "vitest";

import { createLogger, loggerFor, LOG_LEVEL_ORDER } from "./logger.js";

/**
 * Decision 75. `LOG_LEVEL` was declared in the schema, validated by zod, and
 * read by nobody — the level was not configurable however the operator set
 * it. These tests are what makes it real, in the one process that had no
 * logger at all.
 */
function capture() {
  const written: string[] = [];
  return { written, write: (line: string) => written.push(line) };
}

describe("createLogger", () => {
  it("orders levels from most to least verbose", () => {
    expect(LOG_LEVEL_ORDER).toEqual(["debug", "info", "warn", "error"]);
  });

  it("writes a message at the configured level", () => {
    const sink = capture();
    createLogger("info", sink.write).info("worker ready", { env: "test" });

    expect(sink.written).toHaveLength(1);
    const entry = JSON.parse(sink.written[0] ?? "{}") as Record<string, unknown>;
    expect(entry.level).toBe("info");
    expect(entry.message).toBe("worker ready");
    expect(entry.env).toBe("test");
    expect(typeof entry.time).toBe("string");
  });

  it("drops anything below the configured level", () => {
    const sink = capture();
    const logger = createLogger("warn", sink.write);

    logger.debug("noise");
    logger.info("also noise");
    logger.warn("kept");
    logger.error("kept too");

    expect(sink.written).toHaveLength(2);
  });

  it("lets error through even at the quietest level — silence on failure is the one thing a log must not do", () => {
    const sink = capture();
    const logger = createLogger("error", sink.write);

    logger.warn("dropped");
    logger.error("shown");

    expect(sink.written).toHaveLength(1);
    expect(JSON.parse(sink.written[0] ?? "{}")).toMatchObject({ level: "error", message: "shown" });
  });

  it("keeps an Error's message and stack instead of serialising it to {}", () => {
    const sink = capture();
    createLogger("debug", sink.write).error("job failed", { error: new Error("boom") });

    const entry = JSON.parse(sink.written[0] ?? "{}") as { error?: { message?: string; stack?: string } };
    expect(entry.error?.message).toBe("boom");
    expect(entry.error?.stack).toContain("boom");
  });

  it("writes one line per entry — a log split across lines cannot be parsed back", () => {
    const sink = capture();
    createLogger("debug", sink.write).info("multi\nline", { detail: "a\nb" });

    expect(sink.written[0]).not.toContain("\n");
  });

  it("takes its level from the validated environment", () => {
    const spy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    try {
      const log = loggerFor({ LOG_LEVEL: "error" } as Env);
      log.info("dropped");
      log.error("kept");
      expect(spy).toHaveBeenCalledOnce();
    } finally {
      spy.mockRestore();
    }
  });

  it("defaults to stdout when no sink is given", () => {
    const spy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    try {
      createLogger("info").info("to stdout");
      expect(spy).toHaveBeenCalledOnce();
    } finally {
      spy.mockRestore();
    }
  });
});
