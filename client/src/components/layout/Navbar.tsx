import React from 'react';
import { Bell, Search } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getInitials, getAvatarUrl, getReadinessLabel, getReadinessColor } from '../../utils/helpers';
import { MobileMenuButton } from './Sidebar';
import clsx from 'clsx';

interface NavbarProps {
  onMobileMenuOpen: () => void;
  pageTitle?: string;
}

export const Navbar: React.FC<NavbarProps> = ({ onMobileMenuOpen, pageTitle }) => {
  const { user } = useAuth();
  const profile = user?.profile as { firstName?: string; lastName?: string; avatarUrl?: string; readinessScore?: number } | null;
  const avatarUrl = getAvatarUrl(profile?.avatarUrl);
  const initials = getInitials(profile?.firstName, profile?.lastName);
  const readiness = profile?.readinessScore ?? 0;

  return (
    <header className="h-16 bg-white border-b border-gray-100 px-4 lg:px-6 flex items-center justify-between shrink-0 z-30">
      <div className="flex items-center gap-4">
        <MobileMenuButton onClick={onMobileMenuOpen} />
        {pageTitle && (
          <h1 className="text-lg font-semibold text-gray-900 hidden sm:block">{pageTitle}</h1>
        )}
      </div>

      <div className="flex items-center gap-3">
        {/* Readiness score pill */}
        {readiness > 0 && (
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-lg border border-gray-100">
            <span className="text-xs text-gray-500">Readiness</span>
            <span className={clsx('text-sm font-bold', getReadinessColor(readiness))}>
              {readiness}%
            </span>
            <span className={clsx('text-xs', getReadinessColor(readiness))}>
              {getReadinessLabel(readiness)}
            </span>
          </div>
        )}

        {/* Avatar */}
        <div className="w-9 h-9 rounded-full bg-primary-500 flex items-center justify-center overflow-hidden ring-2 ring-primary-100">
          {avatarUrl ? (
            <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
          ) : (
            <span className="text-white text-sm font-semibold">{initials}</span>
          )}
        </div>
      </div>
    </header>
  );
};
