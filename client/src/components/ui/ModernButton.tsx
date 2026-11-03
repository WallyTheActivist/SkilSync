import React from 'react';
import { Button as BSButton, ButtonProps as BSButtonProps } from 'react-bootstrap';
import clsx from 'clsx';

interface ModernButtonProps extends BSButtonProps {
  isLoading?: boolean;
  icon?: React.ReactNode;
}

export const Button: React.FC<ModernButtonProps> = ({
  isLoading,
  icon,
  children,
  disabled,
  className,
  ...props
}) => {
  return (
    <BSButton
      {...props}
      disabled={disabled || isLoading}
      className={clsx('d-flex align-items-center gap-2', className)}
    >
      {isLoading && (
        <span
          className="spinner-border spinner-border-sm"
          role="status"
          aria-hidden="true"
        />
      )}
      {icon && !isLoading && icon}
      {children}
    </BSButton>
  );
};

export default Button;
