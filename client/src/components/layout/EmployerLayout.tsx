import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { EmployerSidebar, EmployerMobileMenuButton } from './EmployerSidebar';
import { useAuth } from '../../contexts/AuthContext';
import { getInitials, getAvatarUrl } from '../../utils/helpers';

const PAGE_TITLES: Record<string, string> = {
  '/employer/dashboard':   'Dashboard',
  '/employer/profile':     'Company Profile',
  '/employer/internships': 'My Internships',
  '/employer/applicants':  'Applicants',
};

export const EmployerLayout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const { user } = useAuth();

  const profile = user?.profile as { companyName?: string; logoUrl?: string } | null;
  const avatarUrl = getAvatarUrl(profile?.logoUrl);
  const initials = profile?.companyName ? profile.companyName.slice(0, 2).toUpperCase() : 'CO';

  const baseRoute = '/' + location.pathname.split('/').slice(1, 3).join('/');
  const pageTitle = PAGE_TITLES[baseRoute] ?? 'Employer Portal';

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <EmployerSidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <header className="h-16 bg-white border-b border-gray-100 px-4 lg:px-6 flex items-center justify-between shrink-0 z-30">
          <div className="flex items-center gap-4">
            <EmployerMobileMenuButton onClick={() => setMobileOpen(true)} />
            <h1 className="text-lg font-semibold text-gray-900 hidden sm:block">{pageTitle}</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden md:block text-sm text-gray-500">{profile?.companyName}</span>
            <div className="w-9 h-9 rounded-full bg-emerald-600 flex items-center justify-center overflow-hidden ring-2 ring-emerald-100">
              {avatarUrl ? (
                <img src={avatarUrl} alt="logo" className="w-full h-full object-cover" />
              ) : (
                <span className="text-white text-sm font-semibold">{initials}</span>
              )}
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default EmployerLayout;
