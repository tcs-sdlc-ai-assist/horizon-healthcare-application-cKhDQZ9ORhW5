import { useCallback } from 'react';
import PropTypes from 'prop-types';
import { useFilters } from '@/context/FilterContext';
import { FilterDropdown } from '@/components/filters/FilterDropdown';

/**
 * Global filter bar component pinned at the top of every dashboard page.
 * Renders dropdown selects for Domain, Application, Release, Sprint, Team,
 * and Environment filters. Consumes FilterContext for state and options.
 * Includes a Reset Filters button. Responsive layout that collapses to
 * stacked dropdowns on tablet.
 *
 * @param {object} props
 * @param {string[]} [props.visibleFilters] - Array of filter keys to display.
 *   Defaults to all filters: ['domain', 'application', 'team', 'sprint', 'environment', 'release']
 * @param {boolean} [props.showReset=true] - Whether to show the Reset Filters button
 * @param {boolean} [props.showDateRange=false] - Whether to show date range inputs
 * @param {string} [props.className] - Additional CSS classes for the wrapper
 * @returns {JSX.Element}
 */
export function FilterBar({
  visibleFilters,
  showReset = true,
  showDateRange = false,
  className = '',
}) {
  const { filters, setFilter, resetFilters, getFilterOptions } = useFilters();

  const defaultVisibleFilters = [
    'domain',
    'application',
    'team',
    'sprint',
    'environment',
    'release',
  ];

  const activeFilters = visibleFilters && Array.isArray(visibleFilters) && visibleFilters.length > 0
    ? visibleFilters
    : defaultVisibleFilters;

  const handleFilterChange = useCallback(
    (key) => (value) => {
      setFilter(key, value);
    },
    [setFilter]
  );

  const handleDateFromChange = useCallback(
    (e) => {
      setFilter('dateFrom', e.target.value);
    },
    [setFilter]
  );

  const handleDateToChange = useCallback(
    (e) => {
      setFilter('dateTo', e.target.value);
    },
    [setFilter]
  );

  const handleReset = useCallback(() => {
    resetFilters();
  }, [resetFilters]);

  const activeFilterCount = Object.entries(filters).filter(
    ([, value]) => value !== null && value !== undefined && value !== ''
  ).length;

  const filterConfig = {
    domain: {
      label: 'Domain',
      placeholder: 'All Domains',
    },
    application: {
      label: 'Application',
      placeholder: 'All Applications',
    },
    team: {
      label: 'Team',
      placeholder: 'All Teams',
    },
    sprint: {
      label: 'Sprint',
      placeholder: 'All Sprints',
    },
    environment: {
      label: 'Environment',
      placeholder: 'All Environments',
    },
    release: {
      label: 'Release',
      placeholder: 'All Releases',
    },
  };

  return (
    <div
      className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800 ${className}`}
    >
      {/* Header row */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg
            className="h-4 w-4 text-slate-500 dark:text-slate-400"
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
              d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 0 1-.659 1.591l-5.432 5.432a2.25 2.25 0 0 0-.659 1.591v2.927a2.25 2.25 0 0 1-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 0 0-.659-1.591L3.659 7.409A2.25 2.25 0 0 1 3 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0 1 12 3Z"
            />
          </svg>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Filters
          </h3>
          {activeFilterCount > 0 && (
            <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-2xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
              {activeFilterCount} active
            </span>
          )}
        </div>
        {showReset && (
          <button
            type="button"
            onClick={handleReset}
            disabled={activeFilterCount === 0}
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200"
            aria-label="Reset all filters"
          >
            <svg
              className="h-3.5 w-3.5"
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
                d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182"
              />
            </svg>
            Reset
          </button>
        )}
      </div>

      {/* Filter dropdowns grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {activeFilters.map((filterKey) => {
          const config = filterConfig[filterKey];
          if (!config) {
            return null;
          }

          const options = getFilterOptions(filterKey);

          return (
            <FilterDropdown
              key={filterKey}
              label={config.label}
              options={options}
              value={filters[filterKey] || ''}
              onChange={handleFilterChange(filterKey)}
              placeholder={config.placeholder}
            />
          );
        })}

        {/* Date range inputs */}
        {showDateRange && (
          <>
            <div className="w-full">
              <label
                htmlFor="filter-date-from"
                className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Date From
              </label>
              <input
                id="filter-date-from"
                type="date"
                value={filters.dateFrom || ''}
                onChange={handleDateFromChange}
                max={filters.dateTo || undefined}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm transition-colors hover:border-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:border-gray-500"
                aria-label="Filter start date"
              />
            </div>
            <div className="w-full">
              <label
                htmlFor="filter-date-to"
                className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Date To
              </label>
              <input
                id="filter-date-to"
                type="date"
                value={filters.dateTo || ''}
                onChange={handleDateToChange}
                min={filters.dateFrom || undefined}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm transition-colors hover:border-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:border-gray-500"
                aria-label="Filter end date"
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

FilterBar.propTypes = {
  visibleFilters: PropTypes.arrayOf(
    PropTypes.oneOf(['domain', 'application', 'team', 'sprint', 'environment', 'release'])
  ),
  showReset: PropTypes.bool,
  showDateRange: PropTypes.bool,
  className: PropTypes.string,
};

FilterBar.defaultProps = {
  visibleFilters: null,
  showReset: true,
  showDateRange: false,
  className: '',
};

export default FilterBar;