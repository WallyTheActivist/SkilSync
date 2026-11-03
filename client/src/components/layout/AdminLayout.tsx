import React, { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Container, Badge, Offcanvas } from 'react-bootstrap';
import { Menu } from 'lucide-react';
import AdminSidebar from './AdminSidebar';

const PAGE_TITLES: Record<string, string> = {
  '/admin/dashboard': 'Admin Dashboard',
  '/admin/students': 'Manage Students',
  '/admin/employers': 'Manage Employers',
  '/admin/internships': 'Manage Internships',
  '/admin/skills': 'Skills Catalogue',
  '/admin/applications': 'Applications',
  '/admin/reports': 'Reports & Analytics',
};

export const AdminLayout: React.FC = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const baseRoute = '/' + location.pathname.split('/').slice(1, 3).join('/');
  const pageTitle = PAGE_TITLES[baseRoute] ?? 'Admin Console';

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  return (
    <div className="dashboard-layout">
      {/* Sidebar */}
      <AdminSidebar />

      {/* Main Content */}
      <div className="dashboard-main">
        {/* Navbar */}
        <nav className="navbar navbar-expand-lg navbar-light bg-white border-bottom border-1 dashboard-topbar">
          <Container fluid className="px-4 px-md-5">
            <button
              className="btn btn-sm d-lg-none admin-menu-toggle"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation menu"
              aria-expanded={mobileOpen}
            >
              <Menu size={24} />
            </button>

            <div className="ms-3 flex-grow-1 min-width-0">
              <h5 className="admin-topbar-title">
                {pageTitle}
              </h5>
            </div>

            <div className="d-flex align-items-center gap-3">
              <Badge bg="primary" className="px-3 py-2 admin-role-badge">
                ADMIN
              </Badge>
            </div>
          </Container>
        </nav>

        {/* Page Content */}
        <main className="dashboard-content">
          <Outlet />
        </main>
      </div>

      {/* Mobile Sidebar - Offcanvas */}
      <Offcanvas
        show={mobileOpen}
        onHide={() => setMobileOpen(false)}
        placement="start"
        backdrop={true}
        className="offcanvas-sidebar"
        style={{ maxWidth: '250px' }}
      >
        <Offcanvas.Header closeButton>
          <Offcanvas.Title className="fw-bold">SkillSync</Offcanvas.Title>
        </Offcanvas.Header>
        <Offcanvas.Body className="p-0">
          <AdminSidebar mobile />
        </Offcanvas.Body>
      </Offcanvas>
    </div>
  );
};

export default AdminLayout;
