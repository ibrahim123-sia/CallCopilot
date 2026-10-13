/**
 * In-memory sliding-window rate limiter per client IP.
 * Ephemeral: no persistence, auto-cleans stale entries.
 */
interface RateLimitRecord {
  timestamps: number[];
}

const ipMap = new Map<string, RateLimitRecord>();

// Cleanup stale entries every 5 minutes
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [ip, record] of ipMap.entries()) {
      record.timestamps = record.timestamps.filter((ts) => now - ts < 60000);
      if (record.timestamps.length === 0) {
        ipMap.delete(ip);
      }
    }
  }, 300000).unref?.();
}

export function checkRateLimit(
  clientIp: string,
  limitPerMinute: number = 60
): { allowed: boolean; remaining: number; resetMs: number } {
  const now = Date.now();
  const windowMs = 60000;

  let record = ipMap.get(clientIp);
  if (!record) {
    record = { timestamps: [] };
    ipMap.set(clientIp, record);
  }

  // Filter timestamps within window
  record.timestamps = record.timestamps.filter((ts) => now - ts < windowMs);

  if (record.timestamps.length >= limitPerMinute) {
    const oldest = record.timestamps[0];
    const resetMs = Math.max(0, windowMs - (now - oldest));
    return {
      allowed: false,
      remaining: 0,
      resetMs,
    };
  }

  record.timestamps.push(now);
  return {
    allowed: true,
    remaining: limitPerMinute - record.timestamps.length,
    resetMs: windowMs,
  };
}

export function resetRateLimitForTests(): void {
  ipMap.clear();
}
