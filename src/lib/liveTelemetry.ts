import { SensorReading } from '@/types/greenhouse';

/** ESP posts every ~5s; older than this is stale, but we still render the last sample. */
export const TELEMETRY_STALE_MS = 45_000;

export const DEFAULT_DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

/** Python isoformat() uses 6-digit microseconds; Date.parse often rejects that. */
export function parseSensorTime(timestamp: string | undefined): number | null {
  if (!timestamp) return null;
  const trimmed = timestamp.trim().replace(/(\.\d{3})\d+/, '$1');
  const t = Date.parse(trimmed);
  return Number.isNaN(t) ? null : t;
}

export function isSensorLive(reading: SensorReading | null | undefined): boolean {
  const t = parseSensorTime(reading?.timestamp);
  if (t == null) return false;
  return Math.abs(Date.now() - t) < TELEMETRY_STALE_MS;
}
