import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Building2, Briefcase, Users, LogOut,
  ChevronLeft, ChevronRight, Zap, Menu, X,
} from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../../contexts/AuthContext';
import { getInitials, getAvatarUrl } from '../../utils/helpers';

const employerNav = [
  { label: 'Dashboard',       to: '/employer/dashboard',    icon: LayoutDashboard },
  { label: 'Company Profile', to: '/employer/profile',      icon: Building2 },
  { label: 'My Internships',  to: '/employer/internships',  icon: Briefcase },
  { label: 'Applicants',      to: '/employer/applicants',   icon: Users },
];

interface EmployerSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export const EmployerSidebar: React.FC<EmployerSidebarProps> = ({ collapsed, onToggle, mobileOpen, onMobileClose }) => {
  const { user, logout } = useAuth();
  const location = useLocation();

  const profile = user?.profile as { companyName?: string; logoUrl?: string } | null;
  const avatarUrl = getAvatarUrl(profile?.logoUrl);
  const initials = profile?.companyName ? profile.companyName.slice(0, 2).toUpperCase() : 'CO';

  const NavItems = () => (
    <nav className="flex-1 px-3 py-2 overflow-y-auto">
      <ul className="space-y-1">
        {employerNav.map((item) => {
          const isActive = location.pathname.startsWith(item.to);
          return (
            <li key={item.to}>
              <NavLink
                to={item.to}
                onClick={onMobileClose}
                className={clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150',
                  isActive
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-300 hover:bg-white/10 hover:text-white',
                )}
              >
                <item.icon size={18} className="shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className={clsx('flex items-center gap-3 px-4 py-5 border-b border-white/10', collapsed ? 'justify-center' : '')}>
        <div className="w-8 h-8 bg-emerald-400 rounded-lg flex items-center justify-center shrink-0">
          <Zap size={16} className="text-white" />
        </div>
        {!collapsed && (
          <div>
            <p className="font-bold text-white text-lg leading-none">SkillSync</p>
            <p className="text-slate-400 text-xs mt-0.5">Employer Portal</p>
          </div>
        )}
      </div>

      <NavItems />

      <div className="border-t border-white/10 p-3">
        <div className={clsx('flex items-center gap-3 px-2 py-2 mb-1', collapsed && 'justify-center')}>
          <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center shrink-0 overflow-hidden">
            {avatarUrl ? (
              <img src={avatarUrl} alt="logo" className="w-full h-full object-cover" />
            ) : (
              <span className="text-white text-xs font-semibold">{initials}</span>
            )}
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <p className="text-white text-sm font-medium truncate">{profile?.companyName || 'Company'}</p>
              <p className="text-slate-400 text-xs truncate">{user?.email}</p>
            </div>
          )}
        </div>
        <button
          onClick={logout}
          className={clsx(
            'flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm text-slate-300 hover:bg-white/10 hover:text-white transition-all',
            collapsed && 'justify-center',
          )}
        >
          <LogOut size={18} className="shrink-0" />
          {!collapsed && <span>Log Out</span>}
        </button>
      </div>
    </div>
  );

  return (
    <>
      <aside className={clsx('hidden lg:flex flex-col bg-brand-navy border-r border-white/5 relative transition-all duration-300', collapsed ? 'w-16' : 'w-64')}>
        <SidebarContent />
        <button onClick={onToggle} className="absolute -right-3 top-20 bg-white border border-gray-200 rounded-full p-0.5 shadow-md text-gray-500 hover:text-gray-700 z-10">
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </aside>
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="absolute inset-0 bg-black/50" onClick={onMobileClose} />
          <aside className="relative w-64 bg-brand-navy flex flex-col"><SidebarContent /></aside>
        </div>
      )}
    </>
  );
};

export const EmployerMobileMenuButton: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <button onClick={onClick} className="lg:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100">
    <Menu size={20} />
  </button>
);
