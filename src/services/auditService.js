/**
 * Audit Trail Service
 *
 * Logs all data mutations (field edits, CSV imports, config changes) with
 * user ID, timestamp, action type, field name, old value, new value, and
 * SHA-256 hash chain for tamper evidence.
 *
 * Persists audit logs to localStorage under HORIZON_AUDIT_TRAIL key.
 *
 * Related stories: SCRUM-7322, SCRUM-7327, SCRUM-7336
 * @module auditService
 */

import { LOCAL_STORAGE_KEYS, AUDIT_ACTIONS } from '../constants/constants.js';
import { generateHash, verifyChain } from '../utils/hashUtils.js';

/**
 * @typedef {Object} AuditEntry
 * @property {string} id - Unique audit entry identifier
 * @property {string} action - The action type (CREATE, UPDATE, DELETE, IMPORT, EXPORT, CONFIG_CHANGE, LOGIN, LOGOUT)
 * @property {string} user - The user who performed the action
 * @property {string} timestamp - ISO 8601 timestamp
 * @property {string} fieldName - The field that was modified (empty string if not applicable)
 * @property {*} oldValue - The previous value before the change
 * @property {*} newValue - The new value after the change
 * @property {string} entityType - The type of entity modified (e.g., 'record', 'config', 'csv')
 * @property {string} entityId - The ID of the entity modified
 * @property {string} description - Human-readable description of the change
 * @property {string} previousHash - Hash of the previous audit entry in the chain
 * @property {string} hash - SHA-256 hash of this entry for tamper evidence
 * @property {boolean} reverted - Whether this entry has been reverted
 * @property {string|null} revertedBy - The audit entry ID that reverted this entry
 */

/**
 * @typedef {Object} AuditFilter
 * @property {string} [user] - Filter by user
 * @property {string} [action] - Filter by action type
 * @property {string} [fieldName] - Filter by field name
 * @property {string} [entityType] - Filter by entity type
 * @property {string} [entityId] - Filter by entity ID
 * @property {string} [startDate] - Filter entries on or after this ISO date
 * @property {string} [endDate] - Filter entries on or before this ISO date
 * @property {boolean} [includeReverted] - Whether to include reverted entries (default: true)
 */

/**
 * Generates a unique ID for an audit entry.
 * @returns {string} A unique identifier string
 */
function generateAuditId() {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 10);
  return `AUD-${timestamp}-${randomPart}`;
}

/**
 * Reads the audit trail from localStorage.
 * @returns {AuditEntry[]} Array of audit entries
 */
function readAuditTrail() {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEYS.HORIZON_AUDIT_TRAIL);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed;
  } catch (error) {
    console.error('Failed to read audit trail from localStorage:', error);
    return [];
  }
}

/**
 * Writes the audit trail to localStorage.
 * @param {AuditEntry[]} entries - The audit entries to persist
 */
function writeAuditTrail(entries) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEYS.HORIZON_AUDIT_TRAIL, JSON.stringify(entries));
  } catch (error) {
    console.error('Failed to write audit trail to localStorage:', error);
    throw new Error(`Failed to persist audit trail: ${error.message}`);
  }
}

/**
 * Retrieves the hash of the last entry in the audit trail.
 * @param {AuditEntry[]} entries - The current audit entries
 * @returns {string} The hash of the last entry, or empty string if no entries exist
 */
function getLastHash(entries) {
  if (entries.length === 0) {
    return '';
  }
  return entries[entries.length - 1].hash || '';
}

/**
 * Builds the hashable payload for an audit entry, matching the structure
 * expected by the hash chain verification.
 * @param {Object} entryData - The audit entry data to hash
 * @returns {Object} The payload object to be hashed
 */
function buildHashPayload(entryData) {
  return {
    action: entryData.action,
    data: {
      id: entryData.id,
      fieldName: entryData.fieldName,
      oldValue: entryData.oldValue,
      newValue: entryData.newValue,
      entityType: entryData.entityType,
      entityId: entryData.entityId,
      description: entryData.description,
    },
    user: entryData.user,
    timestamp: entryData.timestamp,
  };
}

/**
 * Logs a data mutation (field edit) to the audit trail.
 *
 * @param {Object} params - The edit parameters
 * @param {string} params.user - The user performing the edit
 * @param {string} params.action - The action type (use AUDIT_ACTIONS constants)
 * @param {string} [params.fieldName=''] - The field being modified
 * @param {*} [params.oldValue=null] - The previous value
 * @param {*} [params.newValue=null] - The new value
 * @param {string} [params.entityType=''] - The type of entity being modified
 * @param {string} [params.entityId=''] - The ID of the entity being modified
 * @param {string} [params.description=''] - Human-readable description
 * @returns {Promise<AuditEntry>} The created audit entry
 */
export async function logEdit({
  user,
  action,
  fieldName = '',
  oldValue = null,
  newValue = null,
  entityType = '',
  entityId = '',
  description = '',
}) {
  if (!user || typeof user !== 'string') {
    throw new Error('User must be a non-empty string.');
  }

  if (!action || typeof action !== 'string') {
    throw new Error('Action must be a non-empty string.');
  }

  const entries = readAuditTrail();
  const previousHash = getLastHash(entries);
  const timestamp = new Date().toISOString();
  const id = generateAuditId();

  const entryData = {
    id,
    action,
    user,
    timestamp,
    fieldName,
    oldValue,
    newValue,
    entityType,
    entityId,
    description: description || buildDefaultDescription(action, fieldName, entityType, entityId),
    reverted: false,
    revertedBy: null,
  };

  const hashPayload = buildHashPayload(entryData);
  const hash = await generateHash(hashPayload, previousHash);

  /** @type {AuditEntry} */
  const auditEntry = {
    ...entryData,
    previousHash,
    hash,
  };

  entries.push(auditEntry);
  writeAuditTrail(entries);

  return auditEntry;
}

/**
 * Builds a default description string for an audit entry.
 * @param {string} action - The action type
 * @param {string} fieldName - The field name
 * @param {string} entityType - The entity type
 * @param {string} entityId - The entity ID
 * @returns {string} A human-readable description
 */
function buildDefaultDescription(action, fieldName, entityType, entityId) {
  const entityRef = entityType && entityId ? ` on ${entityType} ${entityId}` : '';
  const fieldRef = fieldName ? ` field "${fieldName}"` : '';

  switch (action) {
    case AUDIT_ACTIONS.CREATE:
      return `Created${fieldRef}${entityRef}`;
    case AUDIT_ACTIONS.UPDATE:
      return `Updated${fieldRef}${entityRef}`;
    case AUDIT_ACTIONS.DELETE:
      return `Deleted${fieldRef}${entityRef}`;
    case AUDIT_ACTIONS.IMPORT:
      return `Imported data${entityRef}`;
    case AUDIT_ACTIONS.EXPORT:
      return `Exported data${entityRef}`;
    case AUDIT_ACTIONS.CONFIG_CHANGE:
      return `Configuration changed${fieldRef}${entityRef}`;
    case AUDIT_ACTIONS.LOGIN:
      return 'User logged in';
    case AUDIT_ACTIONS.LOGOUT:
      return 'User logged out';
    default:
      return `${action}${fieldRef}${entityRef}`;
  }
}

/**
 * Retrieves audit trail entries with optional filtering.
 *
 * @param {AuditFilter} [filters={}] - Optional filters to apply
 * @returns {AuditEntry[]} Filtered array of audit entries, sorted newest first
 */
export function getAuditTrail(filters = {}) {
  let entries = readAuditTrail();

  if (filters.user) {
    const userFilter = filters.user.toLowerCase();
    entries = entries.filter(
      (entry) => entry.user && entry.user.toLowerCase().includes(userFilter)
    );
  }

  if (filters.action) {
    entries = entries.filter((entry) => entry.action === filters.action);
  }

  if (filters.fieldName) {
    const fieldFilter = filters.fieldName.toLowerCase();
    entries = entries.filter(
      (entry) => entry.fieldName && entry.fieldName.toLowerCase().includes(fieldFilter)
    );
  }

  if (filters.entityType) {
    entries = entries.filter((entry) => entry.entityType === filters.entityType);
  }

  if (filters.entityId) {
    entries = entries.filter((entry) => entry.entityId === filters.entityId);
  }

  if (filters.startDate) {
    const startDate = new Date(filters.startDate);
    if (!isNaN(startDate.getTime())) {
      entries = entries.filter((entry) => new Date(entry.timestamp) >= startDate);
    }
  }

  if (filters.endDate) {
    const endDate = new Date(filters.endDate);
    if (!isNaN(endDate.getTime())) {
      // Set end date to end of day for inclusive filtering
      endDate.setHours(23, 59, 59, 999);
      entries = entries.filter((entry) => new Date(entry.timestamp) <= endDate);
    }
  }

  if (filters.includeReverted === false) {
    entries = entries.filter((entry) => !entry.reverted);
  }

  // Return newest first
  return [...entries].reverse();
}

/**
 * Reverts a specific audit entry by its ID. Creates a new audit entry
 * that records the revert action and restores the old value.
 *
 * @param {string} auditId - The ID of the audit entry to revert
 * @param {string} user - The user performing the revert
 * @returns {Promise<{ revertEntry: AuditEntry, originalEntry: AuditEntry }>}
 *   Object containing the new revert audit entry and the original entry that was reverted
 */
export async function revertEdit(auditId, user) {
  if (!auditId || typeof auditId !== 'string') {
    throw new Error('Audit ID must be a non-empty string.');
  }

  if (!user || typeof user !== 'string') {
    throw new Error('User must be a non-empty string.');
  }

  const entries = readAuditTrail();
  const entryIndex = entries.findIndex((entry) => entry.id === auditId);

  if (entryIndex === -1) {
    throw new Error(`Audit entry with ID "${auditId}" not found.`);
  }

  const originalEntry = entries[entryIndex];

  if (originalEntry.reverted) {
    throw new Error(`Audit entry "${auditId}" has already been reverted.`);
  }

  // Mark the original entry as reverted
  entries[entryIndex] = {
    ...originalEntry,
    reverted: true,
  };

  // Create a new revert audit entry
  const previousHash = getLastHash(entries);
  const timestamp = new Date().toISOString();
  const revertId = generateAuditId();

  const revertEntryData = {
    id: revertId,
    action: AUDIT_ACTIONS.UPDATE,
    user,
    timestamp,
    fieldName: originalEntry.fieldName,
    oldValue: originalEntry.newValue,
    newValue: originalEntry.oldValue,
    entityType: originalEntry.entityType,
    entityId: originalEntry.entityId,
    description: `Reverted: ${originalEntry.description || 'previous change'} (original audit ID: ${auditId})`,
    reverted: false,
    revertedBy: null,
  };

  const hashPayload = buildHashPayload(revertEntryData);
  const hash = await generateHash(hashPayload, previousHash);

  /** @type {AuditEntry} */
  const revertEntry = {
    ...revertEntryData,
    previousHash,
    hash,
  };

  // Update the original entry to reference the revert entry
  entries[entryIndex] = {
    ...entries[entryIndex],
    revertedBy: revertId,
  };

  entries.push(revertEntry);
  writeAuditTrail(entries);

  return {
    revertEntry,
    originalEntry: entries[entryIndex],
  };
}

/**
 * Exports the audit log as a JSON string, optionally filtered.
 *
 * @param {AuditFilter} [filters={}] - Optional filters to apply before export
 * @returns {{ data: string, filename: string, entryCount: number, exportedAt: string }}
 *   Object containing the JSON string, suggested filename, entry count, and export timestamp
 */
export function exportAuditLog(filters = {}) {
  const entries = getAuditTrail(filters);
  const exportedAt = new Date().toISOString();
  const dateStr = exportedAt.split('T')[0];

  const exportPayload = {
    exportedAt,
    entryCount: entries.length,
    filters: Object.keys(filters).length > 0 ? filters : null,
    entries,
  };

  const data = JSON.stringify(exportPayload, null, 2);
  const filename = `horizon_audit_trail_${dateStr}.json`;

  return {
    data,
    filename,
    entryCount: entries.length,
    exportedAt,
  };
}

/**
 * Verifies the integrity of the entire audit trail hash chain.
 *
 * @returns {Promise<{ valid: boolean, brokenAt: number|null, message: string, totalEntries: number }>}
 *   Verification result including total entry count
 */
export async function verifyAuditTrailIntegrity() {
  const entries = readAuditTrail();

  if (entries.length === 0) {
    return {
      valid: true,
      brokenAt: null,
      message: 'Audit trail is empty. No entries to verify.',
      totalEntries: 0,
    };
  }

  // Transform entries to the format expected by verifyChain
  const chainEntries = entries.map((entry) => ({
    hash: entry.hash,
    previousHash: entry.previousHash,
    action: entry.action,
    user: entry.user,
    timestamp: entry.timestamp,
    data: {
      id: entry.id,
      fieldName: entry.fieldName,
      oldValue: entry.oldValue,
      newValue: entry.newValue,
      entityType: entry.entityType,
      entityId: entry.entityId,
      description: entry.description,
    },
  }));

  const result = await verifyChain(chainEntries);

  return {
    ...result,
    totalEntries: entries.length,
  };
}

/**
 * Clears the entire audit trail from localStorage.
 * This action is irreversible and should only be used by admins.
 *
 * @param {string} user - The user performing the clear action
 * @returns {Promise<AuditEntry>} The audit entry logging the clear action
 */
export async function clearAuditTrail(user) {
  if (!user || typeof user !== 'string') {
    throw new Error('User must be a non-empty string.');
  }

  const entries = readAuditTrail();
  const entryCount = entries.length;

  // Clear all entries
  writeAuditTrail([]);

  // Log the clear action as the first entry in the new chain
  const clearEntry = await logEdit({
    user,
    action: AUDIT_ACTIONS.DELETE,
    entityType: 'audit_trail',
    description: `Cleared audit trail (${entryCount} entries removed)`,
  });

  return clearEntry;
}

/**
 * Gets a single audit entry by its ID.
 *
 * @param {string} auditId - The ID of the audit entry to retrieve
 * @returns {AuditEntry|null} The audit entry, or null if not found
 */
export function getAuditEntryById(auditId) {
  if (!auditId || typeof auditId !== 'string') {
    return null;
  }

  const entries = readAuditTrail();
  return entries.find((entry) => entry.id === auditId) || null;
}

/**
 * Gets the total count of audit entries, optionally filtered.
 *
 * @param {AuditFilter} [filters={}] - Optional filters to apply
 * @returns {number} The count of matching audit entries
 */
export function getAuditTrailCount(filters = {}) {
  const entries = getAuditTrail(filters);
  return entries.length;
}