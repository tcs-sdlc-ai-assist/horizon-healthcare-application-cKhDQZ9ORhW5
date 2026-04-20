import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useAuditLog } from '@/hooks/useAuditLog';
import { useRoleGuard } from '@/hooks/useRoleGuard';
import { StatusBadge } from '@/components/common/StatusBadge';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { AUDIT_ACTIONS } from '@/constants/constants';
import { formatDate, truncateText } from '@/utils/formatUtils';

/**
 * @typedef {'timestamp'|'user'|'action'|'fieldName'|'entityType'|'entityId'} SortField
 */

/**
 * @typedef {'asc'|'desc'} SortDirection
 */

/**
 * Maps audit action constants to human-readable labels.
 * @param {string} action - The audit action constant
 * @returns {string} Human-readable label
 */
function formatActionLabel(action) {
  const labels = {
    [AUDIT_ACTIONS.CREATE]: 'Create',
    [AUDIT_ACTIONS.UPDATE]: 'Update',
    [AUDIT_ACTIONS.DELETE]: 'Delete',
    [AUDIT_ACTIONS.LOGIN]: 'Login',
    [AUDIT_ACTIONS.LOGOUT]: 'Logout',
    [AUDIT_ACTIONS.EXPORT]: 'Export',
    [AUDIT_ACTIONS.IMPORT]: 'Import',
    [AUDIT_ACTIONS.CONFIG_CHANGE]: 'Config Change',
  };
  return labels[action] || action || 'Unknown';
}

/**
 * Maps audit action constants to status badge status strings.
 * @param {string} action - The audit action constant
 * @returns {string} Status string for StatusBadge
 */
function getActionBadgeStatus(action) {
  switch (action) {
    case AUDIT_ACTIONS.CREATE:
      return 'success';
    case AUDIT_ACTIONS.UPDATE:
      return 'warning';
    case AUDIT_ACTIONS.DELETE:
      return 'critical';
    case AUDIT_ACTIONS.IMPORT:
      return 'pending';
    case AUDIT_ACTIONS.EXPORT:
      return 'healthy';
    case AUDIT_ACTIONS.CONFIG_CHANGE:
      return 'degraded';
    case AUDIT_ACTIONS.LOGIN:
    case AUDIT_ACTIONS.LOGOUT:
      return 'success';
    default:
      return 'warning';
  }
}

/**
 * Formats a value for display in the audit log table.
 * Handles objects, arrays, null, undefined, and primitives.
 * @param {*} value - The value to format
 * @returns {string} Formatted display string
 */
function formatAuditValue(value) {
  if (value === null || value === undefined) {
    return '—';
  }
  if (typeof value === 'object') {
    try {
      return truncateText(JSON.stringify(value), 60);
    } catch {
      return String(value);
    }
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  return truncateText(String(value), 60);
}

/**
 * Integrity status indicator component.
 * @param {Object} props
 * @param {'valid'|'invalid'|'checking'|'idle'} props.status - Current integrity status
 * @param {string} [props.message] - Status message
 * @returns {JSX.Element}
 */
function IntegrityIndicator({ status, message }) {
  const config = {
    valid: {
      icon: (
        <svg className="h-4 w-4 text-green-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
        </svg>
      ),
      text: 'Chain Verified',
      className: 'text-green-700 bg-green-50 border-green-200 dark:text-green-400 dark:bg-green-900/20 dark:border-green-800',
    },
    invalid: {
      icon: (
        <svg className="h-4 w-4 text-red-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0-10.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285ZM12 15.75h.007v.008H12v-.008Z" />
        </svg>
      ),
      text: 'Chain Broken',
      className: 'text-red-700 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-900/20 dark:border-red-800',
    },
    checking: {
      icon: (
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-300 border-t-blue-600" />
      ),
      text: 'Verifying…',
      className: 'text-blue-700 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-900/20 dark:border-blue-800',
    },
    idle: {
      icon: (
        <svg className="h-4 w-4 text-slate-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
        </svg>
      ),
      text: 'Not Verified',
      className: 'text-slate-600 bg-slate-50 border-slate-200 dark:text-slate-400 dark:bg-slate-800 dark:border-slate-700',
    },
  };

  const current = config[status] || config.idle;

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${current.className}`}
      title={message || current.text}
    >
      {current.icon}
      <span>{current.text}</span>
    </div>
  );
}

IntegrityIndicator.propTypes = {
  status: PropTypes.oneOf(['valid', 'invalid', 'checking', 'idle']).isRequired,
  message: PropTypes.string,
};

IntegrityIndicator.defaultProps = {
  message: '',
};

/**
 * Sort header button component for table columns.
 * @param {Object} props
 * @param {string} props.label - Column header label
 * @param {string} props.field - Sort field key
 * @param {string} props.currentSortField - Currently active sort field
 * @param {string} props.currentSortDirection - Current sort direction
 * @param {Function} props.onSort - Sort handler
 * @returns {JSX.Element}
 */
function SortHeader({ label, field, currentSortField, currentSortDirection, onSort }) {
  const isActive = currentSortField === field;

  const handleClick = useCallback(() => {
    onSort(field);
  }, [field, onSort]);

  return (
    <button
      type="button"
      onClick={handleClick}
      className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-slate-500 transition-colors hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
    >
      {label}
      <span className="flex flex-col">
        <svg
          className={`h-2.5 w-2.5 ${isActive && currentSortDirection === 'asc' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-300 dark:text-slate-600'}`}
          viewBox="0 0 10 6"
          fill="currentColor"
        >
          <path d="M5 0L10 6H0L5 0Z" />
        </svg>
        <svg
          className={`h-2.5 w-2.5 ${isActive && currentSortDirection === 'desc' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-300 dark:text-slate-600'}`}
          viewBox="0 0 10 6"
          fill="currentColor"
        >
          <path d="M5 6L0 0H10L5 6Z" />
        </svg>
      </span>
    </button>
  );
}

SortHeader.propTypes = {
  label: PropTypes.string.isRequired,
  field: PropTypes.string.isRequired,
  currentSortField: PropTypes.string.isRequired,
  currentSortDirection: PropTypes.string.isRequired,
  onSort: PropTypes.func.isRequired,
};

/**
 * Expanded detail row for an audit entry.
 * @param {Object} props
 * @param {Object} props.entry - The audit entry
 * @returns {JSX.Element}
 */
function AuditEntryDetail({ entry }) {
  return (
    <div className="animate-fade-in rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <p className="text-2xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Audit ID
          </p>
          <p className="mt-0.5 font-mono text-xs text-slate-800 dark:text-slate-200">
            {entry.id}
          </p>
        </div>
        <div>
          <p className="text-2xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Description
          </p>
          <p className="mt-0.5 text-xs text-slate-800 dark:text-slate-200">
            {entry.description || '—'}
          </p>
        </div>
        <div>
          <p className="text-2xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Entity
          </p>
          <p className="mt-0.5 text-xs text-slate-800 dark:text-slate-200">
            {entry.entityType ? `${entry.entityType}${entry.entityId ? ` / ${entry.entityId}` : ''}` : '—'}
          </p>
        </div>
        <div>
          <p className="text-2xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Old Value
          </p>
          <p className="mt-0.5 font-mono text-xs text-slate-800 dark:text-slate-200">
            {formatAuditValue(entry.oldValue)}
          </p>
        </div>
        <div>
          <p className="text-2xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            New Value
          </p>
          <p className="mt-0.5 font-mono text-xs text-slate-800 dark:text-slate-200">
            {formatAuditValue(entry.newValue)}
          </p>
        </div>
        <div>
          <p className="text-2xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Hash
          </p>
          <p className="mt-0.5 font-mono text-2xs text-slate-500 dark:text-slate-400 break-all">
            {truncateText(entry.hash || '', 40)}
          </p>
        </div>
        {entry.reverted && (
          <div className="sm:col-span-2 lg:col-span-3">
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
              <svg className="h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" />
              </svg>
              Reverted{entry.revertedBy ? ` by ${entry.revertedBy}` : ''}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

AuditEntryDetail.propTypes = {
  entry: PropTypes.object.isRequired,
};

/**
 * AuditLogPanel — Slide-out panel component displaying the audit trail log.
 *
 * Shows a sortable, filterable table of audit entries (timestamp, user, action,
 * field, old value, new value, hash). Includes revert button per entry (RBAC-gated),
 * export audit log button, and integrity verification status indicator.
 *
 * Uses useAuditLog hook for data operations and useRoleGuard for RBAC enforcement.
 *
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether the panel is visible
 * @param {Function} props.onClose - Callback to close the panel
 * @param {string} [props.className] - Additional CSS classes
 * @returns {JSX.Element}
 */
export function AuditLogPanel({ isOpen, onClose, className }) {
  const {
    auditLogs,
    loading,
    error,
    totalCount,
    revert,
    exportLog,
    verifyIntegrity,
    refresh,
    setFilters,
    filters,
  } = useAuditLog();

  const { canEdit, canExport, canViewAudit, isAdmin } = useRoleGuard();

  const [sortField, setSortField] = useState('timestamp');
  const [sortDirection, setSortDirection] = useState('desc');
  const [expandedEntryId, setExpandedEntryId] = useState(null);
  const [revertingId, setRevertingId] = useState(null);
  const [revertError, setRevertError] = useState(null);
  const [integrityStatus, setIntegrityStatus] = useState('idle');
  const [integrityMessage, setIntegrityMessage] = useState('');
  const [filterUser, setFilterUser] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [showReverted, setShowReverted] = useState(true);

  const panelRef = useRef(null);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Reset state when panel opens
  useEffect(() => {
    if (isOpen) {
      setRevertError(null);
      setRevertingId(null);
      refresh();
    }
  }, [isOpen, refresh]);

  // Apply filters when filter inputs change
  useEffect(() => {
    const newFilters = {};
    if (filterUser) {
      newFilters.user = filterUser;
    }
    if (filterAction) {
      newFilters.action = filterAction;
    }
    if (!showReverted) {
      newFilters.includeReverted = false;
    }
    setFilters(newFilters);
  }, [filterUser, filterAction, showReverted, setFilters]);

  /**
   * Handles sort column click. Toggles direction if same column, otherwise sets new column.
   * @param {string} field - The field to sort by
   */
  const handleSort = useCallback(
    (field) => {
      if (sortField === field) {
        setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortField(field);
        setSortDirection('desc');
      }
    },
    [sortField]
  );

  /**
   * Toggles the expanded detail view for an audit entry.
   * @param {string} entryId - The audit entry ID
   */
  const handleToggleExpand = useCallback(
    (entryId) => {
      setExpandedEntryId((prev) => (prev === entryId ? null : entryId));
    },
    []
  );

  /**
   * Handles reverting an audit entry.
   * @param {string} entryId - The audit entry ID to revert
   */
  const handleRevert = useCallback(
    async (entryId) => {
      if (!entryId) return;

      setRevertingId(entryId);
      setRevertError(null);

      const result = await revert(entryId);

      if (!result) {
        setRevertError(`Failed to revert entry ${entryId}.`);
      }

      setRevertingId(null);
    },
    [revert]
  );

  /**
   * Handles exporting the audit log.
   */
  const handleExport = useCallback(() => {
    exportLog();
  }, [exportLog]);

  /**
   * Handles verifying audit trail integrity.
   */
  const handleVerifyIntegrity = useCallback(async () => {
    setIntegrityStatus('checking');
    setIntegrityMessage('');

    const result = await verifyIntegrity();

    if (result) {
      setIntegrityStatus(result.valid ? 'valid' : 'invalid');
      setIntegrityMessage(result.message || '');
    } else {
      setIntegrityStatus('invalid');
      setIntegrityMessage('Verification failed.');
    }
  }, [verifyIntegrity]);

  /**
   * Handles clearing the user filter.
   */
  const handleClearFilters = useCallback(() => {
    setFilterUser('');
    setFilterAction('');
    setShowReverted(true);
  }, []);

  /**
   * Sorted audit logs based on current sort field and direction.
   */
  const sortedLogs = useMemo(() => {
    if (!auditLogs || auditLogs.length === 0) return [];

    const sorted = [...auditLogs];

    sorted.sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      if (sortField === 'timestamp') {
        aVal = new Date(aVal || 0).getTime();
        bVal = new Date(bVal || 0).getTime();
      } else {
        aVal = String(aVal || '').toLowerCase();
        bVal = String(bVal || '').toLowerCase();
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [auditLogs, sortField, sortDirection]);

  const hasActiveFilters = filterUser !== '' || filterAction !== '' || !showReverted;

  const actionOptions = useMemo(() => {
    return Object.entries(AUDIT_ACTIONS).map(([key, value]) => ({
      label: formatActionLabel(value),
      value,
    }));
  }, []);

  if (!isOpen) {
    return null;
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-3xl flex-col bg-white shadow-2xl transition-transform duration-300 dark:bg-slate-900 ${className || ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Audit Log Panel"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <svg
              className="h-5 w-5 text-slate-600 dark:text-slate-400"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
              />
            </svg>
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Audit Trail
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {totalCount} {totalCount === 1 ? 'entry' : 'entries'} total
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <IntegrityIndicator status={integrityStatus} message={integrityMessage} />
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
              aria-label="Close audit log panel"
            >
              <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-6 py-3 dark:border-slate-700">
          {/* User filter */}
          <div className="flex-1 min-w-[140px]">
            <input
              type="text"
              value={filterUser}
              onChange={(e) => setFilterUser(e.target.value)}
              placeholder="Filter by user…"
              className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:placeholder:text-slate-500"
              aria-label="Filter by user"
            />
          </div>

          {/* Action filter */}
          <div className="min-w-[130px]">
            <select
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
              aria-label="Filter by action"
            >
              <option value="">All Actions</option>
              {actionOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Show reverted toggle */}
          <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
            <input
              type="checkbox"
              checked={showReverted}
              onChange={(e) => setShowReverted(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-600"
            />
            Show reverted
          </label>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="rounded px-2 py-1 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20"
            >
              Clear filters
            </button>
          )}

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={handleVerifyIntegrity}
              disabled={loading}
              className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              title="Verify hash chain integrity"
            >
              <svg className="h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
              </svg>
              Verify
            </button>

            {canExport && (
              <button
                type="button"
                onClick={handleExport}
                disabled={loading || sortedLogs.length === 0}
                className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-2.5 py-1.5 text-xs font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                title="Export audit log as JSON"
              >
                <svg className="h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                Export
              </button>
            )}

            <button
              type="button"
              onClick={refresh}
              disabled={loading}
              className="rounded-md border border-slate-300 p-1.5 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-300"
              title="Refresh audit log"
              aria-label="Refresh audit log"
            >
              <svg className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
              </svg>
            </button>
          </div>
        </div>

        {/* Error display */}
        {(error || revertError) && (
          <div className="mx-6 mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 dark:border-red-800 dark:bg-red-900/20" role="alert">
            <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <p className="text-sm text-red-700 dark:text-red-300">
              {error || revertError}
            </p>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-auto px-6 py-4 scrollbar-thin">
          {loading && sortedLogs.length === 0 ? (
            <div className="flex items-center justify-center py-16">
              <LoadingSpinner message="Loading audit trail…" size="md" />
            </div>
          ) : sortedLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <svg
                className="mb-3 h-10 w-10 text-slate-300 dark:text-slate-600"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
                />
              </svg>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {hasActiveFilters
                  ? 'No audit entries match the current filters.'
                  : 'No audit entries recorded yet.'}
              </p>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="mt-2 text-xs font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    <th className="pb-2 pr-3 text-left">
                      <SortHeader
                        label="Timestamp"
                        field="timestamp"
                        currentSortField={sortField}
                        currentSortDirection={sortDirection}
                        onSort={handleSort}
                      />
                    </th>
                    <th className="pb-2 pr-3 text-left">
                      <SortHeader
                        label="User"
                        field="user"
                        currentSortField={sortField}
                        currentSortDirection={sortDirection}
                        onSort={handleSort}
                      />
                    </th>
                    <th className="pb-2 pr-3 text-left">
                      <SortHeader
                        label="Action"
                        field="action"
                        currentSortField={sortField}
                        currentSortDirection={sortDirection}
                        onSort={handleSort}
                      />
                    </th>
                    <th className="pb-2 pr-3 text-left">
                      <SortHeader
                        label="Field"
                        field="fieldName"
                        currentSortField={sortField}
                        currentSortDirection={sortDirection}
                        onSort={handleSort}
                      />
                    </th>
                    <th className="pb-2 pr-3 text-left">
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Old → New
                      </span>
                    </th>
                    <th className="pb-2 text-right">
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Actions
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedLogs.map((entry) => {
                    const isExpanded = expandedEntryId === entry.id;
                    const isReverting = revertingId === entry.id;
                    const canRevertEntry =
                      (canEdit || isAdmin) &&
                      !entry.reverted &&
                      entry.action === AUDIT_ACTIONS.UPDATE;

                    return (
                      <tr key={entry.id} className="group">
                        <td colSpan={6} className="py-0">
                          <div
                            className={`rounded-lg border transition-colors ${
                              isExpanded
                                ? 'border-blue-200 bg-blue-50/30 dark:border-blue-800 dark:bg-blue-900/10'
                                : 'border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50'
                            } ${entry.reverted ? 'opacity-60' : ''} mb-1 mt-1`}
                          >
                            {/* Main row */}
                            <div
                              className="flex cursor-pointer items-center gap-3 px-3 py-2.5"
                              onClick={() => handleToggleExpand(entry.id)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  handleToggleExpand(entry.id);
                                }
                              }}
                              tabIndex={0}
                              role="button"
                              aria-expanded={isExpanded}
                              aria-label={`Audit entry: ${formatActionLabel(entry.action)} by ${entry.user}`}
                            >
                              {/* Expand indicator */}
                              <svg
                                className={`h-3.5 w-3.5 flex-shrink-0 text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                                strokeWidth={2}
                                stroke="currentColor"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                              </svg>

                              {/* Timestamp */}
                              <div className="w-[130px] flex-shrink-0">
                                <p className="text-xs text-slate-800 dark:text-slate-200">
                                  {formatDate(entry.timestamp, {
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric',
                                  })}
                                </p>
                                <p className="text-2xs text-slate-400 dark:text-slate-500">
                                  {entry.timestamp
                                    ? new Date(entry.timestamp).toLocaleTimeString('en-US', {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                        second: '2-digit',
                                      })
                                    : ''}
                                </p>
                              </div>

                              {/* User */}
                              <div className="w-[100px] flex-shrink-0">
                                <p className="truncate text-xs font-medium text-slate-700 dark:text-slate-300">
                                  {entry.user || '—'}
                                </p>
                              </div>

                              {/* Action */}
                              <div className="w-[90px] flex-shrink-0">
                                <StatusBadge
                                  status={getActionBadgeStatus(entry.action)}
                                  label={formatActionLabel(entry.action)}
                                  size="sm"
                                  showIcon={false}
                                  showDot
                                />
                              </div>

                              {/* Field */}
                              <div className="w-[100px] flex-shrink-0">
                                <p className="truncate font-mono text-xs text-slate-600 dark:text-slate-400">
                                  {entry.fieldName || '—'}
                                </p>
                              </div>

                              {/* Old → New */}
                              <div className="flex-1 min-w-0">
                                {entry.oldValue !== null || entry.newValue !== null ? (
                                  <div className="flex items-center gap-1 text-xs">
                                    <span className="truncate font-mono text-red-600 dark:text-red-400">
                                      {formatAuditValue(entry.oldValue)}
                                    </span>
                                    <svg className="h-3 w-3 flex-shrink-0 text-slate-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                                    </svg>
                                    <span className="truncate font-mono text-green-600 dark:text-green-400">
                                      {formatAuditValue(entry.newValue)}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-xs text-slate-400">—</span>
                                )}
                              </div>

                              {/* Actions */}
                              <div className="flex flex-shrink-0 items-center gap-1">
                                {canRevertEntry && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRevert(entry.id);
                                    }}
                                    disabled={isReverting || loading}
                                    className="inline-flex items-center gap-1 rounded px-2 py-1 text-2xs font-medium text-amber-700 transition-colors hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-amber-400 dark:hover:bg-amber-900/30"
                                    title="Revert this change"
                                    aria-label={`Revert audit entry ${entry.id}`}
                                  >
                                    {isReverting ? (
                                      <div className="h-3 w-3 animate-spin rounded-full border border-amber-300 border-t-amber-600" />
                                    ) : (
                                      <svg className="h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" />
                                      </svg>
                                    )}
                                    Revert
                                  </button>
                                )}
                                {entry.reverted && (
                                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-2xs font-medium text-slate-500 dark:bg-slate-700 dark:text-slate-400">
                                    Reverted
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Expanded detail */}
                            {isExpanded && (
                              <div className="px-3 pb-3">
                                <AuditEntryDetail entry={entry} />
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 px-6 py-3 dark:border-slate-700">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Showing {sortedLogs.length} of {totalCount} {totalCount === 1 ? 'entry' : 'entries'}
            {hasActiveFilters && ' (filtered)'}
          </p>
          <p className="text-2xs text-slate-400 dark:text-slate-500">
            Audit entries are tamper-evident via SHA-256 hash chain
          </p>
        </div>
      </div>
    </>
  );
}

AuditLogPanel.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  className: PropTypes.string,
};

AuditLogPanel.defaultProps = {
  className: '',
};

export default AuditLogPanel;