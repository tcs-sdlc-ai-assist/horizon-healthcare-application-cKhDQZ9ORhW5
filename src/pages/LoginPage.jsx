import { useState, useCallback, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { ROLES } from '@/constants/roles';

const ROLE_OPTIONS = [
  { value: 'admin', label: ROLES.ADMIN, description: 'Full access to all features and settings' },
  { value: 'manager', label: ROLES.MANAGER, description: 'View reports and export data' },
  { value: 'delivery', label: ROLES.DELIVERY_MANAGER, description: 'Manage delivery metrics and exports' },
  { value: 'qelead', label: ROLES.QE_LEAD, description: 'Import, edit, and export test data' },
  { value: 'developer', label: ROLES.DEVELOPER, description: 'Edit and export development metrics' },
  { value: 'testlead', label: ROLES.TEST_LEAD, description: 'Import, edit, and export test data' },
  { value: 'viewer', label: ROLES.VIEW_ONLY, description: 'Read-only access to dashboards' },
];

const PASSWORD_MAP = {
  admin: 'admin123',
  manager: 'manager123',
  delivery: 'delivery123',
  qelead: 'qelead123',
  developer: 'dev123',
  testlead: 'test123',
  viewer: 'viewer123',
};

export default function LoginPage() {
  const [selectedRole, setSelectedRole] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/';

  useEffect(() => {
    if (isAuthenticated) {
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, from]);

  const handleRoleChange = useCallback((e) => {
    const role = e.target.value;
    setSelectedRole(role);
    setError('');

    if (role) {
      setUsername(role);
    } else {
      setUsername('');
    }
  }, []);

  const handleUsernameChange = useCallback((e) => {
    setUsername(e.target.value);
    setError('');
  }, []);

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      setError('');

      if (!selectedRole) {
        setError('Please select a role to continue.');
        return;
      }

      if (!username || username.trim() === '') {
        setError('Username is required.');
        return;
      }

      const password = PASSWORD_MAP[selectedRole];
      if (!password) {
        setError('Invalid role selection. Please try again.');
        return;
      }

      setIsSubmitting(true);

      try {
        const result = await login({
          username: username.trim(),
          password,
        });

        if (result.success) {
          navigate(from, { replace: true });
        } else {
          setError(result.error || 'Login failed. Please check your credentials and try again.');
        }
      } catch (err) {
        setError('An unexpected error occurred. Please try again.');
        console.error('Login error:', err);
      } finally {
        setIsSubmitting(false);
      }
    },
    [selectedRole, username, login, navigate, from]
  );

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 px-4 py-12 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      {/* Logo */}
      <div className="absolute right-4 top-4">
        <img
          src="/src/public/logo.png"
          alt="Logo"
          className="h-12 w-12 object-contain"
        />
      </div>

      <div className="w-full max-w-md">
        {/* Branding Header */}
        <div className="mb-8 text-center">
          <div className="mb-4 flex items-center justify-center gap-2.5">
            <svg
              className="h-10 w-10 text-blue-600 dark:text-blue-400"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z"
              />
            </svg>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Horizon Healthcare
            </h1>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Sign in to access the Healthcare Dashboards
          </p>
        </div>

        {/* Login Card */}
        <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-card dark:border-slate-700 dark:bg-slate-800">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
              Mock SSO Login
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Select a role to simulate single sign-on authentication
            </p>
          </div>

          <form onSubmit={handleSubmit} noValidate>
            {/* Role Selection */}
            <div className="mb-5">
              <label
                htmlFor="role-select"
                className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Role <span className="text-red-500">*</span>
              </label>
              <select
                id="role-select"
                value={selectedRole}
                onChange={handleRoleChange}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm transition-shadow duration-200 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                disabled={isSubmitting}
                aria-required="true"
              >
                <option value="">Select a role...</option>
                {ROLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {selectedRole && (
                <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                  {ROLE_OPTIONS.find((o) => o.value === selectedRole)?.description || ''}
                </p>
              )}
            </div>

            {/* Username Input */}
            <div className="mb-5">
              <label
                htmlFor="username-input"
                className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Username <span className="text-red-500">*</span>
              </label>
              <input
                id="username-input"
                type="text"
                value={username}
                onChange={handleUsernameChange}
                placeholder="Enter username"
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm transition-shadow duration-200 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:placeholder:text-slate-500"
                disabled={isSubmitting}
                autoComplete="username"
                aria-required="true"
              />
            </div>

            {/* Error Display */}
            {error && (
              <div
                className="mb-5 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 dark:border-red-800 dark:bg-red-900/20"
                role="alert"
              >
                <svg
                  className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500 dark:text-red-400"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
                <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:bg-blue-700 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 active:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60 dark:focus:ring-offset-slate-800"
            >
              {isSubmitting ? (
                <>
                  <div
                    className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
                    aria-hidden="true"
                  />
                  Signing in...
                </>
              ) : (
                <>
                  <svg
                    className="h-4 w-4"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9"
                    />
                  </svg>
                  Sign In
                </>
              )}
            </button>
          </form>
        </div>

        {/* Available Credentials Info */}
        <div className="mt-6 rounded-xl border border-slate-200 bg-white/80 p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800/80">
          <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
            Available Test Accounts
          </h3>
          <div className="space-y-2">
            {ROLE_OPTIONS.map((option) => (
              <div
                key={option.value}
                className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2 dark:bg-slate-700/50"
              >
                <div className="flex items-center gap-2">
                  <span className="inline-block h-2 w-2 rounded-full bg-green-500" aria-hidden="true" />
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    {option.label}
                  </span>
                </div>
                <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                  {option.value}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-2xs text-slate-400 dark:text-slate-500">
            Select a role above to auto-fill credentials. Passwords are pre-configured for each role.
          </p>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-xs text-slate-400 dark:text-slate-500">
            © {new Date().getFullYear()} Horizon Healthcare. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}