import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Layout } from './components/layout/Layout';
import { EmployerLayout } from './components/layout/EmployerLayout';
import { AdminLayout } from './components/layout/AdminLayout';

// Auth pages
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';
import VerifyEmail from './pages/auth/VerifyEmail';
import EmailVerificationPending from './pages/auth/EmailVerificationPending';

// Student pages
import Dashboard from './pages/student/Dashboard';
import Profile from './pages/student/Profile';
import Skills from './pages/student/Skills';
import Internships from './pages/student/Internships';
import InternshipDetail from './pages/student/InternshipDetail';
import Matches from './pages/student/Matches';
import Applications from './pages/student/Applications';
import SkillGapAnalysis from './pages/student/SkillGapAnalysis';

// Employer pages
import EmployerDashboard from './pages/employer/Dashboard';
import CompanyProfile from './pages/employer/CompanyProfile';
import MyInternships from './pages/employer/MyInternships';
import PostInternship from './pages/employer/PostInternship';
import Applicants from './pages/employer/Applicants';

// Admin pages
import AdminDashboard from './pages/admin/Dashboard';
import AdminStudents from './pages/admin/Students';
import AdminEmployers from './pages/admin/Employers';
import AdminInternships from './pages/admin/AdminInternships';
import SkillsCatalogue from './pages/admin/SkillsCatalogue';
import AdminApplications from './pages/admin/AdminApplications';
import Analytics from './pages/admin/Analytics';
import Reports from './pages/admin/Reports';
import BackupRecovery from './pages/admin/BackupRecovery';

// Protected Route wrapper
const ProtectedRoute: React.FC<{ children: React.ReactNode; requiredRole?: string }> = ({
  children,
  requiredRole,
}) => {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-3 border-primary-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 text-sm">Loading SkillSync...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (requiredRole && user?.role !== requiredRole) {
    // Redirect to correct home based on actual role
    if (user?.role === 'EMPLOYER') return <Navigate to="/employer/dashboard" replace />;
    if (user?.role === 'ADMIN') return <Navigate to="/admin/dashboard" replace />;
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading, user } = useAuth();
  if (isLoading) return null;
  if (isAuthenticated) {
    if (user?.role === 'EMPLOYER') return <Navigate to="/employer/dashboard" replace />;
    if (user?.role === 'ADMIN') return <Navigate to="/admin/dashboard" replace />;
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
};

const AppRoutes: React.FC = () => (
  <Routes>
    {/* Public routes */}
    <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
    <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
    <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
    <Route path="/reset-password" element={<PublicRoute><ResetPassword /></PublicRoute>} />
    <Route path="/verify-email" element={<VerifyEmail />} />
    <Route path="/verify-email/pending" element={<EmailVerificationPending />} />

    {/* Protected student routes */}
    <Route
      path="/"
      element={
        <ProtectedRoute requiredRole="STUDENT">
          <Layout />
        </ProtectedRoute>
      }
    >
      <Route index element={<Navigate to="/dashboard" replace />} />
      <Route path="dashboard" element={<Dashboard />} />
      <Route path="profile" element={<Profile />} />
      <Route path="skills" element={<Skills />} />
      <Route path="internships" element={<Internships />} />
      <Route path="internships/:id" element={<InternshipDetail />} />
      <Route path="matches" element={<Matches />} />
      <Route path="applications" element={<Applications />} />
      <Route path="skill-gap" element={<SkillGapAnalysis />} />
    </Route>

    {/* Protected employer routes */}
    <Route
      path="/employer"
      element={
        <ProtectedRoute requiredRole="EMPLOYER">
          <EmployerLayout />
        </ProtectedRoute>
      }
    >
      <Route index element={<Navigate to="/employer/dashboard" replace />} />
      <Route path="dashboard" element={<EmployerDashboard />} />
      <Route path="profile" element={<CompanyProfile />} />
      <Route path="internships" element={<MyInternships />} />
      <Route path="internships/new" element={<PostInternship />} />
      <Route path="internships/:id/edit" element={<PostInternship />} />
      <Route path="applicants" element={<Applicants />} />
    </Route>

    {/* Protected admin routes */}
    <Route
      path="/admin"
      element={
        <ProtectedRoute requiredRole="ADMIN">
          <AdminLayout />
        </ProtectedRoute>
      }
    >
      <Route index element={<Navigate to="/admin/dashboard" replace />} />
      <Route path="dashboard" element={<AdminDashboard />} />
      <Route path="students" element={<AdminStudents />} />
      <Route path="employers" element={<AdminEmployers />} />
      <Route path="internships" element={<AdminInternships />} />
      <Route path="skills" element={<SkillsCatalogue />} />
      <Route path="applications" element={<AdminApplications />} />
      <Route path="analytics" element={<Analytics />} />
      <Route path="reports" element={<Reports />} />
      <Route path="backups" element={<BackupRecovery />} />
    </Route>

    {/* Fallback */}
    <Route path="*" element={<Navigate to="/login" replace />} />
  </Routes>
);

const App: React.FC = () => (
  <BrowserRouter>
    <AuthProvider>
      <AppRoutes />
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3500,
          style: {
            borderRadius: '10px',
            background: '#1e293b',
            color: '#fff',
            fontSize: '14px',
          },
          success: { iconTheme: { primary: '#10b981', secondary: '#fff' } },
          error:   { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
        }}
      />
    </AuthProvider>
  </BrowserRouter>
);

export default App;
