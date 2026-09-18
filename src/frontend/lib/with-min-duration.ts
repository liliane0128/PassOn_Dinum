/**
 * Pads a promise so it never settles before `ms` has elapsed, success or
 * failure alike -- used to keep a "generating…" animation from cutting short
 * when the real work (or its demo stand-in) finishes faster than the
 * animation needs to play. The wait applies to both outcomes: a quick error
 * skips nothing either, only how long the spinner stays, never the result.
 */
export async function withMinDuration<T>(promise: Promise<T>, ms: number): Promise<T> {
  const start = Date.now();
  try {
    return await promise;
  } finally {
    const remaining = ms - (Date.now() - start);
    if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
  }
}

/**
 * Shared floor for every "generating a passation" animation in the app
 * (the dashboard's checklist and gerer-ma-passation's own wait/Régénérer):
 * one number, so the two never drift apart again.
 */
export const MIN_GENERATION_DURATION_MS = 10000;
