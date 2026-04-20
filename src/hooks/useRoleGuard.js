import { useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  ROLES,
  canImport as checkCanImport,
  canEdit as checkCanEdit,
  canExport as checkCanExport,
  canConfigure as checkCanConfigure,
  canViewAudit as checkCanViewAudit,
  getPermissionMatrix,
} from '@/constants/roles';

/**
 * Role hierarchy for comparing role levels.
 * Higher index = higher privilege.
 * @type {string[]}
 */
const ROLE_HIERARCHY = [
  ROLES.VIEW_ONLY,
  ROLES.DEVELOPER,
  ROLES.TEST_LEAD,
  ROLES.QE_LEAD,
  ROLES.MANAGER,
  ROLES.DELIVERY_MANAGER,
  ROLES.ADMIN,
];

/**
 * Returns the hierarchy level index for a given role.
 * Returns -1 if the role is not recognized.
 * @param {string} role - The role to look up
 * @returns {number} The hierarchy level index
 */
function getRoleLevel(role) {
  if (!role || typeof role !== 'string') {
    return -1;
  }
  const index = ROLE_HIERARCHY.indexOf(role);
  return index;
}

/**
 * Custom React hook for RBAC enforcement in components.
 * Consumes AuthContext and roles.js to check permissions.
 *
 * @returns {{
 *   hasPermission: (action: string) => boolean,
 *   requireRole: (minRole: string) => boolean,
 *   isAdmin: boolean,
 *   canEdit: boolean,
 *   canImport: boolean,
 *   canExport: boolean,
 *   canConfigure: boolean,
 *   canViewAudit: boolean,
 *   role: string|null,
 *   isAuthenticated: boolean,
 * }}
 */
export function useRoleGuard() {
  const { user, isAuthenticated } = useAuth();

  const role = useMemo(() => {
    if (!user || !user.role) {
      return null;
    }
    return user.role;
  }, [user]);

  const isAdmin = useMemo(() => {
    return role === ROLES.ADMIN;
  }, [role]);

  const canEdit = useMemo(() => {
    if (!role) return false;
    return checkCanEdit(role);
  }, [role]);

  const canImport = useMemo(() => {
    if (!role) return false;
    return checkCanImport(role);
  }, [role]);

  const canExport = useMemo(() => {
    if (!role) return false;
    return checkCanExport(role);
  }, [role]);

  const canConfigure = useMemo(() => {
    if (!role) return false;
    return checkCanConfigure(role);
  }, [role]);

  const canViewAudit = useMemo(() => {
    if (!role) return false;
    return checkCanViewAudit(role);
  }, [role]);

  /**
   * Checks if the current user has permission for a specific action.
   * Supported actions: 'import', 'edit', 'export', 'configure', 'viewAudit'.
   *
   * @param {string} action - The action to check permission for
   * @returns {boolean} Whether the user has permission for the action
   */
  const hasPermission = useMemo(() => {
    return (action) => {
      if (!role || !action || typeof action !== 'string') {
        return false;
      }

      const normalizedAction = action.trim().toLowerCase();

      switch (normalizedAction) {
        case 'import':
          return checkCanImport(role);
        case 'edit':
          return checkCanEdit(role);
        case 'export':
          return checkCanExport(role);
        case 'configure':
          return checkCanConfigure(role);
        case 'viewaudit':
          return checkCanViewAudit(role);
        default: {
          const matrix = getPermissionMatrix();
          const permissions = matrix[role];
          if (!permissions) {
            return false;
          }
          return permissions[action] === true;
        }
      }
    };
  }, [role]);

  /**
   * Checks if the current user's role meets or exceeds the minimum required role
   * based on the role hierarchy.
   *
   * @param {string} minRole - The minimum role required
   * @returns {boolean} Whether the user's role meets or exceeds the minimum
   */
  const requireRole = useMemo(() => {
    return (minRole) => {
      if (!role || !minRole || typeof minRole !== 'string') {
        return false;
      }

      const currentLevel = getRoleLevel(role);
      const requiredLevel = getRoleLevel(minRole);

      if (currentLevel === -1 || requiredLevel === -1) {
        return false;
      }

      return currentLevel >= requiredLevel;
    };
  }, [role]);

  return {
    hasPermission,
    requireRole,
    isAdmin,
    canEdit,
    canImport,
    canExport,
    canConfigure,
    canViewAudit,
    role,
    isAuthenticated,
  };
}

export default useRoleGuard;