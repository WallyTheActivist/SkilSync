import React from 'react';
import clsx from 'clsx';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'outline';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

const base = 'inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed select-none';

const variants: Record<Variant, string> = {
  primary:   'bg-primary-600 text-white hover:bg-primary-700 focus:ring-primary-500 shadow-sm hover:shadow-md active:scale-[.98]',
  secondary: 'bg-primary-50 text-primary-700 hover:bg-primary-100 focus:ring-primary-400',
  ghost:     'text-gray-600 hover:bg-gray-100 hover:text-gray-900 focus:ring-gray-300',
  danger:    'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 shadow-sm',
  success:   'bg-emerald-600 text-white hover:bg-emerald-700 focus:ring-emerald-500 shadow-sm',
  outline:   'border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 focus:ring-primary-400',
};

const sizes: Record<Size, string> = {
  sm:  'px-3 py-1.5 text-sm',
  md:  'px-4 py-2 text-sm',
  lg:  'px-6 py-3 text-base',
};

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  fullWidth = false,
  children,
  className,
  disabled,
  ...rest
}) => (
  <button
    className={clsx(base, variants[variant], sizes[size], fullWidth && 'w-full', className)}
    disabled={disabled || isLoading}
    {...rest}
  >
    {isLoading ? (
      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    ) : leftIcon}
    {children}
    {!isLoading && rightIcon}
  </button>
);

export default Button;
