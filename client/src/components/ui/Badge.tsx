import React from 'react';
import clsx from 'clsx';

interface BadgeProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info';
  size?: 'sm' | 'md';
  dot?: boolean;
}

const variantClasses: Record<string, string> = {
  default:  'bg-gray-100 text-gray-700',
  primary:  'bg-primary-100 text-primary-700',
  success:  'bg-emerald-100 text-emerald-700',
  warning:  'bg-amber-100 text-amber-700',
  danger:   'bg-red-100 text-red-700',
  info:     'bg-sky-100 text-sky-700',
};

const dotColors: Record<string, string> = {
  default:  'bg-gray-500',
  primary:  'bg-primary-500',
  success:  'bg-emerald-500',
  warning:  'bg-amber-500',
  danger:   'bg-red-500',
  info:     'bg-sky-500',
};

export const Badge: React.FC<BadgeProps> = ({
  children, className, variant = 'default', size = 'sm', dot = false,
}) => (
  <span
    className={clsx(
      'inline-flex items-center gap-1.5 font-medium rounded-full',
      size === 'sm' ? 'px-2.5 py-0.5 text-xs' : 'px-3 py-1 text-sm',
      variantClasses[variant],
      className,
    )}
  >
    {dot && <span className={clsx('w-1.5 h-1.5 rounded-full', dotColors[variant])} />}
    {children}
  </span>
);

export default Badge;
