import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useFilters } from '@/context/FilterContext';
import {
  getFilteredData,
  getAllData,
  initializeData,
  DATA_TYPES,
} from '@/services/dataService';

/**
 * @typedef {'devsecops' | 'appdev' | 'agileflow'} DashboardType
 */

/**
 * @typedef {Object} DashboardDataResult
 * @property {Object} data - The filtered dashboard data, keyed by data type
 * @property {boolean} loading - Whether data is currently being fetched
 * @property {string|null} error - Error message if data fetching failed
 * @property {Function} refresh - Function to manually re-fetch data
 */

/**
 * Maps dashboard types to their relevant data type collections.
 * Each dashboard type retrieves a specific set of data types from the data service.
 * @type {Record<DashboardType, string[]>}
 */
const DASHBOARD_DATA_MAP = {
  devsecops: [
    DATA_TYPES.APPLICATIONS,
    DATA_TYPES.DEV_READINESS,
    DATA_TYPES.UNIT_TEST_COVERAGE,
    DATA_TYPES.SECURITY_SCANS,
    DATA_TYPES.DEPLOYMENT_PIPELINES,
    DATA_TYPES.APPLICATION_STATUS,
    DATA_TYPES.SECURITY_COMPLIANCE,
  ],
  appdev: [
    DATA_TYPES.APPLICATIONS,
    DATA_TYPES.DORA_METRICS,
    DATA_TYPES.RELIABILITY,
    DATA_TYPES.TECH_DEBT,
    DATA_TYPES.DEPLOYMENT_PIPELINES,
    DATA_TYPES.APPLICATION_STATUS,
    DATA_TYPES.SECURITY_COMPLIANCE,
  ],
  agileflow: [
    DATA_TYPES.APPLICATIONS,
    DATA_TYPES.SPRINT_METRICS,
    DATA_TYPES.FLOW_DISTRIBUTION,
    DATA_TYPES.CARRY_OVER,
    DATA_TYPES.DOMAIN_SUMMARIES,
  ],
};

/**
 * Builds a filter params object from the FilterContext filters,
 * mapping context filter keys to the dataService FilterParams shape.
 * @param {import('@/context/FilterContext').FilterState} filters - The current filter state
 * @returns {import('@/services/dataService').FilterParams} Mapped filter parameters
 */
function buildFilterParams(filters) {
  if (!filters || typeof filters !== 'object') {
    return {};
  }

  const params = {};

  if (filters.domain) {
    params.domain = filters.domain;
  }

  if (filters.application) {
    params.applicationName = filters.application;
  }

  if (filters.team) {
    params.team = filters.team;
  }

  if (filters.environment) {
    params.environment = filters.environment;
  }

  if (filters.dateFrom) {
    params.dateFrom = filters.dateFrom;
  }

  if (filters.dateTo) {
    params.dateTo = filters.dateTo;
  }

  if (filters.sprint) {
    // Sprint filter is applied by matching sprintName in the sprint-related data
    params.sprintName = filters.sprint;
  }

  return params;
}

/**
 * Applies sprint name filtering for data types that use sprintName
 * instead of the standard filter params.
 * @param {Array<Object>} data - The dataset to filter
 * @param {string} sprintName - The sprint name to filter by
 * @returns {Array<Object>} Filtered dataset
 */
function applySprintNameFilter(data, sprintName) {
  if (!sprintName || !Array.isArray(data) || data.length === 0) {
    return data;
  }

  const lowerSprintName = sprintName.toLowerCase();

  return data.filter((item) => {
    const itemSprintName = item.sprintName || '';
    return itemSprintName.toLowerCase() === lowerSprintName;
  });
}

/**
 * Custom React hook that combines FilterContext and dataService to provide
 * filtered dashboard data. Automatically re-fetches when filters change.
 *
 * Returns an object with the filtered data (keyed by data type), loading state,
 * error state, and a manual refresh function.
 *
 * @param {DashboardType} dashboardType - The dashboard type to fetch data for
 *   ('devsecops', 'appdev', or 'agileflow')
 * @returns {DashboardDataResult} Object containing data, loading, error, and refresh
 *
 * @example
 * const { data, loading, error, refresh } = useDashboardData('devsecops');
 *
 * // Access specific data types
 * const securityScans = data.securityScanResults;
 * const applications = data.applications;
 *
 * // Manually refresh
 * <button onClick={refresh}>Refresh</button>
 */
export function useDashboardData(dashboardType) {
  const { filters } = useFilters();
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const initializedRef = useRef(false);
  const mountedRef = useRef(true);

  // Determine which data types to fetch based on the dashboard type
  const dataTypes = useMemo(() => {
    if (!dashboardType || typeof dashboardType !== 'string') {
      return [];
    }

    const normalizedType = dashboardType.trim().toLowerCase();
    return DASHBOARD_DATA_MAP[normalizedType] || [];
  }, [dashboardType]);

  // Build filter params from the current filter context
  const filterParams = useMemo(() => buildFilterParams(filters), [filters]);

  /**
   * Fetches and filters data for all data types associated with the dashboard.
   */
  const fetchData = useCallback(() => {
    if (dataTypes.length === 0) {
      if (mountedRef.current) {
        setData({});
        setLoading(false);
        setError(
          dashboardType
            ? `Unknown dashboard type: "${dashboardType}". Supported types: devsecops, appdev, agileflow.`
            : 'Dashboard type is required.'
        );
      }
      return;
    }

    if (mountedRef.current) {
      setLoading(true);
      setError(null);
    }

    try {
      // Ensure data store is initialized
      if (!initializedRef.current) {
        initializeData();
        initializedRef.current = true;
      }

      const result = {};
      const errors = [];

      for (const dataType of dataTypes) {
        const filterResult = getFilteredData(filterParams, dataType);

        if (filterResult.success) {
          let filteredData = filterResult.data;

          // Apply sprint name filter for sprint-related data types
          if (
            filters.sprint &&
            (dataType === DATA_TYPES.SPRINT_METRICS ||
              dataType === DATA_TYPES.FLOW_DISTRIBUTION ||
              dataType === DATA_TYPES.CARRY_OVER)
          ) {
            filteredData = applySprintNameFilter(filteredData, filters.sprint);
          }

          result[dataType] = filteredData;
        } else {
          errors.push(filterResult.error || `Failed to fetch ${dataType}`);
          result[dataType] = [];
        }
      }

      if (mountedRef.current) {
        setData(result);
        setLoading(false);

        if (errors.length > 0) {
          setError(`Partial data load failure: ${errors.join('; ')}`);
        } else {
          setError(null);
        }
      }
    } catch (err) {
      if (mountedRef.current) {
        setData({});
        setLoading(false);
        setError(`Failed to load dashboard data: ${err.message || 'Unknown error'}`);
      }
    }
  }, [dataTypes, filterParams, dashboardType, filters.sprint]);

  // Track mounted state for safe state updates
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Fetch data on mount and when filters or dashboard type change
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /**
   * Manually refreshes the dashboard data.
   */
  const refresh = useCallback(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    refresh,
  };
}

export default useDashboardData;