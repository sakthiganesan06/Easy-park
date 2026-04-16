import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Countdown timer hook
 * @param {number} durationMs - Total duration in milliseconds
 * @param {boolean} autoStart - Whether to start immediately
 * @param {Function} onExpire - Callback when timer reaches 0
 * @returns {{ timeLeftMs, timeLeftSec, isExpired, isRunning, start, pause, reset, formatted }}
 */
export function useCountdown(durationMs, autoStart = false, onExpire = null) {
  const [timeLeftMs, setTimeLeftMs] = useState(durationMs);
  const [isRunning, setIsRunning] = useState(autoStart);
  const intervalRef = useRef(null);
  const onExpireRef = useRef(onExpire);

  onExpireRef.current = onExpire;

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const start = useCallback(() => {
    setIsRunning(true);
  }, []);

  const pause = useCallback(() => {
    setIsRunning(false);
    clearTimer();
  }, [clearTimer]);

  const reset = useCallback((newDuration) => {
    clearTimer();
    setTimeLeftMs(newDuration || durationMs);
    setIsRunning(false);
  }, [durationMs, clearTimer]);

  useEffect(() => {
    if (!isRunning) return;

    intervalRef.current = setInterval(() => {
      setTimeLeftMs((prev) => {
        if (prev <= 1000) {
          clearTimer();
          setIsRunning(false);
          if (onExpireRef.current) onExpireRef.current();
          return 0;
        }
        return prev - 1000;
      });
    }, 1000);

    return clearTimer;
  }, [isRunning, clearTimer]);

  const timeLeftSec = Math.ceil(timeLeftMs / 1000);
  const isExpired = timeLeftMs <= 0;

  const minutes = Math.floor(timeLeftSec / 60);
  const seconds = timeLeftSec % 60;
  const formatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  return {
    timeLeftMs,
    timeLeftSec,
    isExpired,
    isRunning,
    start,
    pause,
    reset,
    formatted,
    minutes,
    seconds,
  };
}
