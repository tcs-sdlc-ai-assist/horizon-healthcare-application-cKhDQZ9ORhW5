/**
 * Central data management service for Horizon Healthcare Dashboards.
 *
 * Initializes mock data on first load, provides CRUD operations for dashboard data,
 * handles CSV/Excel import integration (calling csvService and persisting results),
 * applies filter logic to return filtered datasets, and manages editable field updates
 * with audit logging integration.
 *
 * Related stories: SCRUM-7331, SCRUM-7332, SCRUM-7333, SCRUM-7334, SCRUM-7335, SCRUM-7336
 * @module dataService
 */

import { LOCAL_STORAGE_KEYS, AUDIT_ACTIONS } from '@/constants/constants';
import { canImport, canEdit, canExport } from '@/constants/roles';
import { importCSV, importExcel, exportCSV, exportExcel } from '@/services/csvService';
import { logEdit } from '@/services/auditService';
import { getItem, setItem } from '@/services/storageService';
import mockData, {
  applications,
  devReadinessTimeSeries,
  unitTestCoverage,
  securityScanResults,
  deploymentPipelines,
  applicationStatusMatrix,
  doraMetrics,
  reliabilityMetrics,
  techDebtMetrics,
  securityComplianceSnapshots,
  sprintMetrics,
  flowDistribution,
  carryOverTracking,
  scalabilityServices,
  domainSummaries,
} from '@/constants/mockData';

/**
 * @typedef {Object} DataStore
 * @property {Array<Object>} applications
 * @property {Array<Object>} devReadinessTimeSeries
 * @property {Array<Object>} unitTestCoverage
 * @property {Array<Object>} securityScanResults
 * @property {Array<Object>} deploymentPipelines
 * @property {Array<Object>} applicationStatusMatrix
 * @property {Array<Object>} doraMetrics
 * @property {Array<Object>} reliabilityMetrics
 * @property {Array<Object>} techDebtMetrics
 * @property {Array<Object>} securityComplianceSnapshots
 * @property {Array<Object>} sprintMetrics
 * @property {Array<Object>} flowDistribution
 * @property {Array<Object>} carryOverTracking
 * @property {Array<Object>} scalabilityServices
 * @property {Array<Object>} domainSummaries
 */

/**
 * @typedef {Object} FilterParams
 * @property {string} [domain] - Filter by domain name
 * @property {string} [applicationId] - Filter by application ID
 * @property {string} [applicationName] - Filter by application name
 * @property {string} [team] - Filter by team name
 * @property {string} [environment] - Filter by environment (DEV, QA, STAGING, PROD)
 * @property {string} [dateFrom] - Filter entries on or after this ISO date
 * @property {string} [dateTo] - Filter entries on or before this ISO date
 * @property {string} [sprintId] - Filter by sprint ID
 * @property {string} [status] - Filter by status
 * @property {string} [severity] - Filter by severity level
 * @property {string} [scanType] - Filter by scan type (SAST, DAST)
 * @property {string} [tier] - Filter by application tier
 */

/**
 * @typedef {Object} ImportResult
 * @property {boolean} success - Whether the import completed successfully
 * @property {number} importedRecords - Number of records imported
 * @property {number} errorCount - Number of rows that failed validation
 * @property {number} skippedCount - Number of rows skipped
 * @property {Array<Object>} errors - Detailed error list
 * @property {string} message - Human-readable summary message
 */

/**
 * @typedef {Object} EditResult
 * @property {boolean} success - Whether the edit was applied
 * @property {Object} [updatedRecord] - The updated record
 * @property {Object} [auditEntry] - The audit trail entry created
 * @property {string} [error] - Error message if the edit failed
 */

/**
 * Supported data types for retrieval and filtering.
 * @readonly
 * @enum {string}
 */
const DATA_TYPES = {
  APPLICATIONS: 'applications',
  DEV_READINESS: 'devReadinessTimeSeries',
  UNIT_TEST_COVERAGE: 'unitTestCoverage',
  SECURITY_SCANS: 'securityScanResults',
  DEPLOYMENT_PIPELINES: 'deploymentPipelines',
  APPLICATION_STATUS: 'applicationStatusMatrix',
  DORA_METRICS: 'doraMetrics',
  RELIABILITY: 'reliabilityMetrics',
  TECH_DEBT: 'techDebtMetrics',
  SECURITY_COMPLIANCE: 'securityComplianceSnapshots',
  SPRINT_METRICS: 'sprintMetrics',
  FLOW_DISTRIBUTION: 'flowDistribution',
  CARRY_OVER: 'carryOverTracking',
  SCALABILITY_SERVICES: 'scalabilityServices',
  DOMAIN_SUMMARIES: 'domainSummaries',
};

/**
 * Import schemas for CSV/Excel validation per data type.
 * @type {Record<string, Object>}
 */
const IMPORT_SCHEMAS = {
  [DATA_TYPES.APPLICATIONS]: {
    requiredFields: ['id', 'name', 'domain', 'team', 'techStack', 'tier'],
    optionalFields: [],
    primaryKey: 'id',
    fieldSchemas: {
      id: { type: 'string', required: true },
      name: { type: 'string', required: true },
      domain: { type: 'string', required: true },
      team: { type: 'string', required: true },
      techStack: { type: 'string', required: true },
      tier: { type: 'string', required: true },
    },
  },
  [DATA_TYPES.SPRINT_METRICS]: {
    requiredFields: ['sprintId', 'sprintName', 'team', 'domain', 'startDate', 'endDate', 'committed', 'done'],
    optionalFields: ['deployed', 'predictability', 'velocity', 'carryOver', 'storiesCommitted', 'storiesDone', 'storiesDeployed', 'defectsFound', 'defectsFixed'],
    primaryKey: 'sprintId',
    fieldSchemas: {
      sprintId: { type: 'string', required: true },
      sprintName: { type: 'string', required: true },
      team: { type: 'string', required: true },
      domain: { type: 'string', required: true },
      startDate: { type: 'date', required: true },
      endDate: { type: 'date', required: true },
      committed: { type: 'number', required: true, min: 0 },
      done: { type: 'number', required: true, min: 0 },
      deployed: { type: 'number', min: 0 },
      predictability: { type: 'number', min: 0, max: 100 },
      velocity: { type: 'number', min: 0 },
      carryOver: { type: 'number', min: 0 },
      storiesCommitted: { type: 'integer', min: 0 },
      storiesDone: { type: 'integer', min: 0 },
      storiesDeployed: { type: 'integer', min: 0 },
      defectsFound: { type: 'integer', min: 0 },
      defectsFixed: { type: 'integer', min: 0 },
    },
  },
  [DATA_TYPES.DORA_METRICS]: {
    requiredFields: ['applicationId', 'applicationName', 'domain', 'date'],
    optionalFields: ['deployFrequency', 'leadTimeHours', 'changeFailureRate', 'mttrHours'],
    primaryKey: null,
    fieldSchemas: {
      applicationId: { type: 'string', required: true },
      applicationName: { type: 'string', required: true },
      domain: { type: 'string', required: true },
      date: { type: 'date', required: true },
      deployFrequency: { type: 'number', min: 0 },
      leadTimeHours: { type: 'number', min: 0 },
      changeFailureRate: { type: 'number', min: 0, max: 100 },
      mttrHours: { type: 'number', min: 0 },
    },
  },
  [DATA_TYPES.TECH_DEBT]: {
    requiredFields: ['applicationId', 'applicationName', 'domain', 'date', 'debtIndex'],
    optionalFields: ['codeSmells', 'duplications', 'complexityScore', 'outdatedDependencies', 'estimatedRemediationDays'],
    primaryKey: null,
    fieldSchemas: {
      applicationId: { type: 'string', required: true },
      applicationName: { type: 'string', required: true },
      domain: { type: 'string', required: true },
      date: { type: 'date', required: true },
      debtIndex: { type: 'number', required: true, min: 0, max: 100 },
      codeSmells: { type: 'integer', min: 0 },
      duplications: { type: 'number', min: 0, max: 100 },
      complexityScore: { type: 'integer', min: 0 },
      outdatedDependencies: { type: 'integer', min: 0 },
      estimatedRemediationDays: { type: 'integer', min: 0 },
    },
  },
  [DATA_TYPES.SECURITY_SCANS]: {
    requiredFields: ['applicationId', 'applicationName', 'scanType', 'date'],
    optionalFields: ['domain', 'critical', 'high', 'medium', 'low', 'info', 'totalFindings', 'fixedSinceLastScan', 'newSinceLastScan', 'scanDurationMinutes', 'passed'],
    primaryKey: null,
    fieldSchemas: {
      applicationId: { type: 'string', required: true },
      applicationName: { type: 'string', required: true },
      scanType: { type: 'string', required: true, oneOf: ['SAST', 'DAST'] },
      date: { type: 'date', required: true },
      domain: { type: 'string' },
      critical: { type: 'integer', min: 0 },
      high: { type: 'integer', min: 0 },
      medium: { type: 'integer', min: 0 },
      low: { type: 'integer', min: 0 },
      info: { type: 'integer', min: 0 },
      totalFindings: { type: 'integer', min: 0 },
      fixedSinceLastScan: { type: 'integer', min: 0 },
      newSinceLastScan: { type: 'integer', min: 0 },
      scanDurationMinutes: { type: 'number', min: 0 },
      passed: { type: 'boolean' },
    },
  },
};

/**
 * Default import schema for data types without a specific schema.
 * @type {Object}
 */
const DEFAULT_IMPORT_SCHEMA = {
  requiredFields: [],
  optionalFields: [],
  primaryKey: null,
  fieldSchemas: {},
};

/**
 * In-memory data cache. Loaded from localStorage or initialized from mock data.
 * @type {DataStore|null}
 */
let dataCache = null;

/**
 * Storage key for the data records.
 * @type {string}
 */
const DATA_STORAGE_KEY = LOCAL_STORAGE_KEYS.HORIZON_DATA_RECORDS;

/**
 * Reads the data store from localStorage.
 * @returns {DataStore|null} The stored data or null if not found
 */
function readDataStore() {
  try {
    const stored = getItem(DATA_STORAGE_KEY, null);
    if (stored && typeof stored === 'object' && stored.applications) {
      return stored;
    }
    return null;
  } catch (error) {
    console.error('Failed to read data store from localStorage:', error);
    return null;
  }
}

/**
 * Writes the data store to localStorage.
 * @param {DataStore} data - The data store to persist
 * @returns {boolean} Whether the write succeeded
 */
function writeDataStore(data) {
  try {
    const result = setItem(DATA_STORAGE_KEY, data);
    return result.success;
  } catch (error) {
    console.error('Failed to write data store to localStorage:', error);
    return false;
  }
}

/**
 * Returns the default mock data store.
 * @returns {DataStore}
 */
function getDefaultDataStore() {
  return {
    applications: [...applications],
    devReadinessTimeSeries: [...devReadinessTimeSeries],
    unitTestCoverage: [...unitTestCoverage],
    securityScanResults: [...securityScanResults],
    deploymentPipelines: [...deploymentPipelines],
    applicationStatusMatrix: [...applicationStatusMatrix],
    doraMetrics: [...doraMetrics],
    reliabilityMetrics: [...reliabilityMetrics],
    techDebtMetrics: [...techDebtMetrics],
    securityComplianceSnapshots: [...securityComplianceSnapshots],
    sprintMetrics: [...sprintMetrics],
    flowDistribution: [...flowDistribution],
    carryOverTracking: [...carryOverTracking],
    scalabilityServices: [...scalabilityServices],
    domainSummaries: [...domainSummaries],
  };
}

/**
 * Ensures the in-memory data cache is loaded. Reads from localStorage first;
 * if not found, initializes from mock data and persists.
 * @returns {DataStore} The current data store
 */
function ensureDataLoaded() {
  if (dataCache) {
    return dataCache;
  }

  const stored = readDataStore();
  if (stored) {
    dataCache = stored;
    return dataCache;
  }

  dataCache = getDefaultDataStore();
  writeDataStore(dataCache);
  return dataCache;
}

/**
 * Initializes the data store. If data already exists in localStorage, it is loaded.
 * Otherwise, mock data is persisted as the initial dataset.
 *
 * @returns {{ success: boolean, source: string, recordCounts: Record<string, number> }}
 *   Result indicating whether initialization succeeded, the data source, and record counts per type
 */
export function initializeData() {
  try {
    const stored = readDataStore();

    if (stored) {
      dataCache = stored;
      const recordCounts = buildRecordCounts(dataCache);
      return {
        success: true,
        source: 'localStorage',
        recordCounts,
      };
    }

    dataCache = getDefaultDataStore();
    const persisted = writeDataStore(dataCache);

    const recordCounts = buildRecordCounts(dataCache);

    return {
      success: persisted,
      source: 'mockData',
      recordCounts,
    };
  } catch (error) {
    console.error('Failed to initialize data:', error);

    dataCache = getDefaultDataStore();
    const recordCounts = buildRecordCounts(dataCache);

    return {
      success: false,
      source: 'mockData (fallback)',
      recordCounts,
    };
  }
}

/**
 * Builds a record count summary for all data types.
 * @param {DataStore} store - The data store
 * @returns {Record<string, number>}
 */
function buildRecordCounts(store) {
  const counts = {};
  for (const [key, value] of Object.entries(store)) {
    counts[key] = Array.isArray(value) ? value.length : 0;
  }
  return counts;
}

/**
 * Imports data from a CSV or Excel file, validates it against the appropriate schema,
 * and merges the imported records into the data store.
 *
 * @param {File} file - The file to import
 * @param {string} dataType - The data type to import into (must match a DATA_TYPES value)
 * @param {Object} user - The user performing the import
 * @param {string} user.name - The user's display name
 * @param {string} user.role - The user's role
 * @param {Object} [options={}] - Additional import options
 * @param {string} [options.mode='append'] - Import mode: 'append' or 'replace'
 * @param {string|number} [options.sheetName] - Sheet name or index for Excel files
 * @returns {Promise<ImportResult>} Structured import result
 */
export async function importData(file, dataType, user, options = {}) {
  if (!file) {
    return {
      success: false,
      importedRecords: 0,
      errorCount: 1,
      skippedCount: 0,
      errors: [{ row: null, column: null, message: 'No file provided', code: 'NO_FILE' }],
      message: 'No file provided.',
    };
  }

  if (!user || !user.role) {
    return {
      success: false,
      importedRecords: 0,
      errorCount: 1,
      skippedCount: 0,
      errors: [{ row: null, column: null, message: 'User information is required', code: 'NO_USER' }],
      message: 'User information is required.',
    };
  }

  if (!canImport(user.role)) {
    return {
      success: false,
      importedRecords: 0,
      errorCount: 1,
      skippedCount: 0,
      errors: [{ row: null, column: null, message: 'Access denied: insufficient role for import', code: 'ACCESS_DENIED' }],
      message: 'Access denied: your role does not have import permissions.',
    };
  }

  const store = ensureDataLoaded();

  if (!store[dataType] && !Object.values(DATA_TYPES).includes(dataType)) {
    return {
      success: false,
      importedRecords: 0,
      errorCount: 1,
      skippedCount: 0,
      errors: [{ row: null, column: null, message: `Unknown data type: "${dataType}"`, code: 'UNKNOWN_DATA_TYPE' }],
      message: `Unknown data type: "${dataType}".`,
    };
  }

  const schema = IMPORT_SCHEMAS[dataType] || DEFAULT_IMPORT_SCHEMA;
  const fileName = file.name || '';
  const isExcel = /\.(xlsx|xls)$/i.test(fileName);

  let parseResult;

  try {
    if (isExcel) {
      parseResult = await importExcel(file, schema, { sheetName: options.sheetName });
    } else {
      parseResult = await importCSV(file, schema);
    }
  } catch (error) {
    return {
      success: false,
      importedRecords: 0,
      errorCount: 1,
      skippedCount: 0,
      errors: [{ row: null, column: null, message: `File parsing failed: ${error.message}`, code: 'PARSE_ERROR' }],
      message: `File parsing failed: ${error.message}`,
    };
  }

  if (!parseResult.success && parseResult.data.length === 0) {
    return {
      success: false,
      importedRecords: 0,
      errorCount: parseResult.errorCount,
      skippedCount: parseResult.skippedCount,
      errors: parseResult.errors,
      message: `Import failed with ${parseResult.errorCount} error(s).`,
    };
  }

  const importedData = parseResult.data;

  if (importedData.length === 0) {
    return {
      success: true,
      importedRecords: 0,
      errorCount: parseResult.errorCount,
      skippedCount: parseResult.skippedCount,
      errors: parseResult.errors,
      message: 'No valid records found to import.',
    };
  }

  const mode = options.mode || 'append';

  if (mode === 'replace') {
    store[dataType] = importedData;
  } else {
    if (!Array.isArray(store[dataType])) {
      store[dataType] = [];
    }
    store[dataType] = [...store[dataType], ...importedData];
  }

  dataCache = store;
  writeDataStore(store);

  try {
    await logEdit({
      user: user.name || 'Unknown',
      action: AUDIT_ACTIONS.IMPORT,
      entityType: dataType,
      entityId: '',
      description: `Imported ${importedData.length} records into ${dataType} (mode: ${mode}) from file "${fileName}"`,
      oldValue: null,
      newValue: { recordCount: importedData.length, mode, fileName },
    });
  } catch (auditError) {
    console.error('Failed to log import audit entry:', auditError);
  }

  return {
    success: true,
    importedRecords: importedData.length,
    errorCount: parseResult.errorCount,
    skippedCount: parseResult.skippedCount,
    errors: parseResult.errors,
    message: `Successfully imported ${importedData.length} records into ${dataType}.${parseResult.errorCount > 0 ? ` ${parseResult.errorCount} row(s) had errors.` : ''}`,
  };
}

/**
 * Applies filter parameters to a dataset array.
 * @param {Array<Object>} data - The dataset to filter
 * @param {FilterParams} filters - The filter parameters
 * @returns {Array<Object>} Filtered dataset
 */
function applyFilters(data, filters) {
  if (!Array.isArray(data) || data.length === 0) {
    return [];
  }

  if (!filters || typeof filters !== 'object') {
    return data;
  }

  let filtered = data;

  if (filters.domain) {
    const domainLower = filters.domain.toLowerCase();
    filtered = filtered.filter((item) => {
      const itemDomain = item.domain || '';
      return itemDomain.toLowerCase() === domainLower;
    });
  }

  if (filters.applicationId) {
    filtered = filtered.filter((item) => item.applicationId === filters.applicationId);
  }

  if (filters.applicationName) {
    const nameLower = filters.applicationName.toLowerCase();
    filtered = filtered.filter((item) => {
      const itemName = item.applicationName || item.name || '';
      return itemName.toLowerCase().includes(nameLower);
    });
  }

  if (filters.team) {
    const teamLower = filters.team.toLowerCase();
    filtered = filtered.filter((item) => {
      const itemTeam = item.team || '';
      return itemTeam.toLowerCase() === teamLower;
    });
  }

  if (filters.environment) {
    const envUpper = filters.environment.toUpperCase();
    filtered = filtered.filter((item) => {
      const itemEnv = item.environment || '';
      return itemEnv.toUpperCase() === envUpper;
    });
  }

  if (filters.dateFrom) {
    const fromDate = new Date(filters.dateFrom);
    if (!isNaN(fromDate.getTime())) {
      filtered = filtered.filter((item) => {
        const itemDate = item.date || item.startDate;
        if (!itemDate) return true;
        return new Date(itemDate) >= fromDate;
      });
    }
  }

  if (filters.dateTo) {
    const toDate = new Date(filters.dateTo);
    if (!isNaN(toDate.getTime())) {
      toDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter((item) => {
        const itemDate = item.date || item.endDate || item.startDate;
        if (!itemDate) return true;
        return new Date(itemDate) <= toDate;
      });
    }
  }

  if (filters.sprintId) {
    filtered = filtered.filter((item) => item.sprintId === filters.sprintId);
  }

  if (filters.status) {
    const statusLower = filters.status.toLowerCase();
    filtered = filtered.filter((item) => {
      const itemStatus = item.status || '';
      return itemStatus.toLowerCase() === statusLower;
    });
  }

  if (filters.severity) {
    const severityLower = filters.severity.toLowerCase();
    filtered = filtered.filter((item) => {
      const itemSeverity = item.severity || item.riskRating || '';
      return itemSeverity.toLowerCase() === severityLower;
    });
  }

  if (filters.scanType) {
    const scanTypeUpper = filters.scanType.toUpperCase();
    filtered = filtered.filter((item) => {
      const itemScanType = item.scanType || '';
      return itemScanType.toUpperCase() === scanTypeUpper;
    });
  }

  if (filters.tier) {
    const tierLower = filters.tier.toLowerCase();
    filtered = filtered.filter((item) => {
      const itemTier = item.tier || '';
      return itemTier.toLowerCase() === tierLower;
    });
  }

  return filtered;
}

/**
 * Retrieves filtered data for a specific data type.
 *
 * @param {FilterParams} [filters={}] - Filter parameters to apply
 * @param {string} dataType - The data type to retrieve (must match a DATA_TYPES value)
 * @returns {{ success: boolean, data: Array<Object>, totalCount: number, filteredCount: number, error?: string }}
 *   Result containing the filtered data and counts
 */
export function getFilteredData(filters = {}, dataType) {
  try {
    const store = ensureDataLoaded();

    if (!dataType) {
      return {
        success: false,
        data: [],
        totalCount: 0,
        filteredCount: 0,
        error: 'Data type is required.',
      };
    }

    const dataset = store[dataType];

    if (!Array.isArray(dataset)) {
      return {
        success: false,
        data: [],
        totalCount: 0,
        filteredCount: 0,
        error: `Unknown or empty data type: "${dataType}".`,
      };
    }

    const totalCount = dataset.length;
    const filteredData = applyFilters(dataset, filters);

    return {
      success: true,
      data: filteredData,
      totalCount,
      filteredCount: filteredData.length,
    };
  } catch (error) {
    console.error('Failed to get filtered data:', error);
    return {
      success: false,
      data: [],
      totalCount: 0,
      filteredCount: 0,
      error: `Failed to retrieve data: ${error.message}`,
    };
  }
}

/**
 * Retrieves all data for a specific data type without filtering.
 *
 * @param {string} dataType - The data type to retrieve
 * @returns {Array<Object>} The full dataset for the given type
 */
export function getAllData(dataType) {
  const store = ensureDataLoaded();
  const dataset = store[dataType];
  return Array.isArray(dataset) ? dataset : [];
}

/**
 * Finds a record by its ID within a specific data type.
 *
 * @param {string} dataType - The data type to search
 * @param {string} recordId - The record ID to find
 * @param {string} [idField='id'] - The field name used as the record identifier
 * @returns {Object|null} The found record or null
 */
export function findRecordById(dataType, recordId, idField = 'id') {
  const store = ensureDataLoaded();
  const dataset = store[dataType];

  if (!Array.isArray(dataset)) {
    return null;
  }

  const possibleIdFields = [idField, 'id', 'applicationId', 'sprintId', 'pipelineRunId'];

  for (const field of possibleIdFields) {
    const found = dataset.find((item) => item[field] === recordId);
    if (found) {
      return found;
    }
  }

  return null;
}

/**
 * Edits a field on a record, enforces RBAC, and logs an audit trail entry.
 *
 * @param {string} recordId - The ID of the record to edit
 * @param {string} field - The field name to update
 * @param {*} newValue - The new value for the field
 * @param {Object} user - The user performing the edit
 * @param {string} user.name - The user's display name
 * @param {string} user.role - The user's role
 * @param {Object} [options={}] - Additional options
 * @param {string} [options.dataType] - The data type containing the record (auto-detected if not provided)
 * @param {string} [options.idField='id'] - The field name used as the record identifier
 * @returns {Promise<EditResult>} Result of the edit operation
 */
export async function editField(recordId, field, newValue, user, options = {}) {
  if (!recordId || typeof recordId !== 'string') {
    return {
      success: false,
      error: 'Record ID must be a non-empty string.',
    };
  }

  if (!field || typeof field !== 'string') {
    return {
      success: false,
      error: 'Field name must be a non-empty string.',
    };
  }

  if (!user || !user.role) {
    return {
      success: false,
      error: 'User information with role is required.',
    };
  }

  if (!canEdit(user.role)) {
    return {
      success: false,
      error: 'Access denied: your role does not have edit permissions.',
    };
  }

  const store = ensureDataLoaded();
  const idField = options.idField || 'id';
  let targetDataType = options.dataType || null;
  let targetRecord = null;
  let targetIndex = -1;

  if (targetDataType) {
    const dataset = store[targetDataType];
    if (Array.isArray(dataset)) {
      const possibleIdFields = [idField, 'id', 'applicationId', 'sprintId', 'pipelineRunId'];
      for (const field_ of possibleIdFields) {
        targetIndex = dataset.findIndex((item) => item[field_] === recordId);
        if (targetIndex !== -1) {
          targetRecord = dataset[targetIndex];
          break;
        }
      }
    }
  } else {
    for (const [key, dataset] of Object.entries(store)) {
      if (!Array.isArray(dataset)) continue;

      const possibleIdFields = [idField, 'id', 'applicationId', 'sprintId', 'pipelineRunId'];
      for (const field_ of possibleIdFields) {
        const idx = dataset.findIndex((item) => item[field_] === recordId);
        if (idx !== -1) {
          targetDataType = key;
          targetIndex = idx;
          targetRecord = dataset[idx];
          break;
        }
      }
      if (targetRecord) break;
    }
  }

  if (!targetRecord || targetIndex === -1 || !targetDataType) {
    return {
      success: false,
      error: `Record with ID "${recordId}" not found.`,
    };
  }

  const oldValue = targetRecord[field];

  if (oldValue === newValue) {
    return {
      success: false,
      error: 'No change detected: new value is the same as the current value.',
    };
  }

  const updatedRecord = { ...targetRecord, [field]: newValue, lastUpdated: new Date().toISOString() };
  store[targetDataType][targetIndex] = updatedRecord;

  dataCache = store;
  writeDataStore(store);

  let auditEntry = null;
  try {
    auditEntry = await logEdit({
      user: user.name || 'Unknown',
      action: AUDIT_ACTIONS.UPDATE,
      fieldName: field,
      oldValue,
      newValue,
      entityType: targetDataType,
      entityId: recordId,
      description: `Updated field "${field}" on ${targetDataType} record "${recordId}"`,
    });
  } catch (auditError) {
    console.error('Failed to log edit audit entry:', auditError);
  }

  return {
    success: true,
    updatedRecord,
    auditEntry,
  };
}

/**
 * Exports data for a specific data type in the requested format.
 *
 * @param {string} dataType - The data type to export
 * @param {string} [format='csv'] - The export format ('csv' or 'excel')
 * @param {Object} [user=null] - The user performing the export (for RBAC check)
 * @param {string} [user.name] - The user's display name
 * @param {string} [user.role] - The user's role
 * @param {Object} [options={}] - Additional export options
 * @param {FilterParams} [options.filters] - Filters to apply before export
 * @param {string[]} [options.columns] - Specific columns to include
 * @param {Object.<string, string>} [options.columnLabels] - Column label overrides
 * @returns {Promise<{ success: boolean, message: string, rowCount: number, error?: string }>}
 */
export async function exportData(dataType, format = 'csv', user = null, options = {}) {
  if (user && user.role && !canExport(user.role)) {
    return {
      success: false,
      message: 'Access denied: your role does not have export permissions.',
      rowCount: 0,
      error: 'Access denied: insufficient role for export.',
    };
  }

  const store = ensureDataLoaded();
  const dataset = store[dataType];

  if (!Array.isArray(dataset)) {
    return {
      success: false,
      message: `Unknown or empty data type: "${dataType}".`,
      rowCount: 0,
      error: `Unknown data type: "${dataType}".`,
    };
  }

  const dataToExport = options.filters
    ? applyFilters(dataset, options.filters)
    : dataset;

  if (dataToExport.length === 0) {
    return {
      success: true,
      message: 'No data to export.',
      rowCount: 0,
    };
  }

  const filename = `horizon_${dataType}_${new Date().toISOString().split('T')[0]}`;
  const exportOptions = {
    columns: options.columns,
    columnLabels: options.columnLabels,
  };

  let result;

  if (format === 'excel' || format === 'xlsx') {
    result = exportExcel(dataToExport, filename, {
      ...exportOptions,
      sheetName: dataType,
    });
  } else {
    result = exportCSV(dataToExport, filename, exportOptions);
  }

  if (user && user.name) {
    try {
      await logEdit({
        user: user.name,
        action: AUDIT_ACTIONS.EXPORT,
        entityType: dataType,
        entityId: '',
        description: `Exported ${dataToExport.length} records from ${dataType} as ${format}`,
        oldValue: null,
        newValue: { recordCount: dataToExport.length, format, filename },
      });
    } catch (auditError) {
      console.error('Failed to log export audit entry:', auditError);
    }
  }

  return result;
}

/**
 * Resets the data store to the default mock data.
 * Useful for development and testing.
 *
 * @param {Object} [user=null] - The user performing the reset
 * @param {string} [user.name] - The user's display name
 * @returns {Promise<{ success: boolean, message: string }>}
 */
export async function resetData(user = null) {
  try {
    dataCache = getDefaultDataStore();
    writeDataStore(dataCache);

    if (user && user.name) {
      try {
        await logEdit({
          user: user.name,
          action: AUDIT_ACTIONS.DELETE,
          entityType: 'all',
          entityId: '',
          description: 'Reset all data to default mock data',
          oldValue: null,
          newValue: null,
        });
      } catch (auditError) {
        console.error('Failed to log reset audit entry:', auditError);
      }
    }

    return {
      success: true,
      message: 'Data has been reset to default mock data.',
    };
  } catch (error) {
    console.error('Failed to reset data:', error);
    return {
      success: false,
      message: `Failed to reset data: ${error.message}`,
    };
  }
}

/**
 * Returns the list of available data types.
 * @returns {Record<string, string>} Map of data type keys to values
 */
export function getDataTypes() {
  return { ...DATA_TYPES };
}

/**
 * Returns the import schema for a given data type.
 * @param {string} dataType - The data type
 * @returns {Object} The import schema
 */
export function getImportSchema(dataType) {
  return IMPORT_SCHEMAS[dataType] || DEFAULT_IMPORT_SCHEMA;
}

/**
 * Returns unique values for a given field across a data type.
 * Useful for populating filter dropdowns.
 *
 * @param {string} dataType - The data type to query
 * @param {string} fieldName - The field to extract unique values from
 * @returns {string[]} Sorted array of unique values
 */
export function getUniqueFieldValues(dataType, fieldName) {
  const store = ensureDataLoaded();
  const dataset = store[dataType];

  if (!Array.isArray(dataset) || !fieldName) {
    return [];
  }

  const uniqueValues = new Set();

  dataset.forEach((item) => {
    const value = item[fieldName];
    if (value !== null && value !== undefined && value !== '') {
      uniqueValues.add(String(value));
    }
  });

  return Array.from(uniqueValues).sort();
}

/**
 * Returns record counts for all data types.
 * @returns {Record<string, number>}
 */
export function getRecordCounts() {
  const store = ensureDataLoaded();
  return buildRecordCounts(store);
}

export { DATA_TYPES, IMPORT_SCHEMAS };

const dataService = {
  initializeData,
  importData,
  getFilteredData,
  getAllData,
  findRecordById,
  editField,
  exportData,
  resetData,
  getDataTypes,
  getImportSchema,
  getUniqueFieldValues,
  getRecordCounts,
  DATA_TYPES,
};

export default dataService;