import React from 'react';
import { Card as BSCard, CardProps } from 'react-bootstrap';
import clsx from 'clsx';

interface ModernCardProps extends CardProps {
  hoverable?: boolean;
  elevated?: boolean;
  icon?: React.ReactNode;
}

export const ModernCard: React.FC<ModernCardProps> = ({
  hoverable = false,
  elevated = false,
  icon,
  children,
  className,
  ...props
}) => {
  return (
    <BSCard
      className={clsx(
        'modern-card',
        hoverable && 'cursor-pointer',
        elevated && 'shadow-lg',
        className
      )}
      {...props}
    >
      {children}
    </BSCard>
  );
};

export const CardHeader: React.FC<any> = ({ icon, title, action, ...props }) => {
  return (
    <BSCard.Header className="d-flex justify-content-between align-items-center" {...props}>
      <div className="d-flex align-items-center gap-2">
        {icon && <span className="text-primary">{icon}</span>}
        <h6 className="mb-0 fw-bold">{title}</h6>
      </div>
      {action && <div>{action}</div>}
    </BSCard.Header>
  );
};

export default ModernCard;
