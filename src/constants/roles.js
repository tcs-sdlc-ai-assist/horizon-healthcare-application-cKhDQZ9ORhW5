/**
 * Role-Based Access Control (RBAC) configuration
 *
 * Defines the permission matrix for all application roles and exports
 * permission check functions used throughout the application.
 *
 * Related stories: SCRUM-7324, SCRUM-7322, SCRUM-7326, SCRUM-7329, SCRUM-7335, SCRUM-7336
 */

export const ROLES = {
  VIEW_ONLY: 'View-Only',
  MANAGER: 'Manager',
  DELIVERY_MANAGER: 'Delivery Manager',
  QE_LEAD: 'QE Lead',
  DEVELOPER: 'Developer',
  ADMIN: 'Admin',
  TEST_LEAD: 'Test Lead',
};

/**
 * Permission matrix mapping each role to its allowed actions.
 * Each key is a role string, and the value is an object of boolean permissions.
 *
 * @type {Record<string, { import: boolean, edit: boolean, export: boolean, configure: boolean, viewAudit: boolean }>}
 */
const PERMISSION_MATRIX = {
  [ROLES.VIEW_ONLY]: {
    import: false,
    edit: false,
    export: false,
    configure: false,
    viewAudit: false,
  },
  [ROLES.MANAGER]: {
    import: false,
    edit: false,
    export: true,
    configure: false,
    viewAudit: true,
  },
  [ROLES.DELIVERY_MANAGER]: {
    import: false,
    edit: false,
    export: true,
    configure: false,
    viewAudit: true,
  },
  [ROLES.QE_LEAD]: {
    import: true,
    edit: true,
    export: true,
    configure: false,
    viewAudit: true,
  },
  [ROLES.DEVELOPER]: {
    import: false,
    edit: true,
    export: true,
    configure: false,
    viewAudit: false,
  },
  [ROLES.ADMIN]: {
    import: true,
    edit: true,
    export: true,
    configure: true,
    viewAudit: true,
  },
  [ROLES.TEST_LEAD]: {
    import: true,
    edit: true,
    export: true,
    configure: false,
    viewAudit: true,
  },
};

/**
 * Retrieves the permissions object for a given role.
 * Returns an object with all permissions set to false if the role is not recognized.
 *
 * @param {string} role - The role to look up.
 * @returns {{ import: boolean, edit: boolean, export: boolean, configure: boolean, viewAudit: boolean }}
 */
function getPermissions(role) {
  return PERMISSION_MATRIX[role] || {
    import: false,
    edit: false,
    export: false,
    configure: false,
    viewAudit: false,
  };
}

/**
 * Checks if the given role has permission to import data.
 * @param {string} role
 * @returns {boolean}
 */
export function canImport(role) {
  return getPermissions(role).import;
}

/**
 * Checks if the given role has permission to edit data.
 * @param {string} role
 * @returns {boolean}
 */
export function canEdit(role) {
  return getPermissions(role).edit;
}

/**
 * Checks if the given role has permission to export data.
 * @param {string} role
 * @returns {boolean}
 */
export function canExport(role) {
  return getPermissions(role).export;
}

/**
 * Checks if the given role has permission to configure application settings.
 * @param {string} role
 * @returns {boolean}
 */
export function canConfigure(role) {
  return getPermissions(role).configure;
}

/**
 * Checks if the given role has permission to view audit logs.
 * @param {string} role
 * @returns {boolean}
 */
export function canViewAudit(role) {
  return getPermissions(role).viewAudit;
}

/**
 * Returns the full permission matrix. Useful for debugging or admin UIs.
 * @returns {Record<string, { import: boolean, edit: boolean, export: boolean, configure: boolean, viewAudit: boolean }>}
 */
export function getPermissionMatrix() {
  return { ...PERMISSION_MATRIX };
}