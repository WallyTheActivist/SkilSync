import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  LayoutDashboard, Users, Building2, Briefcase, Award,
  FileText, BarChart3, LogOut, Zap, Database,
} from 'lucide-react';

const adminNav = [
  { label: 'Dashboard', to: '/admin/dashboard', icon: LayoutDashboard },
  { label: 'Students', to: '/admin/students', icon: Users },
  { label: 'Employers', to: '/admin/employers', icon: Building2 },
  { label: 'Internships', to: '/admin/internships', icon: Briefcase },
  { label: 'Skills', to: '/admin/skills', icon: Award },
  { label: 'Applications', to: '/admin/applications', icon: FileText },
  { label: 'Reports', to: '/admin/reports', icon: BarChart3 },
  { label: 'Backup & Recovery', to: '/admin/backups', icon: Database },
];

interface AdminSidebarProps {
  mobile?: boolean;
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({ mobile = false }) => {
  const { user, logout } = useAuth();

  return (
    <aside
      className={`sidebar ${mobile ? '' : 'd-none d-lg-flex'}`}
      aria-label="Admin navigation"
    >
      {/* Header */}
      <div className="sidebar-header">
        <NavLink to="/admin/dashboard" className="sidebar-logo">
          <Zap size={24} className="sidebar-logo-icon" />
          <div>
            <div>SkillSync</div>
            <div className="sidebar-logo-label">Admin</div>
          </div>
        </NavLink>
      </div>

      {/* Navigation Menu */}
      <nav aria-label="Admin pages">
        <ul className="sidebar-menu">
          {adminNav.map((item) => {
            const Icon = item.icon;

            return (
              <li key={item.to} className="sidebar-menu-item">
                <NavLink
                  to={item.to}
                  end
                  className={({ isActive }) => `sidebar-menu-link ${isActive ? 'active' : ''}`}
                >
                  <Icon size={20} className="sidebar-menu-icon" />
                  <span>{item.label}</span>
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User Section */}
      <div className="mt-auto p-3 sidebar-user">
        <div className="d-flex align-items-center gap-2 p-2 mb-2">
          <div className="sidebar-user-avatar">
            AD
          </div>
          {!mobile && (
            <div className="sidebar-user-details">
              <div className="sidebar-user-name">
                Administrator
              </div>
              <div className="sidebar-user-email">
                {user?.email}
              </div>
            </div>
          )}
        </div>
        <button
          onClick={logout}
          className="sidebar-menu-link sidebar-logout w-100"
          aria-label="Log out"
        >
          <LogOut size={20} className="sidebar-menu-icon" />
          {!mobile && <span>Log Out</span>}
        </button>
      </div>
    </aside>
  );
};

export default AdminSidebar;
