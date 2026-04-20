/**
 * Utility functions for drill-down navigation across dashboards.
 * Supports building internal drill-down URLs, generating external system links
 * (Jira, qTest, etc.), formatting breadcrumbs, and parsing URL search params.
 * @module drillDownUtils
 *
 * Related stories: SCRUM-7328, SCRUM-7325
 */

/**
 * @typedef {Object} DrillDownContext
 * @property {string} dashboard - The dashboard identifier (e.g., 'devsecops', 'appdev', 'agile')
 * @property {string} [view] - The specific view within the dashboard (e.g., 'maturity', 'pipeline', 'sprint')
 * @property {string} [section] - A sub-section within the view (e.g., 'security', 'coverage', 'velocity')
 */

/**
 * @typedef {Object} DrillDownParams
 * @property {string} [applicationId] - Application identifier
 * @property {string} [domain] - Domain name
 * @property {string} [team] - Team name
 * @property {string} [sprintId] - Sprint identifier
 * @property {string} [environment] - Environment name (DEV, QA, STAGING, PROD)
 * @property {string} [dateFrom] - Start date in YYYY-MM-DD format
 * @property {string} [dateTo] - End date in YYYY-MM-DD format
 * @property {string} [metricKey] - Specific metric key to focus on
 * @property {string} [severity] - Severity level filter
 * @property {string} [status] - Status filter
 */

/**
 * @typedef {Object} BreadcrumbSegment
 * @property {string} label - Display label for the breadcrumb segment
 * @property {string} path - URL path for the breadcrumb segment
 */

/**
 * Supported external systems for link generation.
 * @readonly
 * @enum {string}
 */
const EXTERNAL_SYSTEMS = {
  JIRA: 'jira',
  QTEST: 'qtest',
  SONARQUBE: 'sonarqube',
  GITHUB: 'github',
  JENKINS: 'jenkins',
  SERVICENOW: 'servicenow',
};

/**
 * Base URL templates for external systems.
 * Uses {id} as a placeholder for the resource identifier.
 * @type {Record<string, string>}
 */
const EXTERNAL_URL_TEMPLATES = {
  [EXTERNAL_SYSTEMS.JIRA]: 'https://jira.horizon-health.com/browse/{id}',
  [EXTERNAL_SYSTEMS.QTEST]: 'https://qtest.horizon-health.com/p/0/portal/project#tab=testexecution&object=3&id={id}',
  [EXTERNAL_SYSTEMS.SONARQUBE]: 'https://sonarqube.horizon-health.com/dashboard?id={id}',
  [EXTERNAL_SYSTEMS.GITHUB]: 'https://github.com/horizon-health/{id}',
  [EXTERNAL_SYSTEMS.JENKINS]: 'https://jenkins.horizon-health.com/job/{id}',
  [EXTERNAL_SYSTEMS.SERVICENOW]: 'https://horizonhealth.service-now.com/nav_to.do?uri=incident.do?sys_id={id}',
};

/**
 * Dashboard path prefix mapping.
 * @type {Record<string, string>}
 */
const DASHBOARD_PATHS = {
  devsecops: '/dashboards/devsecops',
  appdev: '/dashboards/appdev',
  agile: '/dashboards/agile',
  clinical: '/dashboards/clinical',
  operational: '/dashboards/operational',
  financial: '/dashboards/financial',
};

/**
 * Human-readable labels for dashboard identifiers.
 * @type {Record<string, string>}
 */
const DASHBOARD_LABELS = {
  devsecops: 'DevSecOps Maturity',
  appdev: 'Application Development',
  agile: 'Agile Flow & Sprint Analytics',
  clinical: 'Clinical',
  operational: 'Operational',
  financial: 'Financial',
};

/**
 * Human-readable labels for common view identifiers.
 * @type {Record<string, string>}
 */
const VIEW_LABELS = {
  maturity: 'Maturity Assessment',
  pipeline: 'Pipeline Metrics',
  sprint: 'Sprint Details',
  security: 'Security Scans',
  coverage: 'Test Coverage',
  velocity: 'Velocity',
  reliability: 'Reliability',
  techdebt: 'Tech Debt',
  compliance: 'Compliance',
  dora: 'DORA Metrics',
  flow: 'Flow Distribution',
  carryover: 'Carry-Over',
  overview: 'Overview',
  detail: 'Detail',
};

/**
 * Builds a drill-down URL for navigating to a detail view within the application.
 *
 * @param {DrillDownContext} context - The navigation context specifying dashboard, view, and section
 * @param {DrillDownParams} [params={}] - Query parameters to include in the URL
 * @returns {string} The constructed drill-down URL path with query string
 *
 * @example
 * buildDrillDownUrl(
 *   { dashboard: 'devsecops', view: 'security', section: 'findings' },
 *   { applicationId: 'APP-0001', severity: 'Critical' }
 * );
 * // Returns: '/dashboards/devsecops/security/findings?applicationId=APP-0001&severity=Critical'
 */
export function buildDrillDownUrl(context, params = {}) {
  if (!context || typeof context !== 'object') {
    return '/';
  }

  const { dashboard, view, section } = context;

  if (!dashboard || typeof dashboard !== 'string') {
    return '/';
  }

  const basePath = DASHBOARD_PATHS[dashboard.toLowerCase()] || `/dashboards/${encodeURIComponent(dashboard)}`;

  const pathSegments = [basePath];

  if (view && typeof view === 'string') {
    pathSegments.push(encodeURIComponent(view));
  }

  if (section && typeof section === 'string') {
    pathSegments.push(encodeURIComponent(section));
  }

  const fullPath = pathSegments.join('/');

  const queryString = buildQueryString(params);

  if (queryString) {
    return `${fullPath}?${queryString}`;
  }

  return fullPath;
}

/**
 * Builds a query string from a params object, filtering out null, undefined, and empty values.
 *
 * @param {Object} params - Key-value pairs to encode as query parameters
 * @returns {string} Encoded query string without the leading '?', or empty string if no valid params
 */
function buildQueryString(params) {
  if (!params || typeof params !== 'object') {
    return '';
  }

  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      searchParams.set(key, String(value));
    }
  });

  return searchParams.toString();
}

/**
 * Generates an external system URL for a given system and resource identifier.
 * Supports Jira, qTest, SonarQube, GitHub, Jenkins, and ServiceNow.
 *
 * @param {string} system - The external system name (e.g., 'jira', 'qtest', 'sonarqube')
 * @param {string} id - The resource identifier within the external system
 * @param {Object} [options={}] - Additional options for URL generation
 * @param {string} [options.baseUrl] - Override the default base URL for the system
 * @param {Record<string, string>} [options.queryParams] - Additional query parameters to append
 * @returns {string|null} The external URL, or null if the system is not recognized or id is missing
 *
 * @example
 * getExternalLink('jira', 'SCRUM-7328');
 * // Returns: 'https://jira.horizon-health.com/browse/SCRUM-7328'
 *
 * @example
 * getExternalLink('qtest', '12345');
 * // Returns: 'https://qtest.horizon-health.com/p/0/portal/project#tab=testexecution&object=3&id=12345'
 */
export function getExternalLink(system, id, options = {}) {
  if (!system || typeof system !== 'string') {
    return null;
  }

  if (!id || typeof id !== 'string') {
    return null;
  }

  const normalizedSystem = system.trim().toLowerCase();

  if (options.baseUrl && typeof options.baseUrl === 'string') {
    const url = options.baseUrl.replace('{id}', encodeURIComponent(id));
    return appendQueryParams(url, options.queryParams);
  }

  const template = EXTERNAL_URL_TEMPLATES[normalizedSystem];

  if (!template) {
    return null;
  }

  const url = template.replace('{id}', encodeURIComponent(id));

  return appendQueryParams(url, options.queryParams);
}

/**
 * Appends query parameters to a URL string.
 *
 * @param {string} url - The base URL
 * @param {Record<string, string>} [queryParams] - Query parameters to append
 * @returns {string} The URL with appended query parameters
 */
function appendQueryParams(url, queryParams) {
  if (!queryParams || typeof queryParams !== 'object') {
    return url;
  }

  const entries = Object.entries(queryParams).filter(
    ([, value]) => value !== null && value !== undefined && value !== ''
  );

  if (entries.length === 0) {
    return url;
  }

  const separator = url.includes('?') ? '&' : '?';
  const params = entries
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');

  return `${url}${separator}${params}`;
}

/**
 * Formats a URL path into an array of breadcrumb segments with human-readable labels.
 * Each segment includes a label and the cumulative path up to that segment.
 *
 * @param {string} path - The URL path to format (e.g., '/dashboards/devsecops/security/findings')
 * @returns {BreadcrumbSegment[]} Array of breadcrumb segments with label and path
 *
 * @example
 * formatDrillDownBreadcrumb('/dashboards/devsecops/security/findings');
 * // Returns:
 * // [
 * //   { label: 'Home', path: '/' },
 * //   { label: 'DevSecOps Maturity', path: '/dashboards/devsecops' },
 * //   { label: 'Security Scans', path: '/dashboards/devsecops/security' },
 * //   { label: 'Findings', path: '/dashboards/devsecops/security/findings' },
 * // ]
 */
export function formatDrillDownBreadcrumb(path) {
  if (!path || typeof path !== 'string') {
    return [{ label: 'Home', path: '/' }];
  }

  const cleanPath = path.split('?')[0].split('#')[0];

  const segments = cleanPath
    .split('/')
    .filter((segment) => segment !== '');

  const breadcrumbs = [{ label: 'Home', path: '/' }];

  let cumulativePath = '';

  for (let i = 0; i < segments.length; i++) {
    const segment = decodeURIComponent(segments[i]);
    cumulativePath += `/${segments[i]}`;

    // Skip the 'dashboards' prefix segment — it's not meaningful on its own
    if (segment === 'dashboards') {
      continue;
    }

    const label = resolveSegmentLabel(segment, i, segments);

    breadcrumbs.push({
      label,
      path: cumulativePath,
    });
  }

  return breadcrumbs;
}

/**
 * Resolves a human-readable label for a URL path segment.
 *
 * @param {string} segment - The URL segment to resolve
 * @param {number} index - The index of the segment in the path
 * @param {string[]} allSegments - All segments in the path
 * @returns {string} Human-readable label for the segment
 */
function resolveSegmentLabel(segment, index, allSegments) {
  const lowerSegment = segment.toLowerCase();

  // Check dashboard labels first
  if (DASHBOARD_LABELS[lowerSegment]) {
    return DASHBOARD_LABELS[lowerSegment];
  }

  // Check view labels
  if (VIEW_LABELS[lowerSegment]) {
    return VIEW_LABELS[lowerSegment];
  }

  // Check if it looks like an ID (e.g., APP-0001, SPR-0001, SVC-00001)
  if (/^[A-Z]{2,5}-\d+$/i.test(segment)) {
    return segment.toUpperCase();
  }

  // Fallback: capitalize and replace hyphens/underscores with spaces
  return segment
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

/**
 * Parses drill-down parameters from a URLSearchParams object.
 * Extracts known drill-down parameters and returns a typed object.
 * Unknown parameters are collected in an 'extra' property.
 *
 * @param {URLSearchParams} searchParams - The URL search parameters to parse
 * @returns {DrillDownParams & { extra: Record<string, string> }} Parsed drill-down parameters
 *
 * @example
 * const params = new URLSearchParams('applicationId=APP-0001&domain=Claims+Processing&dateFrom=2024-06-01');
 * parseDrillDownParams(params);
 * // Returns:
 * // {
 * //   applicationId: 'APP-0001',
 * //   domain: 'Claims Processing',
 * //   dateFrom: '2024-06-01',
 * //   extra: {},
 * // }
 */
export function parseDrillDownParams(searchParams) {
  const knownKeys = [
    'applicationId',
    'domain',
    'team',
    'sprintId',
    'environment',
    'dateFrom',
    'dateTo',
    'metricKey',
    'severity',
    'status',
  ];

  const result = {
    extra: {},
  };

  if (!searchParams) {
    return result;
  }

  // Support both URLSearchParams instances and plain objects
  const entries = typeof searchParams.entries === 'function'
    ? Array.from(searchParams.entries())
    : Object.entries(searchParams);

  for (const [key, value] of entries) {
    if (value === null || value === undefined || value === '') {
      continue;
    }

    const stringValue = String(value);

    if (knownKeys.includes(key)) {
      result[key] = stringValue;
    } else {
      result.extra[key] = stringValue;
    }
  }

  return result;
}

/**
 * Builds a drill-down URL from the current location by merging new params with existing ones.
 * Useful for adding filters without losing existing drill-down context.
 *
 * @param {string} currentPath - The current URL path
 * @param {string} currentSearch - The current URL search string (with or without leading '?')
 * @param {DrillDownParams} newParams - New parameters to merge
 * @returns {string} The merged URL with updated query parameters
 *
 * @example
 * mergeDrillDownParams(
 *   '/dashboards/devsecops/security',
 *   '?applicationId=APP-0001',
 *   { severity: 'Critical', dateFrom: '2024-06-01' }
 * );
 * // Returns: '/dashboards/devsecops/security?applicationId=APP-0001&severity=Critical&dateFrom=2024-06-01'
 */
export function mergeDrillDownParams(currentPath, currentSearch, newParams) {
  if (!currentPath || typeof currentPath !== 'string') {
    return '/';
  }

  const searchString = currentSearch && typeof currentSearch === 'string'
    ? currentSearch.replace(/^\?/, '')
    : '';

  const existingParams = new URLSearchParams(searchString);

  if (newParams && typeof newParams === 'object') {
    Object.entries(newParams).forEach(([key, value]) => {
      if (value === null || value === undefined || value === '') {
        existingParams.delete(key);
      } else {
        existingParams.set(key, String(value));
      }
    });
  }

  const queryString = existingParams.toString();

  if (queryString) {
    return `${currentPath}?${queryString}`;
  }

  return currentPath;
}

/**
 * Determines if a given path represents a drill-down detail view
 * (i.e., has more than the base dashboard path segments).
 *
 * @param {string} path - The URL path to check
 * @returns {boolean} True if the path is a drill-down detail view
 *
 * @example
 * isDrillDownView('/dashboards/devsecops/security/findings');
 * // Returns: true
 *
 * isDrillDownView('/dashboards/devsecops');
 * // Returns: false
 */
export function isDrillDownView(path) {
  if (!path || typeof path !== 'string') {
    return false;
  }

  const cleanPath = path.split('?')[0].split('#')[0];
  const segments = cleanPath.split('/').filter((s) => s !== '');

  // A drill-down view has more than 2 segments: ['dashboards', '<dashboard>', '<view>', ...]
  return segments.length > 2 && segments[0] === 'dashboards';
}

/**
 * Extracts the parent path from a drill-down URL for "back" navigation.
 *
 * @param {string} path - The current drill-down path
 * @returns {string} The parent path, or '/' if at the top level
 *
 * @example
 * getParentDrillDownPath('/dashboards/devsecops/security/findings');
 * // Returns: '/dashboards/devsecops/security'
 *
 * getParentDrillDownPath('/dashboards/devsecops');
 * // Returns: '/'
 */
export function getParentDrillDownPath(path) {
  if (!path || typeof path !== 'string') {
    return '/';
  }

  const cleanPath = path.split('?')[0].split('#')[0];
  const segments = cleanPath.split('/').filter((s) => s !== '');

  if (segments.length <= 1) {
    return '/';
  }

  segments.pop();
  const parentPath = '/' + segments.join('/');

  return parentPath;
}

export { EXTERNAL_SYSTEMS, DASHBOARD_PATHS, DASHBOARD_LABELS, VIEW_LABELS };