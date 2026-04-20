import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import { FilterProvider } from '@/context/FilterContext';
import { ProtectedRoute } from '@/components/common/ProtectedRoute';
import ErrorBoundary from '@/components/common/ErrorBoundary';
import LoginPage from '@/pages/LoginPage';
import DevSecOpsDashboard from '@/pages/DevSecOpsDashboard';
import AppDevDashboard from '@/pages/AppDevDashboard';
import AgileFlowDashboard from '@/pages/AgileFlowDashboard';
import AdminConfigPage from '@/pages/AdminConfigPage';
import NotFoundPage from '@/pages/NotFoundPage';

/**
 * Root application component.
 *
 * Sets up React Router with routes for all dashboard pages, login, and admin.
 * Wraps all routes in AuthProvider and FilterProvider context providers.
 * Protected routes use the ProtectedRoute wrapper to enforce authentication.
 * Default route (/) redirects to /dashboards/devsecops.
 *
 * @returns {JSX.Element}
 */
export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <FilterProvider>
            <Routes>
              {/* Public routes */}
              <Route path="/login" element={<LoginPage />} />

              {/* Default redirect */}
              <Route
                path="/"
                element={<Navigate to="/dashboards/devsecops" replace />}
              />

              {/* Protected dashboard routes */}
              <Route
                path="/dashboards/devsecops/*"
                element={
                  <ProtectedRoute>
                    <DevSecOpsDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboards/appdev/*"
                element={
                  <ProtectedRoute>
                    <AppDevDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboards/agile/*"
                element={
                  <ProtectedRoute>
                    <AgileFlowDashboard />
                  </ProtectedRoute>
                }
              />

              {/* Admin configuration route — protected, admin-only enforced within the page */}
              <Route
                path="/admin/config"
                element={
                  <ProtectedRoute>
                    <AdminConfigPage />
                  </ProtectedRoute>
                }
              />

              {/* Audit log route — redirects to devsecops with audit panel */}
              <Route
                path="/audit-log"
                element={
                  <ProtectedRoute>
                    <DevSecOpsDashboard />
                  </ProtectedRoute>
                }
              />

              {/* Catch-all 404 */}
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </FilterProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}