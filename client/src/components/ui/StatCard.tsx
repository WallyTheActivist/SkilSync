import React from 'react';
import { Card } from 'react-bootstrap';
import clsx from 'clsx';

interface StatCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  icon?: React.ReactNode;
  variant?: 'primary' | 'success' | 'warning' | 'danger' | 'info';
  trend?: number; // percentage change
  trendLabel?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  variant = 'primary',
  trend,
  trendLabel,
}) => {
  const variantBorder = {
    primary: 'border-primary',
    success: 'border-success',
    warning: 'border-warning',
    danger: 'border-danger',
    info: 'border-info',
  };

  return (
    <Card className={clsx('stat-card', variantBorder[variant])}>
      <Card.Body>
        <div className="d-flex justify-content-between align-items-start">
          <div className="flex-grow-1">
            <div className="stat-value">{value}</div>
            <div className="stat-label">{title}</div>
            {subtitle && <p className="text-muted small mt-1">{subtitle}</p>}
          </div>
          {icon && <div className={`text-${variant} opacity-50`}>{icon}</div>}
        </div>
        {trend !== undefined && (
          <div className={clsx('stat-change mt-2', trend >= 0 ? 'positive' : 'negative')}>
            {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}% {trendLabel && `${trendLabel}`}
          </div>
        )}
      </Card.Body>
    </Card>
  );
};

export default StatCard;
