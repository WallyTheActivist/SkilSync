import React from 'react';
import clsx from 'clsx';

interface ProgressBarProps {
  value: number; // 0-100
  max?: number;
  size?: 'sm' | 'md' | 'lg';
  colorClass?: string;
  showLabel?: boolean;
  label?: string;
  animated?: boolean;
  className?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  max = 100,
  size = 'md',
  colorClass,
  showLabel = false,
  label,
  animated = false,
  className,
}) => {
  const pct = Math.min(Math.max((value / max) * 100, 0), 100);

  const getDefaultColor = () => {
    if (pct >= 85) return 'bg-emerald-500';
    if (pct >= 70) return 'bg-green-500';
    if (pct >= 55) return 'bg-indigo-500';
    if (pct >= 40) return 'bg-yellow-500';
    return 'bg-red-400';
  };

  const heights: Record<string, string> = {
    sm: 'h-1.5',
    md: 'h-2.5',
    lg: 'h-4',
  };

  return (
    <div className={className}>
      {(showLabel || label) && (
        <div className="flex justify-between items-center mb-1.5">
          {label && <span className="text-sm text-gray-600">{label}</span>}
          {showLabel && <span className="text-sm font-semibold text-gray-800">{Math.round(pct)}%</span>}
        </div>
      )}
      <div className={clsx('w-full bg-gray-100 rounded-full overflow-hidden', heights[size])}>
        <div
          className={clsx(
            'h-full rounded-full transition-all duration-700 ease-out',
            colorClass || getDefaultColor(),
            animated && 'animate-pulse-slow',
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
};

export default ProgressBar;
