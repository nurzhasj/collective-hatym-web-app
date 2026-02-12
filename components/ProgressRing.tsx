"use client";

import { useId, useMemo } from "react";

type Props = {
  completed: number;
  total: number;
  size?: number;
  stroke?: number;
  label?: string;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export default function ProgressRing({
  completed,
  total,
  size = 180,
  stroke = 14,
  label = "completed"
}: Props) {
  const id = useId();
  const ratio = total > 0 ? clamp(completed / total, 0, 1) : 0;
  const percent = (ratio * 100).toFixed(2);
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - ratio);

  const gradientStops = useMemo(() => {
    const hue = clamp(Math.round(120 * ratio), 0, 120);
    const startHue = clamp(hue - 30, 0, 120);
    const endHue = clamp(hue + 20, 0, 120);
    return {
      start: `hsl(${startHue} 80% 55%)`,
      mid: `hsl(${hue} 85% 50%)`,
      end: `hsl(${endHue} 85% 45%)`
    };
  }, [ratio]);

  return (
    <div className="relative flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={`ring-${id}`} x1="0" y1="0" x2={size} y2={size}>
            <stop offset="0%" stopColor={gradientStops.start} />
            <stop offset="55%" stopColor={gradientStops.mid} />
            <stop offset="100%" stopColor={gradientStops.end} />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#e5e7eb"
          strokeWidth={stroke}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={`url(#ring-${id})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-3xl font-semibold text-hatym-ink">{percent}%</div>
        <div className="text-[0.7rem] uppercase tracking-[0.3em] text-hatym-ink/60">{label}</div>
      </div>
    </div>
  );
}
