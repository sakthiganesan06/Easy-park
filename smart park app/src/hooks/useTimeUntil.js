import { useState, useEffect } from 'react';

/** Remaining ms until `isoTimestamp`; ticks every second. Null if timestamp missing/invalid. */
export function useTimeUntil(isoTimestamp) {
  const targetMs = isoTimestamp ? new Date(isoTimestamp).getTime() : NaN;
  const valid = Number.isFinite(targetMs);

  const [remainingMs, setRemainingMs] = useState(() =>
    valid ? Math.max(0, targetMs - Date.now()) : 0
  );

  useEffect(() => {
    if (!valid) return undefined;
    const tick = () => setRemainingMs(Math.max(0, targetMs - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetMs, valid]);

  return valid ? remainingMs : null;
}
