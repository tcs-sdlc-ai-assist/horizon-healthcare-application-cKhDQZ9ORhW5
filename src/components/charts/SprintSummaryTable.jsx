import { useState, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import { EditableField } from '@/components/common/EditableField';
import { HealthIndicator } from '@/components/common/HealthIndicator';
import { StatusBadge } from '@/components/common/StatusBadge';
import { useRoleGuard } from '@/hooks/useRoleGuard';
import { formatNumber, formatPercentage } from '@/utils/formatUtils';
import { getExternalLink, EXTERNAL_SYSTEMS } from '@/utils/drillDownUtils';

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
 * Column configuration for the sprint summary table.
 * @type {Array<{ key: string, label: string, shortLabel: string, sortable: boolean, align: string, width: string }>}
 */
const COLUMNS = [
  { key: 'sprintName', label: 'Sprint', shortLabel: 'Sprint', sortable: true, align: 'left', width: 'min-w-[140px]' },
  { key: 'team', label: 'Team', shortLabel: 'Team', sortable: true, align: 'left', width: 'min-w-[120px]' },
  { key: 'committed', label: 'Committed', shortLabel: 'Committed', sortable: true, align: 'right', width: 'min-w-[100px]' },
  { key: 'done', label: 'Done', shortLabel: 'Done', sortable: true, align: 'right', width: 'min-w-[80px]' },
  { key: 'deployed', label: 'Deployed', shortLabel: 'Deployed', sortable: true, align: 'right', width: 'min-w-[90px]' },
  { key: 'carryOver', label: 'Carry-Over', shortLabel: 'Carry-Over', sortable: true, align: 'right', width: 'min-w-[100px]' },
  { key: 'predictability', label: 'Predictability %', shortLabel: 'Predict.', sortable: true, align: 'center', width: 'min-w-[120px]' },
  { key: 'health', label: 'Health', shortLabel: 'Health', sortable: false, align: 'center', width: 'min-w-[80px]' },
  { key: 'actions', label: 'Actions', shortLabel: 'Actions', sortable: false, align: 'center', width: 'min-w-[100px]' },
];

/**
 * Predictability thresholds for health indicator.
 * @type {{ green: number, amber: number, invertScale: boolean }}
 */
const PREDICTABILITY_THRESHOLDS = {
  green: 90,
  amber: 70,
  invertScale: false,
};

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
 * Computes an overall health status for a sprint row based on predictability.
 * @param {Object} row - The sprint data row
 * @returns {string} Health status: 'success', 'warning', or 'failure'
 */
function computeSprintHealth(row) {
  const predictability = row.predictability;
  if (predictability === null || predictability === undefined || isNaN(Number(predictability))) {
    return 'pending';
  }
  const val = Number(predictability);
  if (val >= 90) return 'success';
  if (val >= 70) return 'warning';
  return 'failure';
}

/**
 * SprintSummaryTable — Summary table component for the Agile Flow dashboard.
 *
 * Displays Sprint name, Committed count, Done count, Deployed count,
 * Carry-Over, Predictability %, and health indicator per sprint/application.
 * Supports sorting, inline editing of estimates (RBAC-gated), and navigation
 * to sprint details and linked Jira/qTest views.
 *
 * @param {Object} props
 * @param {Array<Object>} props.data - Array of sprint metric objects. Each object should have:
 *   sprintId, sprintName, team, domain, startDate, endDate, committed, done,
 *   deployed, predictability, velocity, carryOver, storiesCommitted, storiesDone,
 *   storiesDeployed, defectsFound, defectsFixed
 * @param {string} [props.title] - Optional title displayed above the table
 * @param {Function} [props.onRowClick] - Callback when a row is clicked, receives the full row data object
 * @param {Function} [props.onFieldSave] - Callback when an editable field is saved, receives save result
 * @param {boolean} [props.showTeam=true] - Whether to show the team column
 * @param {boolean} [props.showActions=true] - Whether to show the actions column with external links
 * @param {boolean} [props.showFilter=true] - Whether to show the search/filter controls
 * @param {boolean} [props.compact=false] - Whether to use compact row sizing
 * @param {string} [props.className] - Additional CSS classes for the wrapper
 * @param {string} [props.emptyMessage] - Message to display when no data matches filters
 * @returns {JSX.Element}
 */
export function SprintSummaryTable({
  data,
  title,
  onRowClick,
  onFieldSave,
  showTeam,
  showActions,
  showFilter,
  compact,
  className,
  emptyMessage,
}) {
  const navigate = useNavigate();
  const { canEdit } = useRoleGuard();

  const [searchTerm, setSearchTerm] = useState('');
  const [sortKey, setSortKey] = useState('sprintName');
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
   * Handles row click for drill-down navigation.
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
   * Clears the search filter.
   */
  const handleClearSearch = useCallback(() => {
    setSearchTerm('');
  }, []);

  /**
   * Navigates to sprint detail view.
   * @param {Object} row - The sprint row data
   * @param {Event} event - The click event
   */
  const handleNavigateToDetail = useCallback(
    (row, event) => {
      event.stopPropagation();
      navigate(`/dashboards/agile/sprint?sprintId=${encodeURIComponent(row.sprintId)}&team=${encodeURIComponent(row.team)}`);
    },
    [navigate]
  );

  /**
   * Opens Jira board for the sprint's team.
   * @param {Object} row - The sprint row data
   * @param {Event} event - The click event
   */
  const handleOpenJira = useCallback((row, event) => {
    event.stopPropagation();
    const url = getExternalLink(EXTERNAL_SYSTEMS.JIRA, row.sprintId || 'SCRUM');
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }, []);

  /**
   * Opens qTest for the sprint's test execution.
   * @param {Object} row - The sprint row data
   * @param {Event} event - The click event
   */
  const handleOpenQTest = useCallback((row, event) => {
    event.stopPropagation();
    const url = getExternalLink(EXTERNAL_SYSTEMS.QTEST, row.sprintId || 'project');
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }, []);

  /**
   * Handles editable field save callback.
   * @param {Object} saveResult - The save result from EditableField
   */
  const handleFieldSave = useCallback(
    (saveResult) => {
      if (typeof onFieldSave === 'function') {
        onFieldSave(saveResult);
      }
    },
    [onFieldSave]
  );

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
        const sprintName = (row.sprintName || '').toLowerCase();
        const team = (row.team || '').toLowerCase();
        const domain = (row.domain || '').toLowerCase();
        const sprintId = (row.sprintId || '').toLowerCase();
        return (
          sprintName.includes(term) ||
          team.includes(term) ||
          domain.includes(term) ||
          sprintId.includes(term)
        );
      });
    }

    // Apply sorting
    if (sortDirection !== SORT_DIRECTION.NONE && sortKey) {
      filtered = [...filtered].sort((a, b) => {
        let aVal;
        let bVal;

        if (sortKey === 'sprintName' || sortKey === 'team') {
          aVal = (a[sortKey] || '').toLowerCase();
          bVal = (b[sortKey] || '').toLowerCase();
          const comparison = aVal.localeCompare(bVal);
          return sortDirection === SORT_DIRECTION.ASC ? comparison : -comparison;
        }

        // Numeric sort for all other columns
        aVal = Number(a[sortKey]) || 0;
        bVal = Number(b[sortKey]) || 0;
        const comparison = aVal - bVal;
        return sortDirection === SORT_DIRECTION.ASC ? comparison : -comparison;
      });
    }

    return filtered;
  }, [data, searchTerm, sortKey, sortDirection]);

  /**
   * Summary statistics for the header.
   */
  const summaryStats = useMemo(() => {
    if (!Array.isArray(data) || data.length === 0) {
      return { total: 0, avgPredictability: 0, totalCommitted: 0, totalDone: 0 };
    }

    const totalCommitted = data.reduce((sum, row) => sum + (Number(row.committed) || 0), 0);
    const totalDone = data.reduce((sum, row) => sum + (Number(row.done) || 0), 0);
    const predictabilities = data
      .map((row) => Number(row.predictability))
      .filter((val) => !isNaN(val));
    const avgPredictability =
      predictabilities.length > 0
        ? predictabilities.reduce((sum, val) => sum + val, 0) / predictabilities.length
        : 0;

    return {
      total: data.length,
      avgPredictability: parseFloat(avgPredictability.toFixed(1)),
      totalCommitted,
      totalDone,
    };
  }, [data]);

  const isClickable = typeof onRowClick === 'function';
  const rowPadding = compact ? 'px-3 py-1.5' : 'px-4 py-3';
  const headerPadding = compact ? 'px-3 py-2' : 'px-4 py-3';

  /**
   * Determines which columns to render based on props.
   */
  const visibleColumns = useMemo(() => {
    return COLUMNS.filter((col) => {
      if (col.key === 'team' && !showTeam) return false;
      if (col.key === 'actions' && !showActions) return false;
      return true;
    });
  }, [showTeam, showActions]);

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
                d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5"
              />
            </svg>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {emptyMessage || 'No sprint data available.'}
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
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Avg Predictability:{' '}
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {formatPercentage(summaryStats.avgPredictability, 1)}
              </span>
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {summaryStats.totalDone}/{summaryStats.totalCommitted} pts done
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
              placeholder="Search by sprint name, team, or domain..."
              className="w-full rounded-md border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
              aria-label="Search sprints"
            />
          </div>
          {searchTerm && (
            <button
              type="button"
              onClick={handleClearSearch}
              className="rounded-md px-3 py-2 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200"
              aria-label="Clear search"
            >
              Clear
            </button>
          )}
          <span className="text-xs text-slate-400 dark:text-slate-500">
            {processedData.length} of {data.length} sprints
          </span>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full min-w-[800px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700">
              {visibleColumns.map((col) => {
                const alignClass =
                  col.align === 'right'
                    ? 'text-right'
                    : col.align === 'center'
                      ? 'text-center'
                      : 'text-left';

                return (
                  <th
                    key={col.key}
                    className={`${headerPadding} ${alignClass} ${col.width} font-semibold text-slate-700 dark:text-slate-300 ${
                      col.sortable
                        ? 'cursor-pointer select-none transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/50'
                        : ''
                    }`}
                    onClick={col.sortable ? () => handleSort(col.key) : undefined}
                    aria-sort={
                      col.sortable && sortKey === col.key
                        ? sortDirection === SORT_DIRECTION.ASC
                          ? 'ascending'
                          : sortDirection === SORT_DIRECTION.DESC
                            ? 'descending'
                            : 'none'
                        : undefined
                    }
                  >
                    <span className="inline-flex items-center whitespace-nowrap">
                      {col.shortLabel}
                      {col.sortable && <SortIcon direction={getSortDirection(col.key)} />}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {processedData.length === 0 ? (
              <tr>
                <td
                  colSpan={visibleColumns.length}
                  className="px-4 py-12 text-center text-sm text-slate-500 dark:text-slate-400"
                >
                  {emptyMessage || 'No sprints match the current search.'}
                </td>
              </tr>
            ) : (
              processedData.map((row, rowIndex) => {
                const sprintId = row.sprintId || `sprint-${rowIndex}`;
                const health = computeSprintHealth(row);

                return (
                  <tr
                    key={sprintId}
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
                        ? `${row.sprintName} — ${row.team} — click to view details`
                        : undefined
                    }
                  >
                    {/* Sprint Name */}
                    {visibleColumns.some((c) => c.key === 'sprintName') && (
                      <td className={`${rowPadding} font-medium text-slate-800 dark:text-slate-200`}>
                        <div className="flex flex-col">
                          <span className="truncate max-w-[180px]" title={row.sprintName}>
                            {row.sprintName || '—'}
                          </span>
                          <span className="text-2xs text-slate-400 dark:text-slate-500 truncate max-w-[180px]">
                            {row.domain || ''}
                          </span>
                        </div>
                      </td>
                    )}

                    {/* Team */}
                    {visibleColumns.some((c) => c.key === 'team') && (
                      <td className={`${rowPadding} text-slate-600 dark:text-slate-400`}>
                        <span className="truncate max-w-[140px] block" title={row.team || ''}>
                          {row.team || '—'}
                        </span>
                      </td>
                    )}

                    {/* Committed */}
                    {visibleColumns.some((c) => c.key === 'committed') && (
                      <td className={`${rowPadding} text-right`}>
                        {canEdit ? (
                          <EditableField
                            recordId={sprintId}
                            field="committed"
                            value={row.committed}
                            type="number"
                            min={0}
                            max={999}
                            dataType="sprintMetrics"
                            idField="sprintId"
                            onSave={handleFieldSave}
                            className="justify-end"
                          />
                        ) : (
                          <span className="text-slate-800 dark:text-slate-200">
                            {formatNumber(row.committed, { maximumFractionDigits: 0 })}
                          </span>
                        )}
                      </td>
                    )}

                    {/* Done */}
                    {visibleColumns.some((c) => c.key === 'done') && (
                      <td className={`${rowPadding} text-right`}>
                        <span className="text-slate-800 dark:text-slate-200">
                          {formatNumber(row.done, { maximumFractionDigits: 0 })}
                        </span>
                      </td>
                    )}

                    {/* Deployed */}
                    {visibleColumns.some((c) => c.key === 'deployed') && (
                      <td className={`${rowPadding} text-right`}>
                        <span className="text-slate-800 dark:text-slate-200">
                          {formatNumber(row.deployed, { maximumFractionDigits: 0 })}
                        </span>
                      </td>
                    )}

                    {/* Carry-Over */}
                    {visibleColumns.some((c) => c.key === 'carryOver') && (
                      <td className={`${rowPadding} text-right`}>
                        <span
                          className={`font-medium ${
                            (Number(row.carryOver) || 0) > 0
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-green-600 dark:text-green-400'
                          }`}
                        >
                          {formatNumber(row.carryOver, { maximumFractionDigits: 0 })}
                        </span>
                      </td>
                    )}

                    {/* Predictability */}
                    {visibleColumns.some((c) => c.key === 'predictability') && (
                      <td className={`${rowPadding} text-center`}>
                        <div className="flex items-center justify-center gap-2">
                          <HealthIndicator
                            value={row.predictability}
                            thresholds={PREDICTABILITY_THRESHOLDS}
                            unit="percentage"
                            variant="dot"
                            size={compact ? 'sm' : 'md'}
                            showValue
                          />
                        </div>
                      </td>
                    )}

                    {/* Health */}
                    {visibleColumns.some((c) => c.key === 'health') && (
                      <td className={`${rowPadding} text-center`}>
                        <div className="flex items-center justify-center">
                          <StatusBadge
                            status={health}
                            size={compact ? 'sm' : 'md'}
                            showIcon
                            showDot={false}
                          />
                        </div>
                      </td>
                    )}

                    {/* Actions */}
                    {visibleColumns.some((c) => c.key === 'actions') && (
                      <td className={`${rowPadding} text-center`}>
                        <div className="flex items-center justify-center gap-1">
                          {/* Navigate to detail */}
                          <button
                            type="button"
                            onClick={(e) => handleNavigateToDetail(row, e)}
                            className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-blue-600 dark:hover:bg-slate-700 dark:hover:text-blue-400"
                            title="View sprint details"
                            aria-label={`View details for ${row.sprintName}`}
                          >
                            <svg
                              className="h-4 w-4"
                              xmlns="http://www.w3.org/2000/svg"
                              fill="none"
                              viewBox="0 0 24 24"
                              strokeWidth={1.5}
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z"
                              />
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                              />
                            </svg>
                          </button>

                          {/* Jira link */}
                          <button
                            type="button"
                            onClick={(e) => handleOpenJira(row, e)}
                            className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-blue-600 dark:hover:bg-slate-700 dark:hover:text-blue-400"
                            title="Open in Jira"
                            aria-label={`Open ${row.sprintName} in Jira`}
                          >
                            <svg
                              className="h-4 w-4"
                              xmlns="http://www.w3.org/2000/svg"
                              fill="none"
                              viewBox="0 0 24 24"
                              strokeWidth={1.5}
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
                              />
                            </svg>
                          </button>

                          {/* qTest link */}
                          <button
                            type="button"
                            onClick={(e) => handleOpenQTest(row, e)}
                            className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-green-600 dark:hover:bg-slate-700 dark:hover:text-green-400"
                            title="Open in qTest"
                            aria-label={`Open ${row.sprintName} in qTest`}
                          >
                            <svg
                              className="h-4 w-4"
                              xmlns="http://www.w3.org/2000/svg"
                              fill="none"
                              viewBox="0 0 24 24"
                              strokeWidth={1.5}
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                              />
                            </svg>
                          </button>
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
            Showing {processedData.length} of {data.length} sprints
          </span>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
              <span>≥ 90%</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
              <span>70–89%</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
              <span>&lt; 70%</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

SprintSummaryTable.propTypes = {
  data: PropTypes.arrayOf(
    PropTypes.shape({
      sprintId: PropTypes.string,
      sprintName: PropTypes.string,
      team: PropTypes.string,
      domain: PropTypes.string,
      startDate: PropTypes.string,
      endDate: PropTypes.string,
      committed: PropTypes.number,
      done: PropTypes.number,
      deployed: PropTypes.number,
      predictability: PropTypes.number,
      velocity: PropTypes.number,
      carryOver: PropTypes.number,
      storiesCommitted: PropTypes.number,
      storiesDone: PropTypes.number,
      storiesDeployed: PropTypes.number,
      defectsFound: PropTypes.number,
      defectsFixed: PropTypes.number,
    })
  ).isRequired,
  title: PropTypes.string,
  onRowClick: PropTypes.func,
  onFieldSave: PropTypes.func,
  showTeam: PropTypes.bool,
  showActions: PropTypes.bool,
  showFilter: PropTypes.bool,
  compact: PropTypes.bool,
  className: PropTypes.string,
  emptyMessage: PropTypes.string,
};

SprintSummaryTable.defaultProps = {
  title: '',
  onRowClick: null,
  onFieldSave: null,
  showTeam: true,
  showActions: true,
  showFilter: true,
  compact: false,
  className: '',
  emptyMessage: 'No sprint data available.',
};

export default SprintSummaryTable;