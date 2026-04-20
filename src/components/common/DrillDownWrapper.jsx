import { useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  buildDrillDownUrl,
  getExternalLink,
  mergeDrillDownParams,
  formatDrillDownBreadcrumb,
  getParentDrillDownPath,
  isDrillDownView,
  EXTERNAL_SYSTEMS,
} from '@/utils/drillDownUtils';

/**
 * @typedef {Object} DrillDownContext
 * @property {string} dashboard - The dashboard identifier (e.g., 'devsecops', 'appdev', 'agile')
 * @property {string} [view] - The specific view within the dashboard
 * @property {string} [section] - A sub-section within the view
 */

/**
 * @typedef {Object} DrillDownWrapperProps
 * @property {React.ReactNode} children - Child elements to render with drill-down capabilities
 * @property {DrillDownContext} context - Navigation context for building drill-down URLs
 * @property {Function} [onDrillDown] - Custom callback invoked when a drill-down action occurs
 * @property {Object} [params] - Default query parameters to include in drill-down URLs
 * @property {string} [externalSystem] - External system name for link generation (e.g., 'jira', 'qtest')
 * @property {string} [externalBaseUrl] - Override base URL for external system links
 * @property {boolean} [openExternalInNewTab=true] - Whether to open external links in a new tab
 * @property {boolean} [showBreadcrumb=false] - Whether to render a breadcrumb trail
 * @property {boolean} [showBackButton=false] - Whether to render a back navigation button
 * @property {string} [className] - Additional CSS classes for the wrapper container
 */

/**
 * Breadcrumb component that renders navigation trail for drill-down views.
 * @param {Object} props
 * @param {Array<{ label: string, path: string }>} props.segments - Breadcrumb segments
 * @param {Function} props.onNavigate - Navigation callback
 * @returns {JSX.Element}
 */
function Breadcrumb({ segments, onNavigate }) {
  if (!segments || segments.length <= 1) {
    return null;
  }

  return (
    <nav aria-label="Drill-down breadcrumb" className="mb-3">
      <ol className="flex flex-wrap items-center gap-1 text-sm">
        {segments.map((segment, index) => {
          const isLast = index === segments.length - 1;

          return (
            <li key={segment.path} className="flex items-center gap-1">
              {index > 0 && (
                <svg
                  className="h-3.5 w-3.5 flex-shrink-0 text-slate-400 dark:text-slate-500"
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
                    d="M8.25 4.5l7.5 7.5-7.5 7.5"
                  />
                </svg>
              )}
              {isLast ? (
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {segment.label}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => onNavigate(segment.path)}
                  className="text-blue-600 transition-colors hover:text-blue-800 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
                >
                  {segment.label}
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

Breadcrumb.propTypes = {
  segments: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string.isRequired,
      path: PropTypes.string.isRequired,
    })
  ).isRequired,
  onNavigate: PropTypes.func.isRequired,
};

/**
 * BackButton component for navigating to the parent drill-down view.
 * @param {Object} props
 * @param {Function} props.onClick - Click handler
 * @returns {JSX.Element}
 */
function BackButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mb-3 inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200"
      aria-label="Go back to parent view"
    >
      <svg
        className="h-4 w-4"
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
          d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
        />
      </svg>
      <span>Back</span>
    </button>
  );
}

BackButton.propTypes = {
  onClick: PropTypes.func.isRequired,
};

/**
 * DrillDownWrapper — Higher-order wrapper component that adds drill-down
 * click handling to chart elements and table rows.
 *
 * Accepts an onDrillDown callback and context props. Renders children with
 * click handlers that navigate to detail views or open external system links
 * (Jira, qTest, SonarQube, etc.). Uses drillDownUtils for URL construction.
 *
 * Provides drill-down handler functions to children via render props pattern
 * or wraps children with navigation context.
 *
 * @param {DrillDownWrapperProps} props
 * @returns {JSX.Element}
 */
export function DrillDownWrapper({
  children,
  context,
  onDrillDown,
  params,
  externalSystem,
  externalBaseUrl,
  openExternalInNewTab,
  showBreadcrumb,
  showBackButton,
  className,
}) {
  const navigate = useNavigate();
  const location = useLocation();

  const breadcrumbSegments = useMemo(() => {
    if (!showBreadcrumb) {
      return [];
    }
    return formatDrillDownBreadcrumb(location.pathname);
  }, [showBreadcrumb, location.pathname]);

  const isDetailView = useMemo(() => {
    return isDrillDownView(location.pathname);
  }, [location.pathname]);

  const parentPath = useMemo(() => {
    return getParentDrillDownPath(location.pathname);
  }, [location.pathname]);

  /**
   * Handles internal drill-down navigation by building a URL from context
   * and params, then navigating to it.
   * @param {Object} [drillDownParams={}] - Additional parameters for the drill-down URL
   */
  const handleInternalDrillDown = useCallback(
    (drillDownParams = {}) => {
      if (!context || typeof context !== 'object') {
        return;
      }

      const mergedParams = {
        ...(params || {}),
        ...(drillDownParams || {}),
      };

      const url = buildDrillDownUrl(context, mergedParams);
      navigate(url);
    },
    [context, params, navigate]
  );

  /**
   * Handles external system link generation and navigation.
   * Opens the link in a new tab by default.
   * @param {string} resourceId - The resource identifier in the external system
   * @param {Object} [queryParams] - Additional query parameters for the external URL
   */
  const handleExternalLink = useCallback(
    (resourceId, queryParams) => {
      if (!externalSystem || !resourceId) {
        return;
      }

      const options = {};
      if (externalBaseUrl) {
        options.baseUrl = externalBaseUrl;
      }
      if (queryParams && typeof queryParams === 'object') {
        options.queryParams = queryParams;
      }

      const url = getExternalLink(externalSystem, resourceId, options);

      if (url) {
        if (openExternalInNewTab) {
          window.open(url, '_blank', 'noopener,noreferrer');
        } else {
          window.location.href = url;
        }
      }
    },
    [externalSystem, externalBaseUrl, openExternalInNewTab]
  );

  /**
   * Primary drill-down handler that delegates to internal navigation,
   * external link opening, or the custom onDrillDown callback.
   *
   * @param {Object} data - The data associated with the drill-down action
   * @param {Object} [options={}] - Options for the drill-down action
   * @param {string} [options.externalId] - If provided, opens an external system link
   * @param {Object} [options.externalQueryParams] - Query params for external links
   * @param {Object} [options.navigationParams] - Additional params for internal navigation
   * @param {boolean} [options.preventNavigation=false] - If true, only invokes onDrillDown without navigating
   */
  const handleDrillDown = useCallback(
    (data, options = {}) => {
      const {
        externalId,
        externalQueryParams,
        navigationParams,
        preventNavigation = false,
      } = options;

      // Invoke the custom callback if provided
      if (typeof onDrillDown === 'function') {
        onDrillDown(data, options);
      }

      if (preventNavigation) {
        return;
      }

      // If an external ID is provided and an external system is configured, open external link
      if (externalId && externalSystem) {
        handleExternalLink(externalId, externalQueryParams);
        return;
      }

      // Otherwise, perform internal navigation
      const drillDownParams = {
        ...(navigationParams || {}),
      };

      // Extract common identifiers from the data object for URL params
      if (data && typeof data === 'object') {
        if (data.applicationId && !drillDownParams.applicationId) {
          drillDownParams.applicationId = data.applicationId;
        }
        if (data.domain && !drillDownParams.domain) {
          drillDownParams.domain = data.domain;
        }
        if (data.team && !drillDownParams.team) {
          drillDownParams.team = data.team;
        }
        if (data.sprintId && !drillDownParams.sprintId) {
          drillDownParams.sprintId = data.sprintId;
        }
        if (data.environment && !drillDownParams.environment) {
          drillDownParams.environment = data.environment;
        }
      }

      handleInternalDrillDown(drillDownParams);
    },
    [onDrillDown, externalSystem, handleExternalLink, handleInternalDrillDown]
  );

  /**
   * Merges new parameters into the current URL without losing existing context.
   * @param {Object} newParams - New parameters to merge
   */
  const handleMergeParams = useCallback(
    (newParams) => {
      const mergedUrl = mergeDrillDownParams(
        location.pathname,
        location.search,
        newParams
      );
      navigate(mergedUrl);
    },
    [location.pathname, location.search, navigate]
  );

  /**
   * Navigates to a specific breadcrumb path.
   * @param {string} path - The path to navigate to
   */
  const handleBreadcrumbNavigate = useCallback(
    (path) => {
      navigate(path);
    },
    [navigate]
  );

  /**
   * Navigates back to the parent drill-down view.
   */
  const handleBack = useCallback(() => {
    navigate(parentPath);
  }, [navigate, parentPath]);

  /**
   * Generates an external system URL without navigating.
   * Useful for rendering links in tables or lists.
   * @param {string} resourceId - The resource identifier
   * @param {Object} [queryParams] - Additional query parameters
   * @returns {string|null} The external URL or null
   */
  const getExternalUrl = useCallback(
    (resourceId, queryParams) => {
      if (!externalSystem || !resourceId) {
        return null;
      }

      const options = {};
      if (externalBaseUrl) {
        options.baseUrl = externalBaseUrl;
      }
      if (queryParams && typeof queryParams === 'object') {
        options.queryParams = queryParams;
      }

      return getExternalLink(externalSystem, resourceId, options);
    },
    [externalSystem, externalBaseUrl]
  );

  const drillDownHandlers = useMemo(
    () => ({
      handleDrillDown,
      handleInternalDrillDown,
      handleExternalLink,
      handleMergeParams,
      handleBack,
      getExternalUrl,
      isDetailView,
      parentPath,
      currentPath: location.pathname,
      currentSearch: location.search,
    }),
    [
      handleDrillDown,
      handleInternalDrillDown,
      handleExternalLink,
      handleMergeParams,
      handleBack,
      getExternalUrl,
      isDetailView,
      parentPath,
      location.pathname,
      location.search,
    ]
  );

  return (
    <div className={className || ''}>
      {showBackButton && isDetailView && (
        <BackButton onClick={handleBack} />
      )}

      {showBreadcrumb && breadcrumbSegments.length > 1 && (
        <Breadcrumb
          segments={breadcrumbSegments}
          onNavigate={handleBreadcrumbNavigate}
        />
      )}

      {typeof children === 'function'
        ? children(drillDownHandlers)
        : children}
    </div>
  );
}

DrillDownWrapper.propTypes = {
  children: PropTypes.oneOfType([PropTypes.node, PropTypes.func]).isRequired,
  context: PropTypes.shape({
    dashboard: PropTypes.string.isRequired,
    view: PropTypes.string,
    section: PropTypes.string,
  }).isRequired,
  onDrillDown: PropTypes.func,
  params: PropTypes.object,
  externalSystem: PropTypes.oneOf([
    'jira',
    'qtest',
    'sonarqube',
    'github',
    'jenkins',
    'servicenow',
  ]),
  externalBaseUrl: PropTypes.string,
  openExternalInNewTab: PropTypes.bool,
  showBreadcrumb: PropTypes.bool,
  showBackButton: PropTypes.bool,
  className: PropTypes.string,
};

DrillDownWrapper.defaultProps = {
  onDrillDown: null,
  params: null,
  externalSystem: null,
  externalBaseUrl: '',
  openExternalInNewTab: true,
  showBreadcrumb: false,
  showBackButton: false,
  className: '',
};

export default DrillDownWrapper;