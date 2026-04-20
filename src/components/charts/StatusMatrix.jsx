import { useState, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { StatusBadge } from '@/components/common/StatusBadge';

/**
 * Status columns configuration for the matrix.
 * Each column represents a DevSecOps pipeline stage or quality gate.
 * @type {Array<{ key: string, label: string, shortLabel: string, description: string }>}
 */
const STATUS_COLUMNS = [
  {
    key: 'unitTesting',
    label: 'Automated Unit Testing',
    shortLabel: 'Unit Tests',
    description: 'Automated unit test execution status',
  },
  {
    key: 'sonarQubeSCA',
    label: 'SonarQube SCA',
    shortLabel: 'SonarQube',
    description: 'SonarQube static code analysis results',
  },
  {
    key: 'nexusScans',
    label: 'Nexus Scans',
    shortLabel: 'Nexus',
    description: 'Nexus dependency/vulnerability scan results',
  },
  {
    key: 'ocpDeployment',
    label: 'OCP Deployment',
    shortLabel: 'OCP Deploy',
    description: 'OpenShift Container Platform deployment status',
  },
  {
    key: 'sastScan',
    label: 'SAST Scan',
    shortLabel: 'SAST',
    description: 'Static Application Security Testing scan results',
  },
  {
    key: 'dastScan',
    label: 'DAST Scan',
    shortLabel: 'DAST',
    description: 'Dynamic Application Security Testing scan results',
  },
  {
    key: 'automationTestExecution',
    label: 'Automation Test Execution',
    shortLabel: 'Auto Tests',
    description: 'End-to-end automation test execution status',
  },
];

/**
 * Sort direction constants.
 * @readonly
 * @enum {string}
 */
const SORT_DIRECTION = {
  ASC: 'asc',
  DESC: 'desc',
  NONE: 'none',
};

/**
 * Normalizes a status value to a consistent lowercase string for comparison.
 * @param {string|null|undefined} status - The raw status value
 * @returns {string} Normalized status string
 */
function normalizeStatus(status) {
  if (!status || typeof status !== 'string') {
    return 'pending';
  }
  return status.trim().toLowerCase();
}

/**
 * Returns a numeric sort weight for a status value.
 * Critical/failed statuses sort first, then pending, then success.
 * @param {string} status - The normalized status value
 * @returns {number} Sort weight (lower = higher priority)
 */
function getStatusSortWeight(status) {
  const normalized = normalizeStatus(status);
  const weightMap = {
    critical: 0,
    failed: 1,
    failure: 1,
    red: 1,
    degraded: 2,
    warning: 3,
    amber: 3,
    pending: 4,
    healthy: 5,
    success: 5,
    green: 5,
  };
  return weightMap[normalized] !== undefined ? weightMap[normalized] : 4;
}

/**
 * Counts the number of passing statuses for an application row.
 * @param {Object} row - The application data row
 * @returns {number} Count of passing statuses
 */
function countPassingStatuses(row) {
  let count = 0;
  STATUS_COLUMNS.forEach((col) => {
    const normalized = normalizeStatus(row[col.key]);
    if (normalized === 'success' || normalized === 'healthy' || normalized === 'green') {
      count++;
    }
  });
  return count;
}

/**
 * Counts the number of failing statuses for an application row.
 * @param {Object} row - The application data row
 * @returns {number} Count of failing statuses
 */
function countFailingStatuses(row) {
  let count = 0;
  STATUS_COLUMNS.forEach((col) => {
    const normalized = normalizeStatus(row[col.key]);
    if (
      normalized === 'failed' ||
      normalized === 'failure' ||
      normalized === 'critical' ||
      normalized === 'red'
    ) {
      count++;
    }
  });
  return count;
}

/**
 * Computes an overall health status for an application row.
 * @param {Object} row - The application data row
 * @returns {string} Overall status: 'success', 'warning', 'failure', or 'pending'
 */
function computeOverallStatus(row) {
  const failing = countFailingStatuses(row);
  const passing = countPassingStatuses(row);
  const total = STATUS_COLUMNS.length;

  if (failing > 0) {
    return 'failure';
  }
  if (passing === total) {
    return 'success';
  }
  if (passing > 0) {
    return 'warning';
  }
  return 'pending';
}

/**
 * SortIcon component for column header sort indicators.
 * @param {Object} props
 * @param {'asc'|'desc'|'none'} props.direction - Current sort direction
 * @returns {JSX.Element}
 */
function SortIcon({ direction }) {
  return (
    <span className="ml-1 inline-flex flex-col items-center" aria-hidden="true">
      <svg
        className={`h-2.5 w-2.5 ${direction === SORT_DIRECTION.ASC ? 'text-blue-600 dark:text-blue-400' : 'text-slate-300 dark:text-slate-600'}`}
        viewBox="0 0 10 6"
        fill="currentColor"
      >
        <path d="M5 0L10 6H0L5 0Z" />
      </svg>
      <svg
        className={`h-2.5 w-2.5 -mt-0.5 ${direction === SORT_DIRECTION.DESC ? 'text-blue-600 dark:text-blue-400' : 'text-slate-300 dark:text-slate-600'}`}
        viewBox="0 0 10 6"
        fill="currentColor"
      >
        <path d="M5 6L0 0H10L5 6Z" />
      </svg>
    </span>
  );
}

SortIcon.propTypes = {
  direction: PropTypes.oneOf(['asc', 'desc', 'none']).isRequired,
};

/**
 * StatusMatrix — Table/matrix component listing each application and its current
 * status for Automated Unit Testing, SonarQube SCA, Nexus Scans, OCP Deployment,
 * SAST Scan, DAST Scan, and Automation Test Execution.
 *
 * Renders success/failure/pending icons per cell using StatusBadge.
 * Supports sorting by application name or any status column, text filtering,
 * status filtering, and drill-down on rows.
 *
 * @param {Object} props
 * @param {Array<Object>} props.data - Array of application status objects. Each object should have:
 *   - applicationId {string} - Unique application identifier
 *   - applicationName {string} - Display name of the application
 *   - domain {string} - Domain the application belongs to
 *   - unitTesting {string} - Status for Automated Unit Testing
 *   - sonarQubeSCA {string} - Status for SonarQube SCA
 *   - nexusScans {string} - Status for Nexus Scans
 *   - ocpDeployment {string} - Status for OCP Deployment
 *   - sastScan {string} - Status for SAST Scan
 *   - dastScan {string} - Status for DAST Scan
 *   - automationTestExecution {string} - Status for Automation Test Execution
 * @param {string} [props.title] - Optional title displayed above the matrix
 * @param {Function} [props.onRowClick] - Callback when a row is clicked, receives the full row data object
 * @param {Function} [props.onCellClick] - Callback when a status cell is clicked, receives { row, column, status }
 * @param {boolean} [props.showFilter=true] - Whether to show the search/filter controls
 * @param {boolean} [props.showOverallStatus=true] - Whether to show the computed overall status column
 * @param {boolean} [props.showDomain=true] - Whether to show the domain column
 * @param {boolean} [props.compact=false] - Whether to use compact row sizing
 * @param {string} [props.className] - Additional CSS classes for the wrapper
 * @param {string} [props.emptyMessage] - Message to display when no data matches filters
 * @returns {JSX.Element}
 */
export function StatusMatrix({
  data,
  title,
  onRowClick,
  onCellClick,
  showFilter,
  showOverallStatus,
  showDomain,
  compact,
  className,
  emptyMessage,
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortKey, setSortKey] = useState('applicationName');
  const [sortDirection, setSortDirection] = useState(SORT_DIRECTION.ASC);

  /**
   * Handles column header click for sorting.
   * @param {string} key - The column key to sort by
   */
  const handleSort = useCallback(
    (key) => {
      if (sortKey === key) {
        setSortDirection((prev) => {
          if (prev === SORT_DIRECTION.ASC) return SORT_DIRECTION.DESC;
          if (prev === SORT_DIRECTION.DESC) return SORT_DIRECTION.NONE;
          return SORT_DIRECTION.ASC;
        });
      } else {
        setSortKey(key);
        setSortDirection(SORT_DIRECTION.ASC);
      }
    },
    [sortKey]
  );

  /**
   * Handles row click for drill-down.
   * @param {Object} row - The row data
   */
  const handleRowClick = useCallback(
    (row) => {
      if (typeof onRowClick === 'function') {
        onRowClick(row);
      }
    },
    [onRowClick]
  );

  /**
   * Handles individual cell click.
   * @param {Object} row - The row data
   * @param {Object} column - The column configuration
   * @param {Event} event - The click event
   */
  const handleCellClick = useCallback(
    (row, column, event) => {
      event.stopPropagation();
      if (typeof onCellClick === 'function') {
        onCellClick({
          row,
          column: column.key,
          columnLabel: column.label,
          status: row[column.key],
          applicationId: row.applicationId,
          applicationName: row.applicationName,
        });
      }
    },
    [onCellClick]
  );

  /**
   * Handles row keyboard navigation for accessibility.
   * @param {Object} row - The row data
   * @param {KeyboardEvent} event - The keyboard event
   */
  const handleRowKeyDown = useCallback(
    (row, event) => {
      if ((event.key === 'Enter' || event.key === ' ') && typeof onRowClick === 'function') {
        event.preventDefault();
        onRowClick(row);
      }
    },
    [onRowClick]
  );

  /**
   * Handles search input change.
   * @param {Event} event - The input change event
   */
  const handleSearchChange = useCallback((event) => {
    setSearchTerm(event.target.value);
  }, []);

  /**
   * Handles status filter change.
   * @param {Event} event - The select change event
   */
  const handleStatusFilterChange = useCallback((event) => {
    setStatusFilter(event.target.value);
  }, []);

  /**
   * Clears all filters and resets sort.
   */
  const handleClearFilters = useCallback(() => {
    setSearchTerm('');
    setStatusFilter('');
  }, []);

  /**
   * Filtered and sorted data.
   */
  const processedData = useMemo(() => {
    if (!Array.isArray(data) || data.length === 0) {
      return [];
    }

    let filtered = data;

    // Apply text search filter
    if (searchTerm.trim()) {
      const term = searchTerm.trim().toLowerCase();
      filtered = filtered.filter((row) => {
        const name = (row.applicationName || row.name || '').toLowerCase();
        const domain = (row.domain || '').toLowerCase();
        const id = (row.applicationId || '').toLowerCase();
        return name.includes(term) || domain.includes(term) || id.includes(term);
      });
    }

    // Apply status filter
    if (statusFilter) {
      filtered = filtered.filter((row) => {
        if (statusFilter === 'passing') {
          return countFailingStatuses(row) === 0 && countPassingStatuses(row) === STATUS_COLUMNS.length;
        }
        if (statusFilter === 'failing') {
          return countFailingStatuses(row) > 0;
        }
        if (statusFilter === 'partial') {
          const failing = countFailingStatuses(row);
          const passing = countPassingStatuses(row);
          return failing === 0 && passing > 0 && passing < STATUS_COLUMNS.length;
        }
        return true;
      });
    }

    // Apply sorting
    if (sortDirection !== SORT_DIRECTION.NONE && sortKey) {
      filtered = [...filtered].sort((a, b) => {
        let aVal;
        let bVal;

        if (sortKey === 'applicationName') {
          aVal = (a.applicationName || a.name || '').toLowerCase();
          bVal = (b.applicationName || b.name || '').toLowerCase();
          const comparison = aVal.localeCompare(bVal);
          return sortDirection === SORT_DIRECTION.ASC ? comparison : -comparison;
        }

        if (sortKey === 'domain') {
          aVal = (a.domain || '').toLowerCase();
          bVal = (b.domain || '').toLowerCase();
          const comparison = aVal.localeCompare(bVal);
          return sortDirection === SORT_DIRECTION.ASC ? comparison : -comparison;
        }

        if (sortKey === 'overall') {
          aVal = countFailingStatuses(a) * 100 - countPassingStatuses(a);
          bVal = countFailingStatuses(b) * 100 - countPassingStatuses(b);
          const comparison = aVal - bVal;
          return sortDirection === SORT_DIRECTION.ASC ? comparison : -comparison;
        }

        // Sort by status column
        aVal = getStatusSortWeight(a[sortKey]);
        bVal = getStatusSortWeight(b[sortKey]);
        const comparison = aVal - bVal;
        return sortDirection === SORT_DIRECTION.ASC ? comparison : -comparison;
      });
    }

    return filtered;
  }, [data, searchTerm, statusFilter, sortKey, sortDirection]);

  /**
   * Summary counts for the filter bar.
   */
  const summaryCounts = useMemo(() => {
    if (!Array.isArray(data) || data.length === 0) {
      return { total: 0, passing: 0, failing: 0, partial: 0 };
    }

    let passing = 0;
    let failing = 0;
    let partial = 0;

    data.forEach((row) => {
      const failCount = countFailingStatuses(row);
      const passCount = countPassingStatuses(row);

      if (failCount > 0) {
        failing++;
      } else if (passCount === STATUS_COLUMNS.length) {
        passing++;
      } else {
        partial++;
      }
    });

    return {
      total: data.length,
      passing,
      failing,
      partial,
    };
  }, [data]);

  /**
   * Gets the sort direction for a given column key.
   * @param {string} key - The column key
   * @returns {string} Sort direction
   */
  const getSortDirection = useCallback(
    (key) => {
      if (sortKey !== key) return SORT_DIRECTION.NONE;
      return sortDirection;
    },
    [sortKey, sortDirection]
  );

  const isClickable = typeof onRowClick === 'function';
  const isCellClickable = typeof onCellClick === 'function';
  const rowPadding = compact ? 'px-3 py-1.5' : 'px-4 py-3';
  const headerPadding = compact ? 'px-3 py-2' : 'px-4 py-3';

  // Empty state
  if (!Array.isArray(data) || data.length === 0) {
    return (
      <div className={`card flex flex-col ${className || ''}`}>
        {title && (
          <h3 className="mb-4 text-base font-semibold text-slate-800 dark:text-slate-100">
            {title}
          </h3>
        )}
        <div className="flex flex-1 items-center justify-center py-12">
          <div className="text-center">
            <svg
              className="mx-auto mb-3 h-10 w-10 text-slate-300 dark:text-slate-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25a2.25 2.25 0 0 1-2.25-2.25v-2.25Z"
              />
            </svg>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {emptyMessage || 'No application status data available.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`card flex flex-col ${className || ''}`}>
      {/* Header */}
      {title && (
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">
            {title}
          </h3>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
              {summaryCounts.passing} passing
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
              {summaryCounts.partial} partial
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
              {summaryCounts.failing} failing
            </span>
          </div>
        </div>
      )}

      {/* Filter Bar */}
      {showFilter && (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <svg
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500"
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
                d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
              />
            </svg>
            <input
              type="text"
              value={searchTerm}
              onChange={handleSearchChange}
              placeholder="Search by application name, domain, or ID..."
              className="w-full rounded-md border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
              aria-label="Search applications"
            />
          </div>
          <select
            value={statusFilter}
            onChange={handleStatusFilterChange}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            aria-label="Filter by status"
          >
            <option value="">All Statuses</option>
            <option value="passing">All Passing</option>
            <option value="failing">Has Failures</option>
            <option value="partial">Partial</option>
          </select>
          {(searchTerm || statusFilter) && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="rounded-md px-3 py-2 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200"
              aria-label="Clear filters"
            >
              Clear
            </button>
          )}
          <span className="text-xs text-slate-400 dark:text-slate-500">
            {processedData.length} of {data.length} applications
          </span>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full min-w-[900px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700">
              {/* Application Name Column */}
              <th
                className={`${headerPadding} text-left font-semibold text-slate-700 dark:text-slate-300 cursor-pointer select-none transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/50`}
                onClick={() => handleSort('applicationName')}
                aria-sort={
                  sortKey === 'applicationName'
                    ? sortDirection === SORT_DIRECTION.ASC
                      ? 'ascending'
                      : sortDirection === SORT_DIRECTION.DESC
                        ? 'descending'
                        : 'none'
                    : 'none'
                }
              >
                <span className="inline-flex items-center">
                  Application
                  <SortIcon direction={getSortDirection('applicationName')} />
                </span>
              </th>

              {/* Domain Column */}
              {showDomain && (
                <th
                  className={`${headerPadding} text-left font-semibold text-slate-700 dark:text-slate-300 cursor-pointer select-none transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/50`}
                  onClick={() => handleSort('domain')}
                  aria-sort={
                    sortKey === 'domain'
                      ? sortDirection === SORT_DIRECTION.ASC
                        ? 'ascending'
                        : sortDirection === SORT_DIRECTION.DESC
                          ? 'descending'
                          : 'none'
                      : 'none'
                  }
                >
                  <span className="inline-flex items-center">
                    Domain
                    <SortIcon direction={getSortDirection('domain')} />
                  </span>
                </th>
              )}

              {/* Status Columns */}
              {STATUS_COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className={`${headerPadding} text-center font-semibold text-slate-700 dark:text-slate-300 cursor-pointer select-none transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/50`}
                  onClick={() => handleSort(col.key)}
                  title={col.description}
                  aria-sort={
                    sortKey === col.key
                      ? sortDirection === SORT_DIRECTION.ASC
                        ? 'ascending'
                        : sortDirection === SORT_DIRECTION.DESC
                          ? 'descending'
                          : 'none'
                      : 'none'
                  }
                >
                  <span className="inline-flex items-center whitespace-nowrap">
                    {col.shortLabel}
                    <SortIcon direction={getSortDirection(col.key)} />
                  </span>
                </th>
              ))}

              {/* Overall Status Column */}
              {showOverallStatus && (
                <th
                  className={`${headerPadding} text-center font-semibold text-slate-700 dark:text-slate-300 cursor-pointer select-none transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/50`}
                  onClick={() => handleSort('overall')}
                  aria-sort={
                    sortKey === 'overall'
                      ? sortDirection === SORT_DIRECTION.ASC
                        ? 'ascending'
                        : sortDirection === SORT_DIRECTION.DESC
                          ? 'descending'
                          : 'none'
                      : 'none'
                  }
                >
                  <span className="inline-flex items-center">
                    Overall
                    <SortIcon direction={getSortDirection('overall')} />
                  </span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {processedData.length === 0 ? (
              <tr>
                <td
                  colSpan={
                    STATUS_COLUMNS.length +
                    1 +
                    (showDomain ? 1 : 0) +
                    (showOverallStatus ? 1 : 0)
                  }
                  className="px-4 py-12 text-center text-sm text-slate-500 dark:text-slate-400"
                >
                  {emptyMessage || 'No applications match the current filters.'}
                </td>
              </tr>
            ) : (
              processedData.map((row, rowIndex) => {
                const appId = row.applicationId || row.id || `row-${rowIndex}`;
                const appName = row.applicationName || row.name || 'Unknown';
                const overall = computeOverallStatus(row);

                return (
                  <tr
                    key={appId}
                    className={`border-b border-slate-100 transition-colors dark:border-slate-700/50 ${
                      isClickable
                        ? 'cursor-pointer hover:bg-blue-50/50 dark:hover:bg-blue-900/10'
                        : 'hover:bg-slate-50/50 dark:hover:bg-slate-700/20'
                    } ${rowIndex % 2 === 0 ? 'bg-white dark:bg-slate-800' : 'bg-slate-50/30 dark:bg-slate-800/50'}`}
                    onClick={() => handleRowClick(row)}
                    onKeyDown={(e) => handleRowKeyDown(row, e)}
                    tabIndex={isClickable ? 0 : undefined}
                    role={isClickable ? 'button' : undefined}
                    aria-label={
                      isClickable
                        ? `${appName} — click to view details`
                        : undefined
                    }
                  >
                    {/* Application Name */}
                    <td className={`${rowPadding} font-medium text-slate-800 dark:text-slate-200`}>
                      <div className="flex flex-col">
                        <span className="truncate max-w-[200px]" title={appName}>
                          {appName}
                        </span>
                        {!showDomain && row.domain && (
                          <span className="text-2xs text-slate-400 dark:text-slate-500 truncate max-w-[200px]">
                            {row.domain}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Domain */}
                    {showDomain && (
                      <td className={`${rowPadding} text-slate-600 dark:text-slate-400`}>
                        <span className="truncate max-w-[150px] block" title={row.domain || ''}>
                          {row.domain || '—'}
                        </span>
                      </td>
                    )}

                    {/* Status Cells */}
                    {STATUS_COLUMNS.map((col) => {
                      const cellStatus = row[col.key] || 'pending';

                      return (
                        <td
                          key={`${appId}-${col.key}`}
                          className={`${rowPadding} text-center ${
                            isCellClickable
                              ? 'cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-600/30'
                              : ''
                          }`}
                          onClick={
                            isCellClickable
                              ? (e) => handleCellClick(row, col, e)
                              : undefined
                          }
                          title={`${col.label}: ${cellStatus}`}
                        >
                          <div className="flex items-center justify-center">
                            <StatusBadge
                              status={cellStatus}
                              size={compact ? 'sm' : 'md'}
                              showIcon
                              showDot={false}
                            />
                          </div>
                        </td>
                      );
                    })}

                    {/* Overall Status */}
                    {showOverallStatus && (
                      <td className={`${rowPadding} text-center`}>
                        <div className="flex items-center justify-center">
                          <StatusBadge
                            status={overall}
                            size={compact ? 'sm' : 'md'}
                            showIcon
                            showDot={false}
                            bordered
                          />
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer Summary */}
      {processedData.length > 0 && (
        <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-3 dark:border-slate-700">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Showing {processedData.length} of {data.length} applications
          </span>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <StatusBadge status="success" size="sm" showIcon />
              <span>= Passed</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <StatusBadge status="failure" size="sm" showIcon />
              <span>= Failed</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <StatusBadge status="pending" size="sm" showIcon />
              <span>= Pending</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

StatusMatrix.propTypes = {
  data: PropTypes.arrayOf(
    PropTypes.shape({
      applicationId: PropTypes.string,
      applicationName: PropTypes.string,
      name: PropTypes.string,
      domain: PropTypes.string,
      unitTesting: PropTypes.string,
      sonarQubeSCA: PropTypes.string,
      nexusScans: PropTypes.string,
      ocpDeployment: PropTypes.string,
      sastScan: PropTypes.string,
      dastScan: PropTypes.string,
      automationTestExecution: PropTypes.string,
    })
  ).isRequired,
  title: PropTypes.string,
  onRowClick: PropTypes.func,
  onCellClick: PropTypes.func,
  showFilter: PropTypes.bool,
  showOverallStatus: PropTypes.bool,
  showDomain: PropTypes.bool,
  compact: PropTypes.bool,
  className: PropTypes.string,
  emptyMessage: PropTypes.string,
};

StatusMatrix.defaultProps = {
  title: '',
  onRowClick: null,
  onCellClick: null,
  showFilter: true,
  showOverallStatus: true,
  showDomain: true,
  compact: false,
  className: '',
  emptyMessage: 'No application status data available.',
};

export default StatusMatrix;