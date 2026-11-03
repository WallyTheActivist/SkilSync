import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, User, Briefcase, Star, FileText,
  TrendingUp, Award, LogOut, ChevronLeft, ChevronRight,
  Zap, Menu, X,
} from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../../contexts/AuthContext';
import { getInitials, getAvatarUrl } from '../../utils/helpers';

interface NavItem {
  label: string;
  to: string;
  icon: React.ElementType;
}

const studentNav: NavItem[] = [
  { label: 'Dashboard',        to: '/dashboard',       icon: LayoutDashboard },
  { label: 'My Profile',       to: '/profile',         icon: User },
  { label: 'My Skills',        to: '/skills',          icon: Award },
  { label: 'Internships',      to: '/internships',     icon: Briefcase },
  { label: 'Matches',          to: '/matches',         icon: Star },
  { label: 'Applications',     to: '/applications',    icon: FileText },
  { label: 'Skill Gap',        to: '/skill-gap',       icon: TrendingUp },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ collapsed, onToggle, mobileOpen, onMobileClose }) => {
  const { user, logout } = useAuth();
  const location = useLocation();

  const profile = user?.profile as { firstName?: string; lastName?: string; avatarUrl?: string; readinessScore?: number } | null;
  const avatarUrl = getAvatarUrl(profile?.avatarUrl);
  const initials = getInitials(profile?.firstName, profile?.lastName);

  const NavItems = () => (
    <nav className="flex-1 px-3 py-2 overflow-y-auto">
      <ul className="space-y-1">
        {studentNav.map((item) => {
          const isActive = location.pathname === item.to;
          return (
            <li key={item.to}>
              <NavLink
                to={item.to}
                onClick={onMobileClose}
                className={clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150',
                  isActive
                    ? 'bg-primary-600 text-white shadow-sm'
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
      {/* Logo */}
      <div className={clsx('flex items-center gap-3 px-4 py-5 border-b border-white/10', collapsed ? 'justify-center' : '')}>
        <div className="w-8 h-8 bg-primary-400 rounded-lg flex items-center justify-center shrink-0">
          <Zap size={16} className="text-white" />
        </div>
        {!collapsed && (
          <div>
            <p className="font-bold text-white text-lg leading-none">SkillSync</p>
            <p className="text-slate-400 text-xs mt-0.5">Career Platform</p>
          </div>
        )}
      </div>

      <NavItems />

      {/* Bottom section */}
      <div className="border-t border-white/10 p-3">
        {/* User */}
        <div className={clsx('flex items-center gap-3 px-2 py-2 mb-1', collapsed && 'justify-center')}>
          <div className="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center shrink-0 overflow-hidden">
            {avatarUrl ? (
              <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
            ) : (
              <span className="text-white text-xs font-semibold">{initials}</span>
            )}
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <p className="text-white text-sm font-medium truncate">
                {profile?.firstName} {profile?.lastName}
              </p>
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
      {/* Desktop sidebar */}
      <aside
        className={clsx(
          'hidden lg:flex flex-col bg-brand-navy border-r border-white/5 relative transition-all duration-300',
          collapsed ? 'w-16' : 'w-64',
        )}
      >
        <SidebarContent />
        <button
          onClick={onToggle}
          className="absolute -right-3 top-20 bg-white border border-gray-200 rounded-full p-0.5 shadow-md text-gray-500 hover:text-gray-700 z-10"
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="absolute inset-0 bg-black/50" onClick={onMobileClose} />
          <aside className="relative w-64 bg-brand-navy flex flex-col">
            <SidebarContent />
          </aside>
        </div>
      )}
    </>
  );
};

export const MobileMenuButton: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <button
    onClick={onClick}
    className="lg:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100"
  >
    <Menu size={20} />
  </button>
);
