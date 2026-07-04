import { ConsoleLogger, LogLevel } from "@mastra/core/logger";

/**
 * One leveled logger for the whole pipeline — Mastra's own (pino-backed) logger, so the
 * engine's internals (step errors, retries) land in the same timestamped, leveled stream
 * as our stage banners and the agent feed. No extra dependency; it ships in @mastra/core.
 */
const LEVELS: Record<string, LogLevel> = {
  debug: LogLevel.DEBUG,
  info: LogLevel.INFO,
  warn: LogLevel.WARN,
  error: LogLevel.ERROR,
  none: LogLevel.NONE,
};

/** Map `SDLC_LOG_LEVEL` → LogLevel; unknown/unset → INFO. Exported for the unit test. */
export const resolveLevel = (v = process.env.SDLC_LOG_LEVEL): LogLevel =>
  LEVELS[(v ?? "").toLowerCase()] ?? LogLevel.INFO;

export const log = new ConsoleLogger({ name: "sdlc", level: resolveLevel() });
