import { useMemo } from 'react';

export default function SessionTimer({
  timeLeftSec,
  totalSec,
  formatted,
  isWarning = false,
  size = 200,
}) {
  const radius = (size - 20) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = totalSec > 0 ? timeLeftSec / totalSec : 0;
  const strokeDashoffset = circumference * (1 - progress);

  const color = useMemo(() => {
    if (progress > 0.5) return '#10b981'; // Green
    if (progress > 0.17) return '#f59e0b'; // Amber
    return '#f43f5e'; // Red
  }, [progress]);

  return (
    <div className={`relative inline-flex items-center justify-center ${isWarning ? 'warning-pulse' : ''}`}>
      <svg width={size} height={size} className="timer-ring">
        {/* Background ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(255,255,255,0.05)"
          strokeWidth="8"
          fill="none"
        />
        {/* Progress ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth="8"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.5s ease' }}
        />
        {/* Glow effect */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth="2"
          fill="none"
          opacity="0.3"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          filter="url(#glow)"
          style={{ transition: 'stroke-dashoffset 1s linear' }}
        />
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
      </svg>

      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <p className="text-3xl font-bold text-white tracking-wider font-mono">{formatted}</p>
        <p className="text-xs text-white/40 mt-1">remaining</p>
      </div>
    </div>
  );
}
