import { RequestProgress } from '../types';

const PROGRESS_TTL_MS = 30 * 60 * 1000;

export const requestProgressMap: Record<string, RequestProgress> = {};

export function setProgress(requestId: string, progress: Omit<RequestProgress, 'updatedAt'>) {
  requestProgressMap[requestId] = { ...progress, updatedAt: Date.now() };
}

// Periodic cleanup of stale progress entries
setInterval(() => {
  const now = Date.now();
  for (const [id, p] of Object.entries(requestProgressMap)) {
    if (now - p.updatedAt > PROGRESS_TTL_MS) delete requestProgressMap[id];
  }
}, 60_000).unref();

// Global timeout wrapper to prevent infinite hangs (ffmpeg, uploads, etc.)
export function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`[Timeout] ${label} exceeded ${ms}ms`)), ms);
    promise.then(
      (val) => { clearTimeout(timer); resolve(val); },
      (err) => { clearTimeout(timer); reject(err); }
    );
  });
}
