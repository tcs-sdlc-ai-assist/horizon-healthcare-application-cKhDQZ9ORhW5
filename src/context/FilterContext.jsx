import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { LOCAL_STORAGE_KEYS } from '../constants/constants';
import {
  applications,
  constants as mockConstants,
  sprintMetrics,
} from '../constants/mockData';

/**
 * @typedef {Object} FilterState
 * @property {string} domain - Selected domain filter value
 * @property {string} application - Selected application filter value
 * @property {string} release - Selected release filter value
 * @property {string} sprint - Selected sprint filter value
 * @property {string} team - Selected team filter value
 * @property {string} environment - Selected environment filter value
 * @property {string} dateFrom - Start date filter in YYYY-MM-DD format
 * @property {string} dateTo - End date filter in YYYY-MM-DD format
 */

/**
 * @typedef {Object} FilterContextValue
 * @property {FilterState} filters - The current filter state
 * @property {function} setFilter - Sets a single filter value: (key: string, value: string) => void
 * @property {function} resetFilters - Resets all filters to their default (empty) values
 * @property {function} getFilterOptions - Returns available options for a given filter key: (key: string) => Array<{ label: string, value: string }>
 */

const DEFAULT_FILTERS = {
  domain: '',
  application: '',
  release: '',
  sprint: '',
  team: '',
  environment: '',
  dateFrom: '',
  dateTo: '',
};

const FilterContext = createContext(null);

/**
 * Reads persisted filter state from localStorage.
 * @returns {FilterState} The persisted filter state or defaults
 */
function readPersistedFilters() {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEYS.HORIZON_FILTER_STATE);
    if (!raw) {
      return { ...DEFAULT_FILTERS };
    }
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return {
        domain: parsed.domain || '',
        application: parsed.application || '',
        release: parsed.release || '',
        sprint: parsed.sprint || '',
        team: parsed.team || '',
        environment: parsed.environment || '',
        dateFrom: parsed.dateFrom || '',
        dateTo: parsed.dateTo || '',
      };
    }
    return { ...DEFAULT_FILTERS };
  } catch (error) {
    console.error('Failed to read persisted filters:', error);
    return { ...DEFAULT_FILTERS };
  }
}

/**
 * Persists filter state to localStorage.
 * @param {FilterState} filters - The filter state to persist
 */
function persistFilters(filters) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEYS.HORIZON_FILTER_STATE, JSON.stringify(filters));
  } catch (error) {
    console.error('Failed to persist filter state:', error);
  }
}

/**
 * Derives available application options based on the currently selected domain.
 * @param {string} selectedDomain - The currently selected domain
 * @returns {Array<{ label: string, value: string }>} Available application options
 */
function deriveApplicationOptions(selectedDomain) {
  let filteredApps = applications;

  if (selectedDomain) {
    filteredApps = applications.filter(
      (app) => app.domain.toLowerCase() === selectedDomain.toLowerCase()
    );
  }

  const uniqueNames = [...new Set(filteredApps.map((app) => app.name))].sort();

  return uniqueNames.map((name) => ({
    label: name,
    value: name,
  }));
}

/**
 * Derives available sprint options based on the currently selected team and domain.
 * @param {string} selectedTeam - The currently selected team
 * @param {string} selectedDomain - The currently selected domain
 * @returns {Array<{ label: string, value: string }>} Available sprint options
 */
function deriveSprintOptions(selectedTeam, selectedDomain) {
  let filteredSprints = sprintMetrics;

  if (selectedTeam) {
    filteredSprints = filteredSprints.filter(
      (s) => s.team.toLowerCase() === selectedTeam.toLowerCase()
    );
  }

  if (selectedDomain) {
    filteredSprints = filteredSprints.filter(
      (s) => s.domain.toLowerCase() === selectedDomain.toLowerCase()
    );
  }

  const uniqueSprints = [...new Set(filteredSprints.map((s) => s.sprintName))].sort();

  return uniqueSprints.map((name) => ({
    label: name,
    value: name,
  }));
}

/**
 * FilterProvider component that wraps the application and provides
 * global filter state and actions via React Context.
 *
 * Manages domain, application, release, sprint, team, environment,
 * and date range filter selections with persistence to localStorage.
 * Filter changes trigger re-renders of all subscribed dashboard components.
 *
 * @param {{ children: React.ReactNode }} props
 * @returns {React.ReactElement}
 */
export function FilterProvider({ children }) {
  const [filters, setFilters] = useState(() => readPersistedFilters());

  // Persist filters to localStorage whenever they change
  useEffect(() => {
    persistFilters(filters);
  }, [filters]);

  /**
   * Sets a single filter value by key. Clears dependent filters when
   * a parent filter changes (e.g., changing domain clears application).
   *
   * @param {string} key - The filter key to update
   * @param {string} value - The new filter value (empty string to clear)
   */
  const setFilter = useCallback((key, value) => {
    if (!key || typeof key !== 'string') {
      return;
    }

    setFilters((prev) => {
      const next = { ...prev, [key]: value };

      // Clear dependent filters when parent filter changes
      if (key === 'domain') {
        // When domain changes, check if current application still belongs to new domain
        if (value && prev.application) {
          const appStillValid = applications.some(
            (app) =>
              app.name === prev.application &&
              app.domain.toLowerCase() === value.toLowerCase()
          );
          if (!appStillValid) {
            next.application = '';
          }
        }
        // Check if current sprint still belongs to new domain
        if (value && prev.sprint) {
          const sprintStillValid = sprintMetrics.some(
            (s) =>
              s.sprintName === prev.sprint &&
              s.domain.toLowerCase() === value.toLowerCase()
          );
          if (!sprintStillValid) {
            next.sprint = '';
          }
        }
      }

      if (key === 'team') {
        // When team changes, check if current sprint still belongs to new team
        if (value && prev.sprint) {
          const sprintStillValid = sprintMetrics.some(
            (s) =>
              s.sprintName === prev.sprint &&
              s.team.toLowerCase() === value.toLowerCase()
          );
          if (!sprintStillValid) {
            next.sprint = '';
          }
        }
      }

      return next;
    });
  }, []);

  /**
   * Resets all filters to their default (empty) values.
   */
  const resetFilters = useCallback(() => {
    setFilters({ ...DEFAULT_FILTERS });
  }, []);

  /**
   * Returns available options for a given filter key, derived from mock data.
   * Options may be filtered based on current selections (e.g., applications
   * filtered by selected domain).
   *
   * @param {string} key - The filter key to get options for
   * @returns {Array<{ label: string, value: string }>} Available options
   */
  const getFilterOptions = useCallback(
    (key) => {
      if (!key || typeof key !== 'string') {
        return [];
      }

      switch (key) {
        case 'domain': {
          const domains = [...new Set(mockConstants.DOMAINS)].sort();
          return domains.map((d) => ({ label: d, value: d }));
        }

        case 'application': {
          return deriveApplicationOptions(filters.domain);
        }

        case 'team': {
          const teams = [...new Set(mockConstants.TEAMS)].sort();
          return teams.map((t) => ({ label: t, value: t }));
        }

        case 'environment': {
          const environments = [...new Set(mockConstants.ENVIRONMENTS)].sort();
          return environments.map((e) => ({ label: e, value: e }));
        }

        case 'sprint': {
          return deriveSprintOptions(filters.team, filters.domain);
        }

        case 'release': {
          // Generate release options from a predefined set
          const releases = [
            '2024.1',
            '2024.2',
            '2024.3',
            '2024.4',
            '2025.1',
          ];
          return releases.map((r) => ({ label: r, value: r }));
        }

        default:
          return [];
      }
    },
    [filters.domain, filters.team]
  );

  const contextValue = useMemo(
    () => ({
      filters,
      setFilter,
      resetFilters,
      getFilterOptions,
    }),
    [filters, setFilter, resetFilters, getFilterOptions]
  );

  return (
    <FilterContext.Provider value={contextValue}>
      {children}
    </FilterContext.Provider>
  );
}

FilterProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

/**
 * Custom hook to access the filter context.
 * Must be used within a FilterProvider.
 *
 * @returns {FilterContextValue} The filter context value containing
 *   filters, setFilter, resetFilters, and getFilterOptions
 * @throws {Error} If used outside of FilterProvider
 */
export function useFilters() {
  const context = useContext(FilterContext);
  if (context === null) {
    throw new Error('useFilters must be used within a FilterProvider.');
  }
  return context;
}

export default FilterContext;