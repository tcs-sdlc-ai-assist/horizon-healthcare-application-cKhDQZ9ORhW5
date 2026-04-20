import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { LOCAL_STORAGE_KEYS } from '../constants/constants';
import { ROLES } from '../constants/roles';

/**
 * Predefined mock users for SSO simulation.
 * Each user has credentials and an assigned role.
 * @type {Array<{ id: string, username: string, password: string, name: string, email: string, role: string, avatar: string }>}
 */
const MOCK_USERS = [
  {
    id: 'USR-001',
    username: 'admin',
    password: 'admin123',
    name: 'Sarah Chen',
    email: 'sarah.chen@horizon-health.com',
    role: ROLES.ADMIN,
    avatar: 'SC',
  },
  {
    id: 'USR-002',
    username: 'manager',
    password: 'manager123',
    name: 'James Wilson',
    email: 'james.wilson@horizon-health.com',
    role: ROLES.MANAGER,
    avatar: 'JW',
  },
  {
    id: 'USR-003',
    username: 'delivery',
    password: 'delivery123',
    name: 'Maria Garcia',
    email: 'maria.garcia@horizon-health.com',
    role: ROLES.DELIVERY_MANAGER,
    avatar: 'MG',
  },
  {
    id: 'USR-004',
    username: 'qelead',
    password: 'qelead123',
    name: 'David Kim',
    email: 'david.kim@horizon-health.com',
    role: ROLES.QE_LEAD,
    avatar: 'DK',
  },
  {
    id: 'USR-005',
    username: 'developer',
    password: 'dev123',
    name: 'Emily Johnson',
    email: 'emily.johnson@horizon-health.com',
    role: ROLES.DEVELOPER,
    avatar: 'EJ',
  },
  {
    id: 'USR-006',
    username: 'testlead',
    password: 'test123',
    name: 'Robert Taylor',
    email: 'robert.taylor@horizon-health.com',
    role: ROLES.TEST_LEAD,
    avatar: 'RT',
  },
  {
    id: 'USR-007',
    username: 'viewer',
    password: 'viewer123',
    name: 'Lisa Anderson',
    email: 'lisa.anderson@horizon-health.com',
    role: ROLES.VIEW_ONLY,
    avatar: 'LA',
  },
];

/**
 * @typedef {Object} AuthUser
 * @property {string} id
 * @property {string} name
 * @property {string} email
 * @property {string} role
 * @property {string} avatar
 * @property {string} token
 */

/**
 * @typedef {Object} AuthContextValue
 * @property {AuthUser|null} user - The currently authenticated user or null
 * @property {function} login - Async function accepting { username, password } credentials
 * @property {function} logout - Function to clear the session
 * @property {boolean} isAuthenticated - Whether a user is currently logged in
 * @property {boolean} loading - Whether the auth state is being initialized
 */

const AuthContext = createContext(null);

/**
 * Serializes user data for localStorage persistence.
 * Strips sensitive fields before storage.
 * @param {AuthUser} user
 * @returns {string} JSON string
 */
function serializeUser(user) {
  return JSON.stringify({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    avatar: user.avatar,
    token: user.token,
  });
}

/**
 * Deserializes user data from localStorage.
 * @param {string|null} data
 * @returns {AuthUser|null}
 */
function deserializeUser(data) {
  if (!data) {
    return null;
  }
  try {
    const parsed = JSON.parse(data);
    if (parsed && parsed.id && parsed.name && parsed.role && parsed.token) {
      return {
        id: parsed.id,
        name: parsed.name,
        email: parsed.email || '',
        role: parsed.role,
        avatar: parsed.avatar || '',
        token: parsed.token,
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Generates a mock JWT-style token for session simulation.
 * @param {string} userId
 * @returns {string}
 */
function generateMockToken(userId) {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(
    JSON.stringify({
      sub: userId,
      iat: Date.now(),
      exp: Date.now() + 30 * 60 * 1000,
    })
  );
  const signature = btoa(`mock-signature-${userId}-${Date.now()}`);
  return `${header}.${payload}.${signature}`;
}

/**
 * AuthProvider component that wraps the application and provides
 * authentication state and actions via React Context.
 *
 * @param {{ children: React.ReactNode }} props
 * @returns {React.ReactElement}
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Rehydrate session from localStorage on mount
  useEffect(() => {
    try {
      const storedUser = localStorage.getItem(LOCAL_STORAGE_KEYS.HORIZON_AUTH_USER);
      const restoredUser = deserializeUser(storedUser);
      if (restoredUser) {
        setUser(restoredUser);
      }
    } catch (error) {
      console.error('Failed to restore auth session:', error);
      localStorage.removeItem(LOCAL_STORAGE_KEYS.HORIZON_AUTH_USER);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Authenticates a user against the mock user list.
   * @param {{ username: string, password: string }} credentials
   * @returns {Promise<{ success: boolean, user?: AuthUser, error?: string }>}
   */
  const login = useCallback(async (credentials) => {
    if (!credentials || !credentials.username || !credentials.password) {
      return {
        success: false,
        error: 'Username and password are required.',
      };
    }

    const { username, password } = credentials;

    // Simulate network delay for realistic SSO behavior
    await new Promise((resolve) => setTimeout(resolve, 500));

    const matchedUser = MOCK_USERS.find(
      (u) =>
        u.username.toLowerCase() === username.trim().toLowerCase() &&
        u.password === password
    );

    if (!matchedUser) {
      return {
        success: false,
        error: 'Invalid username or password.',
      };
    }

    const token = generateMockToken(matchedUser.id);

    const authenticatedUser = {
      id: matchedUser.id,
      name: matchedUser.name,
      email: matchedUser.email,
      role: matchedUser.role,
      avatar: matchedUser.avatar,
      token,
    };

    try {
      localStorage.setItem(
        LOCAL_STORAGE_KEYS.HORIZON_AUTH_USER,
        serializeUser(authenticatedUser)
      );
    } catch (error) {
      console.error('Failed to persist auth session:', error);
    }

    setUser(authenticatedUser);

    return {
      success: true,
      user: authenticatedUser,
    };
  }, []);

  /**
   * Clears the current user session and removes persisted auth data.
   */
  const logout = useCallback(() => {
    try {
      localStorage.removeItem(LOCAL_STORAGE_KEYS.HORIZON_AUTH_USER);
    } catch (error) {
      console.error('Failed to clear auth session:', error);
    }
    setUser(null);
  }, []);

  const isAuthenticated = user !== null;

  const contextValue = useMemo(
    () => ({
      user,
      login,
      logout,
      isAuthenticated,
      loading,
    }),
    [user, login, logout, isAuthenticated, loading]
  );

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

AuthProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

/**
 * Custom hook to access the authentication context.
 * Must be used within an AuthProvider.
 *
 * @returns {AuthContextValue} The authentication context value
 * @throws {Error} If used outside of AuthProvider
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === null) {
    throw new Error('useAuth must be used within an AuthProvider.');
  }
  return context;
}

/**
 * Exported for testing and admin UI purposes.
 * Returns the list of available mock users (without passwords).
 * @returns {Array<{ id: string, username: string, name: string, email: string, role: string, avatar: string }>}
 */
export function getMockUsers() {
  return MOCK_USERS.map(({ password, ...rest }) => rest);
}

export default AuthContext;