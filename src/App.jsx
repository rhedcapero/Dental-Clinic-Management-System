import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { NavProvider } from './context/NavContext';
import { NotificationProvider } from './context/NotificationContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { NotificationModal } from './components/NotificationModal';

// Public Pages
import { Home } from './pages/Home';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { StaffLogin } from './pages/StaffLogin';
import { QueueDisplay } from './pages/QueueDisplay';

// Patient Pages
import { PatientDashboard } from './pages/patient/PatientDashboard';
import { PatientQueue } from './pages/patient/PatientQueue';
import { PatientAppointments } from './pages/patient/PatientAppointments';
import { PatientHistory } from './pages/patient/PatientHistory';
import { PatientProfile } from './pages/patient/PatientProfile';

// Admin Pages
import { StaffDashboard } from './pages/staff/StaffDashboard';
import { StaffQueue } from './pages/staff/StaffQueue';
import { StaffAppointments } from './pages/staff/StaffAppointments';
import { StaffPatients } from './pages/staff/StaffPatients';
import { StaffLogs } from './pages/staff/StaffLogs';
import { StaffServices } from './pages/staff/StaffServices';

// Layout wrapper for Patient Portal
const PatientLayout = ({ children }) => (
  <div className="portal-layout patient-portal-wrapper">
    <Navbar />
    <div className="portal-content-row">
      <Sidebar type="patient" />
      <main className="page-body">{children}</main>
    </div>
  </div>
);

// Layout wrapper for Administrator Portal
const AdminLayout = ({ children }) => (
  <div className="portal-layout admin-portal admin-portal-wrapper">
    <Navbar />
    <div className="portal-content-row admin-content-row">
      <Sidebar type="admin" />
      <main className="page-body admin-page-body">{children}</main>
    </div>
  </div>
);

// Layout wrapper for Public Pages
const PublicLayout = ({ children }) => (
  <div className="public-layout-wrapper">
    <Navbar />
    <main className="public-page-body">{children}</main>
  </div>
);

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <NavProvider>
          <NotificationProvider>
            <NotificationModal />
            <Routes>
          {/* Public Routes */}
          <Route path="/" element={<PublicLayout><Home /></PublicLayout>} />
          <Route path="/login" element={<PublicLayout><Login /></PublicLayout>} />
          <Route path="/register" element={<PublicLayout><Register /></PublicLayout>} />
          <Route path="/admin/login" element={<PublicLayout><StaffLogin /></PublicLayout>} />
          <Route path="/staff/login" element={<PublicLayout><StaffLogin /></PublicLayout>} />
          <Route path="/display" element={<QueueDisplay />} />

          {/* Patient Routes (Protected) */}
          <Route
            path="/patient/dashboard"
            element={
              <ProtectedRoute>
                <PatientLayout><PatientDashboard /></PatientLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/patient/queue"
            element={
              <ProtectedRoute>
                <PatientLayout><PatientQueue /></PatientLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/patient/appointments"
            element={
              <ProtectedRoute>
                <PatientLayout><PatientAppointments /></PatientLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/patient/history"
            element={
              <ProtectedRoute>
                <PatientLayout><PatientHistory /></PatientLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/patient/profile"
            element={
              <ProtectedRoute>
                <PatientLayout><PatientProfile /></PatientLayout>
              </ProtectedRoute>
            }
          />

          {/* Administrator Routes (Protected: Require Administrator) */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute requireAdmin={true}>
                <AdminLayout><StaffDashboard /></AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/dashboard"
            element={
              <ProtectedRoute requireAdmin={true}>
                <AdminLayout><StaffDashboard /></AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/queue"
            element={
              <ProtectedRoute requireAdmin={true}>
                <AdminLayout><StaffQueue /></AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/appointments"
            element={
              <ProtectedRoute requireAdmin={true}>
                <AdminLayout><StaffAppointments /></AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/patients"
            element={
              <ProtectedRoute requireAdmin={true}>
                <AdminLayout><StaffPatients /></AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/logs"
            element={
              <ProtectedRoute requireAdmin={true}>
                <AdminLayout><StaffLogs /></AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/services"
            element={
              <ProtectedRoute requireAdmin={true}>
                <AdminLayout><StaffServices /></AdminLayout>
              </ProtectedRoute>
            }
          />

          {/* Legacy Staff Redirects -> Route directly to Admin Dashboard / Modules */}
          <Route path="/staff/dashboard" element={<Navigate to="/admin" replace />} />
          <Route path="/staff/queue" element={<Navigate to="/admin/queue" replace />} />
          <Route path="/staff/appointments" element={<Navigate to="/admin/appointments" replace />} />
          <Route path="/staff/patients" element={<Navigate to="/admin/patients" replace />} />
          <Route path="/staff/logs" element={<Navigate to="/admin/logs" replace />} />
          <Route path="/staff/services" element={<Navigate to="/admin/services" replace />} />

          {/* Catch-all redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
          </NotificationProvider>
        </NavProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
