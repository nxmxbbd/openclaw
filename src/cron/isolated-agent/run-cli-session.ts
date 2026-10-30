/** CLI child-run helpers for isolated cron prompt execution. */
import type { CliSessionBinding } from "../../config/sessions.js";

// A CLI child in its parent's workspace runs native tools no tool check sees, so
// its process also ends when the parent resets.
export function resolveCliChildAbortSignal(
  runSignal: AbortSignal | undefined,
  parentSignal: AbortSignal | undefined,
): AbortSignal | undefined {
  if (!parentSignal) {
    return runSignal;
  }
  return runSignal ? AbortSignal.any([runSignal, parentSignal]) : parentSignal;
}

/** True when a CLI binding carries reuse metadata beyond its session id. */
export function hasCliSessionReuseMetadata(binding: CliSessionBinding): boolean {
  return Object.entries(binding).some(([key, value]) => key !== "sessionId" && value !== undefined);
}
