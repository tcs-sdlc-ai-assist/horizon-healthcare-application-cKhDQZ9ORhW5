import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth, getMockUsers } from '../AuthContext';
import { LOCAL_STORAGE_KEYS } from '../../constants/constants';

/**
 * Helper to create a wrapper component with AuthProvider.
 * @returns {{ wrapper: React.FC }}
 */
function createWrapper() {
  return function Wrapper({ children }) {
    return <AuthProvider>{children}</AuthProvider>;
  };
}

describe('AuthContext', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('useAuth hook', () => {
    it('throws an error when used outside of AuthProvider', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        renderHook(() => useAuth());
      }).toThrow('useAuth must be used within an AuthProvider.');

      consoleSpy.mockRestore();
    });

    it('provides initial unauthenticated state', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });

    it('starts with loading true and resolves to false', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      // loading should eventually become false
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });
  });

  describe('login', () => {
    it('successfully authenticates with valid admin credentials', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      let loginResult;
      await act(async () => {
        loginResult = await result.current.login({
          username: 'admin',
          password: 'admin123',
        });
      });

      expect(loginResult.success).toBe(true);
      expect(loginResult.user).toBeDefined();
      expect(loginResult.user.name).toBe('Sarah Chen');
      expect(loginResult.user.role).toBe('Admin');
      expect(loginResult.user.email).toBe('sarah.chen@horizon-health.com');
      expect(loginResult.user.token).toBeTruthy();

      expect(result.current.user).not.toBeNull();
      expect(result.current.user.name).toBe('Sarah Chen');
      expect(result.current.isAuthenticated).toBe(true);
    });

    it('successfully authenticates with valid viewer credentials', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      let loginResult;
      await act(async () => {
        loginResult = await result.current.login({
          username: 'viewer',
          password: 'viewer123',
        });
      });

      expect(loginResult.success).toBe(true);
      expect(loginResult.user.name).toBe('Lisa Anderson');
      expect(loginResult.user.role).toBe('View-Only');
      expect(result.current.isAuthenticated).toBe(true);
    });

    it('assigns the correct role for each mock user', async () => {
      const mockUsers = getMockUsers();
      const credentialMap = {
        admin: { password: 'admin123', expectedRole: 'Admin' },
        manager: { password: 'manager123', expectedRole: 'Manager' },
        delivery: { password: 'delivery123', expectedRole: 'Delivery Manager' },
        qelead: { password: 'qelead123', expectedRole: 'QE Lead' },
        developer: { password: 'dev123', expectedRole: 'Developer' },
        testlead: { password: 'test123', expectedRole: 'Test Lead' },
        viewer: { password: 'viewer123', expectedRole: 'View-Only' },
      };

      for (const [username, { password, expectedRole }] of Object.entries(credentialMap)) {
        localStorage.clear();

        const { result } = renderHook(() => useAuth(), {
          wrapper: createWrapper(),
        });

        await waitFor(() => {
          expect(result.current.loading).toBe(false);
        });

        let loginResult;
        await act(async () => {
          loginResult = await result.current.login({ username, password });
        });

        expect(loginResult.success).toBe(true);
        expect(loginResult.user.role).toBe(expectedRole);
      }
    });

    it('rejects login with invalid password', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      let loginResult;
      await act(async () => {
        loginResult = await result.current.login({
          username: 'admin',
          password: 'wrongpassword',
        });
      });

      expect(loginResult.success).toBe(false);
      expect(loginResult.error).toBe('Invalid username or password.');
      expect(loginResult.user).toBeUndefined();
      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });

    it('rejects login with non-existent username', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      let loginResult;
      await act(async () => {
        loginResult = await result.current.login({
          username: 'nonexistent',
          password: 'password123',
        });
      });

      expect(loginResult.success).toBe(false);
      expect(loginResult.error).toBe('Invalid username or password.');
      expect(result.current.isAuthenticated).toBe(false);
    });

    it('rejects login with empty credentials', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      let loginResult;
      await act(async () => {
        loginResult = await result.current.login({
          username: '',
          password: '',
        });
      });

      expect(loginResult.success).toBe(false);
      expect(loginResult.error).toBe('Username and password are required.');
    });

    it('rejects login with null credentials', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      let loginResult;
      await act(async () => {
        loginResult = await result.current.login(null);
      });

      expect(loginResult.success).toBe(false);
      expect(loginResult.error).toBe('Username and password are required.');
    });

    it('rejects login with missing password', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      let loginResult;
      await act(async () => {
        loginResult = await result.current.login({
          username: 'admin',
          password: '',
        });
      });

      expect(loginResult.success).toBe(false);
      expect(loginResult.error).toBe('Username and password are required.');
    });

    it('handles case-insensitive username matching', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      let loginResult;
      await act(async () => {
        loginResult = await result.current.login({
          username: 'ADMIN',
          password: 'admin123',
        });
      });

      expect(loginResult.success).toBe(true);
      expect(loginResult.user.name).toBe('Sarah Chen');
    });

    it('trims whitespace from username', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      let loginResult;
      await act(async () => {
        loginResult = await result.current.login({
          username: '  admin  ',
          password: 'admin123',
        });
      });

      expect(loginResult.success).toBe(true);
      expect(loginResult.user.name).toBe('Sarah Chen');
    });

    it('persists user session to localStorage on successful login', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.login({
          username: 'admin',
          password: 'admin123',
        });
      });

      const storedData = localStorage.getItem(LOCAL_STORAGE_KEYS.HORIZON_AUTH_USER);
      expect(storedData).not.toBeNull();

      const parsed = JSON.parse(storedData);
      expect(parsed.name).toBe('Sarah Chen');
      expect(parsed.role).toBe('Admin');
      expect(parsed.email).toBe('sarah.chen@horizon-health.com');
      expect(parsed.token).toBeTruthy();
      expect(parsed.id).toBe('USR-001');
    });

    it('does not persist session to localStorage on failed login', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.login({
          username: 'admin',
          password: 'wrongpassword',
        });
      });

      const storedData = localStorage.getItem(LOCAL_STORAGE_KEYS.HORIZON_AUTH_USER);
      expect(storedData).toBeNull();
    });

    it('generates a mock JWT-style token with three segments', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      let loginResult;
      await act(async () => {
        loginResult = await result.current.login({
          username: 'admin',
          password: 'admin123',
        });
      });

      const token = loginResult.user.token;
      expect(token).toBeTruthy();
      const segments = token.split('.');
      expect(segments).toHaveLength(3);
    });
  });

  describe('logout', () => {
    it('clears user state on logout', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.login({
          username: 'admin',
          password: 'admin123',
        });
      });

      expect(result.current.isAuthenticated).toBe(true);

      act(() => {
        result.current.logout();
      });

      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });

    it('removes session from localStorage on logout', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.login({
          username: 'admin',
          password: 'admin123',
        });
      });

      expect(localStorage.getItem(LOCAL_STORAGE_KEYS.HORIZON_AUTH_USER)).not.toBeNull();

      act(() => {
        result.current.logout();
      });

      expect(localStorage.getItem(LOCAL_STORAGE_KEYS.HORIZON_AUTH_USER)).toBeNull();
    });

    it('can logout even when not logged in without errors', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.isAuthenticated).toBe(false);

      act(() => {
        result.current.logout();
      });

      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });
  });

  describe('session persistence', () => {
    it('restores user session from localStorage on mount', async () => {
      const storedUser = {
        id: 'USR-001',
        name: 'Sarah Chen',
        email: 'sarah.chen@horizon-health.com',
        role: 'Admin',
        avatar: 'SC',
        token: 'mock.jwt.token',
      };

      localStorage.setItem(
        LOCAL_STORAGE_KEYS.HORIZON_AUTH_USER,
        JSON.stringify(storedUser)
      );

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.user).not.toBeNull();
      expect(result.current.user.name).toBe('Sarah Chen');
      expect(result.current.user.role).toBe('Admin');
      expect(result.current.user.email).toBe('sarah.chen@horizon-health.com');
      expect(result.current.user.token).toBe('mock.jwt.token');
      expect(result.current.isAuthenticated).toBe(true);
    });

    it('handles corrupted localStorage data gracefully', async () => {
      localStorage.setItem(
        LOCAL_STORAGE_KEYS.HORIZON_AUTH_USER,
        'not-valid-json{{{}'
      );

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);

      consoleSpy.mockRestore();
    });

    it('handles incomplete stored user data gracefully', async () => {
      const incompleteUser = {
        id: 'USR-001',
        name: 'Sarah Chen',
        // missing role and token
      };

      localStorage.setItem(
        LOCAL_STORAGE_KEYS.HORIZON_AUTH_USER,
        JSON.stringify(incompleteUser)
      );

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should not restore incomplete user data
      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });

    it('handles null stored value gracefully', async () => {
      // localStorage.getItem returns null for non-existent keys by default
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });
  });

  describe('getMockUsers', () => {
    it('returns mock users without passwords', () => {
      const users = getMockUsers();

      expect(Array.isArray(users)).toBe(true);
      expect(users.length).toBeGreaterThan(0);

      users.forEach((user) => {
        expect(user).toHaveProperty('id');
        expect(user).toHaveProperty('username');
        expect(user).toHaveProperty('name');
        expect(user).toHaveProperty('email');
        expect(user).toHaveProperty('role');
        expect(user).toHaveProperty('avatar');
        expect(user).not.toHaveProperty('password');
      });
    });

    it('includes all expected roles', () => {
      const users = getMockUsers();
      const roles = users.map((u) => u.role);

      expect(roles).toContain('Admin');
      expect(roles).toContain('Manager');
      expect(roles).toContain('Delivery Manager');
      expect(roles).toContain('QE Lead');
      expect(roles).toContain('Developer');
      expect(roles).toContain('Test Lead');
      expect(roles).toContain('View-Only');
    });

    it('returns 7 mock users', () => {
      const users = getMockUsers();
      expect(users).toHaveLength(7);
    });
  });

  describe('re-login after logout', () => {
    it('allows login after a previous logout', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Login
      await act(async () => {
        await result.current.login({
          username: 'admin',
          password: 'admin123',
        });
      });

      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user.name).toBe('Sarah Chen');

      // Logout
      act(() => {
        result.current.logout();
      });

      expect(result.current.isAuthenticated).toBe(false);

      // Login again with different user
      await act(async () => {
        await result.current.login({
          username: 'developer',
          password: 'dev123',
        });
      });

      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user.name).toBe('Emily Johnson');
      expect(result.current.user.role).toBe('Developer');
    });
  });

  describe('localStorage error handling', () => {
    it('handles localStorage.setItem failure during login gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const originalSetItem = localStorage.setItem;
      localStorage.setItem = vi.fn(() => {
        throw new Error('QuotaExceededError');
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      let loginResult;
      await act(async () => {
        loginResult = await result.current.login({
          username: 'admin',
          password: 'admin123',
        });
      });

      // Login should still succeed even if localStorage fails
      expect(loginResult.success).toBe(true);
      expect(result.current.user).not.toBeNull();
      expect(result.current.isAuthenticated).toBe(true);

      localStorage.setItem = originalSetItem;
      consoleSpy.mockRestore();
    });

    it('handles localStorage.removeItem failure during logout gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.login({
          username: 'admin',
          password: 'admin123',
        });
      });

      const originalRemoveItem = localStorage.removeItem;
      localStorage.removeItem = vi.fn(() => {
        throw new Error('Storage error');
      });

      // Logout should not throw even if localStorage fails
      act(() => {
        result.current.logout();
      });

      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);

      localStorage.removeItem = originalRemoveItem;
      consoleSpy.mockRestore();
    });
  });
});