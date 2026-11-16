import { dispatchComAmorCallbacks, processQueuedComAmorJobs } from './jobs';
import { isComAmorIntegrationEnabled } from './client';

const INTERVAL_MS = 20_000;
let intervalHandle: ReturnType<typeof setInterval> | null = null;

export function startComAmorScheduler(): void {
  if (intervalHandle || !isComAmorIntegrationEnabled()) return;
  const tick = () => {
    void dispatchComAmorCallbacks();
    void processQueuedComAmorJobs();
  };
  tick();
  intervalHandle = setInterval(tick, INTERVAL_MS);
  intervalHandle.unref();
}
