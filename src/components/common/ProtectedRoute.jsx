import { useMemo } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import PropTypes from 'prop-types';
import { useAuth } from '@/context/AuthContext';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';

/**
 * Route guard component that checks authentication status via AuthContext.
 * If not authenticated, redirects to the login page preserving the intended destination.
 * If authenticated but lacking a required role, displays an access denied message.
 *
 * @param {object} props
 * @param {React.ReactNode} props.children - The protected content to render when authorized
 * @param {string[]} [props.requiredRoles] - Array of role strings that are allowed to access this route.
 *   If empty or not provided, any authenticated user can access the route.
 * @param {string} [props.redirectTo='/login'] - Path to redirect unauthenticated users to
 * @returns {JSX.Element}
 */
export function ProtectedRoute({ children, requiredRoles, redirectTo }) {
  const { user, isAuthenticated, loading } = useAuth();
  const location = useLocation();

  const hasRequiredRole = useMemo(() => {
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    if (!user || !user.role) {
      return false;
    }

    return requiredRoles.includes(user.role);
  }, [requiredRoles, user]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-900">
        <LoadingSpinner message="Verifying authentication..." size="lg" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to={redirectTo}
        state={{ from: location.pathname + location.search }}
        replace
      />
    );
  }

  if (!hasRequiredRole) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 dark:bg-slate-900">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="flex items-center justify-center">
            <svg
              className="h-16 w-16 text-red-500"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636"
              />
            </svg>
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
              Access Denied
            </h1>
            <p className="text-base text-slate-600 dark:text-slate-400">
              You do not have the required permissions to access this page.
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <div className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  Your Role:
                </span>
                <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                  {user?.role || 'Unknown'}
                </span>
              </div>
              {requiredRoles && requiredRoles.length > 0 && (
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    Required:
                  </span>
                  <div className="flex flex-wrap justify-end gap-1">
                    {requiredRoles.map((role) => (
                      <span
                        key={role}
                        className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                      >
                        {role}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => window.history.back()}
              className="btn-secondary"
            >
              <svg
                className="mr-1.5 h-4 w-4"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18"
                />
              </svg>
              Go Back
            </button>
            <a
              href="/"
              className="btn-primary"
            >
              Go to Dashboard
            </a>
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            If you believe this is an error, please contact your administrator.
          </p>
        </div>
      </div>
    );
  }

  return children;
}

ProtectedRoute.propTypes = {
  children: PropTypes.node.isRequired,
  requiredRoles: PropTypes.arrayOf(PropTypes.string),
  redirectTo: PropTypes.string,
};

ProtectedRoute.defaultProps = {
  requiredRoles: [],
  redirectTo: '/login',
};

export default ProtectedRoute;