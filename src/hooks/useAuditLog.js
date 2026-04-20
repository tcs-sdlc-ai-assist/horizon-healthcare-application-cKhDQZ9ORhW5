import { useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  logEdit,
  getAuditTrail,
  revertEdit,
  exportAuditLog,
  verifyAuditTrailIntegrity,
  getAuditTrailCount,
} from '@/services/auditService';
import { AUDIT_ACTIONS } from '@/constants/constants';

/**
 * @typedef {import('@/services/auditService').AuditEntry} AuditEntry
 * @typedef {import('@/services/auditService').AuditFilter} AuditFilter
 */

/**
 * @typedef {Object} UseAuditLogReturn
 * @property {AuditEntry[]} auditLogs - Array of audit log entries (newest first)
 * @property {boolean} loading - Whether an audit operation is in progress
 * @property {string|null} error - Error message from the last failed operation
 * @property {number} totalCount - Total number of audit entries matching current filters
 * @property {function} logChange - Logs a new audit entry
 * @property {function} revert - Reverts a specific audit entry by ID
 * @property {function} exportLog - Exports the audit log as JSON
 * @property {function} verifyIntegrity - Verifies the hash chain integrity
 * @property {function} refresh - Manually refreshes the audit log list
 * @property {function} setFilters - Updates the active filters and refreshes
 * @property {AuditFilter} filters - The currently active filters
 */

/**
 * Custom React hook for audit log operations.
 * Wraps auditService with React state management and automatic refresh.
 *
 * Provides methods to log changes, revert entries, export logs, and verify
 * hash chain integrity. Automatically refreshes the log list after mutations.
 *
 * @param {AuditFilter} [initialFilters={}] - Optional initial filters for the audit log query
 * @returns {UseAuditLogReturn}
 *
 * @example
 * const { auditLogs, logChange, revert, exportLog, loading, verifyIntegrity } = useAuditLog();
 *
 * // Log a field edit
 * await logChange(AUDIT_ACTIONS.UPDATE, {
 *   fieldName: 'passRate',
 *   oldValue: 85,
 *   newValue: 92,
 *   entityType: 'record',
 *   entityId: 'REC-001',
 * });
 *
 * // Revert an entry
 * await revert('AUD-abc123-xyz');
 */
export function useAuditLog(initialFilters = {}) {
  const { user } = useAuth();
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [totalCount, setTotalCount] = useState(0);
  const [filters, setFiltersState] = useState(initialFilters);
  const mountedRef = useRef(true);

  /**
   * Fetches audit log entries from the audit service with current filters.
   */
  const fetchAuditLogs = useCallback(() => {
    try {
      const entries = getAuditTrail(filters);
      const count = getAuditTrailCount(filters);

      if (mountedRef.current) {
        setAuditLogs(entries);
        setTotalCount(count);
        setError(null);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(`Failed to fetch audit logs: ${err.message || 'Unknown error'}`);
      }
    }
  }, [filters]);

  // Load audit logs on mount and when filters change
  useEffect(() => {
    fetchAuditLogs();
  }, [fetchAuditLogs]);

  // Track mounted state for async operations
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  /**
   * Manually refreshes the audit log list.
   */
  const refresh = useCallback(() => {
    fetchAuditLogs();
  }, [fetchAuditLogs]);

  /**
   * Updates the active filters and triggers a refresh.
   * @param {AuditFilter} newFilters - The new filter configuration
   */
  const setFilters = useCallback((newFilters) => {
    setFiltersState(newFilters || {});
  }, []);

  /**
   * Logs a new audit entry for a data mutation.
   *
   * @param {string} action - The action type (use AUDIT_ACTIONS constants)
   * @param {Object} data - The audit data
   * @param {string} [data.fieldName] - The field being modified
   * @param {*} [data.oldValue] - The previous value
   * @param {*} [data.newValue] - The new value
   * @param {string} [data.entityType] - The type of entity being modified
   * @param {string} [data.entityId] - The ID of the entity being modified
   * @param {string} [data.description] - Human-readable description
   * @returns {Promise<AuditEntry|null>} The created audit entry, or null on failure
   */
  const logChange = useCallback(
    async (action, data = {}) => {
      if (!user) {
        setError('User must be authenticated to log changes.');
        return null;
      }

      if (!action || typeof action !== 'string') {
        setError('Action must be a non-empty string.');
        return null;
      }

      setLoading(true);
      setError(null);

      try {
        const entry = await logEdit({
          user: user.name || user.id,
          action,
          fieldName: data.fieldName || '',
          oldValue: data.oldValue !== undefined ? data.oldValue : null,
          newValue: data.newValue !== undefined ? data.newValue : null,
          entityType: data.entityType || '',
          entityId: data.entityId || '',
          description: data.description || '',
        });

        if (mountedRef.current) {
          fetchAuditLogs();
          setLoading(false);
        }

        return entry;
      } catch (err) {
        if (mountedRef.current) {
          setError(`Failed to log change: ${err.message || 'Unknown error'}`);
          setLoading(false);
        }
        return null;
      }
    },
    [user, fetchAuditLogs]
  );

  /**
   * Reverts a specific audit entry by its ID.
   * Creates a new audit entry that records the revert action.
   *
   * @param {string} auditId - The ID of the audit entry to revert
   * @returns {Promise<{ revertEntry: AuditEntry, originalEntry: AuditEntry }|null>}
   *   The revert result, or null on failure
   */
  const revert = useCallback(
    async (auditId) => {
      if (!user) {
        setError('User must be authenticated to revert changes.');
        return null;
      }

      if (!auditId || typeof auditId !== 'string') {
        setError('Audit ID must be a non-empty string.');
        return null;
      }

      setLoading(true);
      setError(null);

      try {
        const result = await revertEdit(auditId, user.name || user.id);

        if (mountedRef.current) {
          fetchAuditLogs();
          setLoading(false);
        }

        return result;
      } catch (err) {
        if (mountedRef.current) {
          setError(`Failed to revert change: ${err.message || 'Unknown error'}`);
          setLoading(false);
        }
        return null;
      }
    },
    [user, fetchAuditLogs]
  );

  /**
   * Exports the audit log as a JSON file download.
   * Applies current filters to the export.
   *
   * @returns {{ data: string, filename: string, entryCount: number, exportedAt: string }|null}
   *   The export result, or null on failure
   */
  const exportLog = useCallback(() => {
    setError(null);

    try {
      const result = exportAuditLog(filters);

      if (result && result.data) {
        const blob = new Blob([result.data], { type: 'application/json;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = result.filename || 'audit_trail_export.json';
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }

      return result;
    } catch (err) {
      if (mountedRef.current) {
        setError(`Failed to export audit log: ${err.message || 'Unknown error'}`);
      }
      return null;
    }
  }, [filters]);

  /**
   * Verifies the integrity of the entire audit trail hash chain.
   *
   * @returns {Promise<{ valid: boolean, brokenAt: number|null, message: string, totalEntries: number }|null>}
   *   The verification result, or null on failure
   */
  const verifyIntegrity = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await verifyAuditTrailIntegrity();

      if (mountedRef.current) {
        setLoading(false);

        if (!result.valid) {
          setError(result.message);
        }
      }

      return result;
    } catch (err) {
      if (mountedRef.current) {
        setError(`Failed to verify audit trail integrity: ${err.message || 'Unknown error'}`);
        setLoading(false);
      }
      return null;
    }
  }, []);

  return {
    auditLogs,
    loading,
    error,
    totalCount,
    logChange,
    revert,
    exportLog,
    verifyIntegrity,
    refresh,
    setFilters,
    filters,
  };
}

export default useAuditLog;