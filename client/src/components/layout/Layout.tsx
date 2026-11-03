import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Navbar } from './Navbar';

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/profile': 'My Profile',
  '/skills': 'My Skills',
  '/internships': 'Internships',
  '/matches': 'Recommended Matches',
  '/applications': 'My Applications',
  '/skill-gap': 'Skill Gap Analysis',
};

export const Layout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const pageTitle = PAGE_TITLES[location.pathname] ?? 'SkillSync';

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Navbar
          onMobileMenuOpen={() => setMobileOpen(true)}
          pageTitle={pageTitle}
        />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
