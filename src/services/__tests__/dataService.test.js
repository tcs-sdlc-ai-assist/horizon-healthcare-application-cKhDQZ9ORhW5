import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LOCAL_STORAGE_KEYS, AUDIT_ACTIONS } from '../../constants/constants.js';

// Mock auditService
vi.mock('../auditService.js', () => ({
  logEdit: vi.fn(async (params) => ({
    id: `AUD-mock-${Date.now()}`,
    ...params,
    timestamp: new Date().toISOString(),
    hash: 'mock-hash',
    previousHash: '',
    reverted: false,
    revertedBy: null,
  })),
}));

// Mock csvService
vi.mock('../csvService.js', () => ({
  importCSV: vi.fn(),
  importExcel: vi.fn(),
  exportCSV: vi.fn(),
  exportExcel: vi.fn(),
}));

// Mock storageService
vi.mock('../storageService.js', () => {
  const store = {};
  return {
    getItem: vi.fn((key, defaultValue = null) => {
      const namespacedKey = key.startsWith('horizon_') ? key : `horizon_${key}`;
      const raw = localStorage.getItem(namespacedKey);
      if (raw === null) return defaultValue;
      try {
        return JSON.parse(raw);
      } catch {
        return raw;
      }
    }),
    setItem: vi.fn((key, value) => {
      const namespacedKey = key.startsWith('horizon_') ? key : `horizon_${key}`;
      try {
        localStorage.setItem(namespacedKey, JSON.stringify(value));
        return { success: true, error: null };
      } catch (error) {
        return { success: false, error: error.message };
      }
    }),
    removeItem: vi.fn(),
    clear: vi.fn(),
    default: {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    },
  };
});

// Mock hashUtils to avoid Web Crypto API issues
vi.mock('../../utils/hashUtils.js', () => {
  let hashCounter = 0;
  return {
    generateHash: vi.fn(async () => {
      hashCounter++;
      return `mock-hash-${hashCounter}`;
    }),
    verifyChain: vi.fn(async () => ({
      valid: true,
      brokenAt: null,
      message: 'Chain integrity verified successfully.',
    })),
  };
});

import { logEdit } from '../auditService.js';
import { importCSV, importExcel, exportCSV, exportExcel } from '../csvService.js';
import { getItem, setItem } from '../storageService.js';

// We need to dynamically import dataService after mocks are set up
// to ensure the mocks are in place when the module initializes
let dataService;
let initializeData;
let getFilteredData;
let getAllData;
let findRecordById;
let editField;
let importData;
let exportData;
let resetData;
let getDataTypes;
let getImportSchema;
let getUniqueFieldValues;
let getRecordCounts;
let DATA_TYPES;

describe('dataService', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    localStorage.clear();

    // Reset the module cache so dataCache is null on each test
    vi.resetModules();

    // Re-import after reset
    const mod = await import('../dataService.js');
    dataService = mod.default;
    initializeData = mod.initializeData;
    getFilteredData = mod.getFilteredData;
    getAllData = mod.getAllData;
    findRecordById = mod.findRecordById;
    editField = mod.editField;
    importData = mod.importData;
    exportData = mod.exportData;
    resetData = mod.resetData;
    getDataTypes = mod.getDataTypes;
    getImportSchema = mod.getImportSchema;
    getUniqueFieldValues = mod.getUniqueFieldValues;
    getRecordCounts = mod.getRecordCounts;
    DATA_TYPES = mod.DATA_TYPES;
  });

  afterEach(() => {
    localStorage.clear();
  });

  // ============================================================
  // initializeData
  // ============================================================
  describe('initializeData', () => {
    it('initializes data from mock data when localStorage is empty', () => {
      const result = initializeData();

      expect(result.success).toBe(true);
      expect(result.source).toBe('mockData');
      expect(result.recordCounts).toBeDefined();
      expect(result.recordCounts.applications).toBeGreaterThan(0);
      expect(result.recordCounts.sprintMetrics).toBeGreaterThan(0);
      expect(result.recordCounts.doraMetrics).toBeGreaterThan(0);
    });

    it('returns record counts for all data types', () => {
      const result = initializeData();

      expect(result.recordCounts).toHaveProperty('applications');
      expect(result.recordCounts).toHaveProperty('devReadinessTimeSeries');
      expect(result.recordCounts).toHaveProperty('unitTestCoverage');
      expect(result.recordCounts).toHaveProperty('securityScanResults');
      expect(result.recordCounts).toHaveProperty('deploymentPipelines');
      expect(result.recordCounts).toHaveProperty('applicationStatusMatrix');
      expect(result.recordCounts).toHaveProperty('doraMetrics');
      expect(result.recordCounts).toHaveProperty('reliabilityMetrics');
      expect(result.recordCounts).toHaveProperty('techDebtMetrics');
      expect(result.recordCounts).toHaveProperty('securityComplianceSnapshots');
      expect(result.recordCounts).toHaveProperty('sprintMetrics');
      expect(result.recordCounts).toHaveProperty('flowDistribution');
      expect(result.recordCounts).toHaveProperty('carryOverTracking');
      expect(result.recordCounts).toHaveProperty('scalabilityServices');
      expect(result.recordCounts).toHaveProperty('domainSummaries');
    });

    it('loads data from localStorage when previously persisted', () => {
      // First initialize to persist data
      initializeData();

      // Reset modules to simulate fresh load
      // Since we can't easily reset modules mid-test, we call initializeData again
      // which should detect data in localStorage
      const result = initializeData();

      expect(result.success).toBe(true);
      expect(result.recordCounts.applications).toBeGreaterThan(0);
    });
  });

  // ============================================================
  // getFilteredData
  // ============================================================
  describe('getFilteredData', () => {
    beforeEach(() => {
      initializeData();
    });

    it('returns error when dataType is not provided', () => {
      const result = getFilteredData({});

      expect(result.success).toBe(false);
      expect(result.error).toContain('Data type is required');
      expect(result.data).toEqual([]);
    });

    it('returns error for unknown data type', () => {
      const result = getFilteredData({}, 'nonExistentType');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown or empty data type');
      expect(result.data).toEqual([]);
    });

    it('returns all applications when no filters are applied', () => {
      const result = getFilteredData({}, 'applications');

      expect(result.success).toBe(true);
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.totalCount).toBe(result.data.length);
      expect(result.filteredCount).toBe(result.totalCount);
    });

    it('filters applications by domain', () => {
      const result = getFilteredData({ domain: 'Claims Processing' }, 'applications');

      expect(result.success).toBe(true);
      expect(result.filteredCount).toBeGreaterThan(0);
      expect(result.filteredCount).toBeLessThanOrEqual(result.totalCount);
      result.data.forEach((app) => {
        expect(app.domain.toLowerCase()).toBe('claims processing');
      });
    });

    it('filters sprint metrics by team', () => {
      const allSprints = getFilteredData({}, 'sprintMetrics');
      const firstTeam = allSprints.data[0]?.team;

      if (firstTeam) {
        const result = getFilteredData({ team: firstTeam }, 'sprintMetrics');

        expect(result.success).toBe(true);
        expect(result.filteredCount).toBeGreaterThan(0);
        result.data.forEach((sprint) => {
          expect(sprint.team.toLowerCase()).toBe(firstTeam.toLowerCase());
        });
      }
    });

    it('filters application status by environment', () => {
      const result = getFilteredData({ environment: 'PROD' }, 'applicationStatusMatrix');

      expect(result.success).toBe(true);
      expect(result.filteredCount).toBeGreaterThan(0);
      result.data.forEach((entry) => {
        expect(entry.environment.toUpperCase()).toBe('PROD');
      });
    });

    it('filters DORA metrics by applicationId', () => {
      const allDora = getFilteredData({}, 'doraMetrics');
      const firstAppId = allDora.data[0]?.applicationId;

      if (firstAppId) {
        const result = getFilteredData({ applicationId: firstAppId }, 'doraMetrics');

        expect(result.success).toBe(true);
        expect(result.filteredCount).toBeGreaterThan(0);
        result.data.forEach((entry) => {
          expect(entry.applicationId).toBe(firstAppId);
        });
      }
    });

    it('filters security scans by scanType', () => {
      const result = getFilteredData({ scanType: 'SAST' }, 'securityScanResults');

      expect(result.success).toBe(true);
      expect(result.filteredCount).toBeGreaterThan(0);
      result.data.forEach((entry) => {
        expect(entry.scanType.toUpperCase()).toBe('SAST');
      });
    });

    it('filters by applicationName with partial match', () => {
      const result = getFilteredData({ applicationName: 'Claims' }, 'doraMetrics');

      expect(result.success).toBe(true);
      expect(result.filteredCount).toBeGreaterThan(0);
      result.data.forEach((entry) => {
        expect(entry.applicationName.toLowerCase()).toContain('claims');
      });
    });

    it('filters by date range', () => {
      const result = getFilteredData(
        { dateFrom: '2024-06-01', dateTo: '2024-12-31' },
        'doraMetrics'
      );

      expect(result.success).toBe(true);
      result.data.forEach((entry) => {
        const entryDate = new Date(entry.date);
        expect(entryDate >= new Date('2024-06-01')).toBe(true);
        expect(entryDate <= new Date('2024-12-31T23:59:59.999')).toBe(true);
      });
    });

    it('combines multiple filters', () => {
      const result = getFilteredData(
        { domain: 'Claims Processing', environment: 'PROD' },
        'applicationStatusMatrix'
      );

      expect(result.success).toBe(true);
      result.data.forEach((entry) => {
        expect(entry.domain.toLowerCase()).toBe('claims processing');
        expect(entry.environment.toUpperCase()).toBe('PROD');
      });
    });

    it('returns empty data when filters match nothing', () => {
      const result = getFilteredData(
        { domain: 'NonExistentDomain' },
        'applications'
      );

      expect(result.success).toBe(true);
      expect(result.filteredCount).toBe(0);
      expect(result.data).toEqual([]);
    });

    it('filters applications by tier', () => {
      const result = getFilteredData({ tier: 'Tier 1' }, 'applications');

      expect(result.success).toBe(true);
      expect(result.filteredCount).toBeGreaterThan(0);
      result.data.forEach((app) => {
        expect(app.tier.toLowerCase()).toBe('tier 1');
      });
    });
  });

  // ============================================================
  // getAllData
  // ============================================================
  describe('getAllData', () => {
    beforeEach(() => {
      initializeData();
    });

    it('returns all data for a valid data type', () => {
      const data = getAllData('applications');

      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
    });

    it('returns empty array for unknown data type', () => {
      const data = getAllData('nonExistentType');

      expect(Array.isArray(data)).toBe(true);
      expect(data).toEqual([]);
    });
  });

  // ============================================================
  // findRecordById
  // ============================================================
  describe('findRecordById', () => {
    beforeEach(() => {
      initializeData();
    });

    it('finds an application by its id', () => {
      const allApps = getAllData('applications');
      const firstApp = allApps[0];

      const found = findRecordById('applications', firstApp.id);

      expect(found).not.toBeNull();
      expect(found.id).toBe(firstApp.id);
      expect(found.name).toBe(firstApp.name);
    });

    it('finds a sprint by sprintId', () => {
      const allSprints = getAllData('sprintMetrics');
      const firstSprint = allSprints[0];

      const found = findRecordById('sprintMetrics', firstSprint.sprintId, 'sprintId');

      expect(found).not.toBeNull();
      expect(found.sprintId).toBe(firstSprint.sprintId);
    });

    it('returns null for non-existent record', () => {
      const found = findRecordById('applications', 'NON-EXISTENT-ID');

      expect(found).toBeNull();
    });

    it('returns null for unknown data type', () => {
      const found = findRecordById('nonExistentType', 'some-id');

      expect(found).toBeNull();
    });
  });

  // ============================================================
  // editField
  // ============================================================
  describe('editField', () => {
    const adminUser = { name: 'Sarah Chen', role: 'Admin' };
    const viewerUser = { name: 'Lisa Anderson', role: 'View-Only' };
    const developerUser = { name: 'Emily Johnson', role: 'Developer' };

    beforeEach(() => {
      initializeData();
    });

    it('successfully edits a field on an application record', async () => {
      const allApps = getAllData('applications');
      const targetApp = allApps[0];

      const result = await editField(
        targetApp.id,
        'techStack',
        'Python/Django',
        adminUser,
        { dataType: 'applications' }
      );

      expect(result.success).toBe(true);
      expect(result.updatedRecord).toBeDefined();
      expect(result.updatedRecord.techStack).toBe('Python/Django');
      expect(result.updatedRecord.lastUpdated).toBeDefined();
      expect(result.auditEntry).toBeDefined();
    });

    it('logs an audit entry when editing a field', async () => {
      const { logEdit: mockLogEdit } = await import('../auditService.js');
      const allApps = getAllData('applications');
      const targetApp = allApps[0];

      await editField(
        targetApp.id,
        'tier',
        'Tier 2',
        adminUser,
        { dataType: 'applications' }
      );

      expect(mockLogEdit).toHaveBeenCalledWith(
        expect.objectContaining({
          user: 'Sarah Chen',
          action: AUDIT_ACTIONS.UPDATE,
          fieldName: 'tier',
          oldValue: targetApp.tier,
          newValue: 'Tier 2',
          entityType: 'applications',
          entityId: targetApp.id,
        })
      );
    });

    it('rejects edit when user role lacks edit permissions', async () => {
      const allApps = getAllData('applications');
      const targetApp = allApps[0];

      const result = await editField(
        targetApp.id,
        'techStack',
        'Go/gRPC',
        viewerUser,
        { dataType: 'applications' }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Access denied');
    });

    it('allows edit for developer role', async () => {
      const allApps = getAllData('applications');
      const targetApp = allApps[0];

      const result = await editField(
        targetApp.id,
        'techStack',
        'Rust/Actix',
        developerUser,
        { dataType: 'applications' }
      );

      expect(result.success).toBe(true);
      expect(result.updatedRecord.techStack).toBe('Rust/Actix');
    });

    it('returns error when record ID is empty', async () => {
      const result = await editField('', 'techStack', 'Go', adminUser);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Record ID must be a non-empty string');
    });

    it('returns error when field name is empty', async () => {
      const result = await editField('APP-0001', '', 'Go', adminUser);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Field name must be a non-empty string');
    });

    it('returns error when user is missing', async () => {
      const result = await editField('APP-0001', 'techStack', 'Go', null);

      expect(result.success).toBe(false);
      expect(result.error).toContain('User information with role is required');
    });

    it('returns error when record is not found', async () => {
      const result = await editField(
        'NON-EXISTENT-ID',
        'techStack',
        'Go',
        adminUser,
        { dataType: 'applications' }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('returns error when new value is same as current value', async () => {
      const allApps = getAllData('applications');
      const targetApp = allApps[0];

      const result = await editField(
        targetApp.id,
        'techStack',
        targetApp.techStack,
        adminUser,
        { dataType: 'applications' }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('No change detected');
    });

    it('auto-detects data type when not provided', async () => {
      const allApps = getAllData('applications');
      const targetApp = allApps[0];

      const result = await editField(
        targetApp.id,
        'techStack',
        'Elixir/Phoenix',
        adminUser
      );

      expect(result.success).toBe(true);
      expect(result.updatedRecord.techStack).toBe('Elixir/Phoenix');
    });

    it('persists the edit to the data store', async () => {
      const allApps = getAllData('applications');
      const targetApp = allApps[0];

      await editField(
        targetApp.id,
        'techStack',
        'Scala/Play',
        adminUser,
        { dataType: 'applications' }
      );

      const updatedApp = findRecordById('applications', targetApp.id);
      expect(updatedApp.techStack).toBe('Scala/Play');
    });
  });

  // ============================================================
  // importData
  // ============================================================
  describe('importData', () => {
    const adminUser = { name: 'Sarah Chen', role: 'Admin' };
    const viewerUser = { name: 'Lisa Anderson', role: 'View-Only' };
    const qeLeadUser = { name: 'David Kim', role: 'QE Lead' };

    beforeEach(() => {
      initializeData();
    });

    it('returns error when no file is provided', async () => {
      const result = await importData(null, 'applications', adminUser);

      expect(result.success).toBe(false);
      expect(result.errors[0].code).toBe('NO_FILE');
      expect(result.importedRecords).toBe(0);
    });

    it('returns error when user is missing', async () => {
      const file = new File(['data'], 'test.csv', { type: 'text/csv' });

      const result = await importData(file, 'applications', null);

      expect(result.success).toBe(false);
      expect(result.errors[0].code).toBe('NO_USER');
    });

    it('returns error when user role lacks import permissions', async () => {
      const file = new File(['data'], 'test.csv', { type: 'text/csv' });

      const result = await importData(file, 'applications', viewerUser);

      expect(result.success).toBe(false);
      expect(result.errors[0].code).toBe('ACCESS_DENIED');
      expect(result.message).toContain('Access denied');
    });

    it('returns error for unknown data type', async () => {
      const file = new File(['data'], 'test.csv', { type: 'text/csv' });

      const result = await importData(file, 'unknownType', adminUser);

      expect(result.success).toBe(false);
      expect(result.errors[0].code).toBe('UNKNOWN_DATA_TYPE');
    });

    it('successfully imports valid CSV data', async () => {
      const { importCSV: mockImportCSV } = await import('../csvService.js');
      mockImportCSV.mockResolvedValue({
        success: true,
        data: [
          { id: 'APP-NEW-001', name: 'NewApp1', domain: 'Clinical', team: 'Alpha Squad', techStack: 'Go/gRPC', tier: 'Tier 1' },
          { id: 'APP-NEW-002', name: 'NewApp2', domain: 'Clinical', team: 'Beta Force', techStack: 'Rust', tier: 'Tier 2' },
        ],
        totalRows: 2,
        successCount: 2,
        errorCount: 0,
        skippedCount: 0,
        errors: [],
        headers: ['id', 'name', 'domain', 'team', 'techStack', 'tier'],
        duplicates: [],
      });

      const file = new File(['id,name,domain,team,techStack,tier'], 'apps.csv', { type: 'text/csv' });

      const result = await importData(file, 'applications', adminUser);

      expect(result.success).toBe(true);
      expect(result.importedRecords).toBe(2);
      expect(result.message).toContain('Successfully imported 2 records');
    });

    it('allows QE Lead to import data', async () => {
      const { importCSV: mockImportCSV } = await import('../csvService.js');
      mockImportCSV.mockResolvedValue({
        success: true,
        data: [
          { id: 'APP-NEW-003', name: 'NewApp3', domain: 'Pharmacy', team: 'Gamma Team', techStack: 'Java', tier: 'Tier 1' },
        ],
        totalRows: 1,
        successCount: 1,
        errorCount: 0,
        skippedCount: 0,
        errors: [],
        headers: ['id', 'name', 'domain', 'team', 'techStack', 'tier'],
        duplicates: [],
      });

      const file = new File(['data'], 'apps.csv', { type: 'text/csv' });

      const result = await importData(file, 'applications', qeLeadUser);

      expect(result.success).toBe(true);
      expect(result.importedRecords).toBe(1);
    });

    it('logs an audit entry on successful import', async () => {
      const { importCSV: mockImportCSV } = await import('../csvService.js');
      const { logEdit: mockLogEdit } = await import('../auditService.js');

      mockImportCSV.mockResolvedValue({
        success: true,
        data: [{ id: 'APP-NEW-004', name: 'NewApp4', domain: 'Clinical', team: 'Delta Ops', techStack: 'Node.js', tier: 'Tier 3' }],
        totalRows: 1,
        successCount: 1,
        errorCount: 0,
        skippedCount: 0,
        errors: [],
        headers: ['id', 'name', 'domain', 'team', 'techStack', 'tier'],
        duplicates: [],
      });

      const file = new File(['data'], 'apps.csv', { type: 'text/csv' });

      await importData(file, 'applications', adminUser);

      expect(mockLogEdit).toHaveBeenCalledWith(
        expect.objectContaining({
          user: 'Sarah Chen',
          action: AUDIT_ACTIONS.IMPORT,
          entityType: 'applications',
        })
      );
    });

    it('handles CSV parse failure gracefully', async () => {
      const { importCSV: mockImportCSV } = await import('../csvService.js');
      mockImportCSV.mockResolvedValue({
        success: false,
        data: [],
        totalRows: 0,
        successCount: 0,
        errorCount: 1,
        skippedCount: 0,
        errors: [{ row: null, column: null, message: 'Parse error', code: 'PARSE_ERROR' }],
        headers: [],
        duplicates: [],
      });

      const file = new File(['malformed'], 'bad.csv', { type: 'text/csv' });

      const result = await importData(file, 'applications', adminUser);

      expect(result.success).toBe(false);
      expect(result.importedRecords).toBe(0);
      expect(result.errorCount).toBeGreaterThan(0);
    });

    it('imports Excel files using importExcel', async () => {
      const { importExcel: mockImportExcel } = await import('../csvService.js');
      mockImportExcel.mockResolvedValue({
        success: true,
        data: [
          { id: 'APP-XLS-001', name: 'ExcelApp', domain: 'Billing & Revenue', team: 'Epsilon Dev', techStack: '.NET Core', tier: 'Tier 1' },
        ],
        totalRows: 1,
        successCount: 1,
        errorCount: 0,
        skippedCount: 0,
        errors: [],
        headers: ['id', 'name', 'domain', 'team', 'techStack', 'tier'],
        duplicates: [],
      });

      const file = new File(['excel-data'], 'apps.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      const result = await importData(file, 'applications', adminUser);

      expect(result.success).toBe(true);
      expect(result.importedRecords).toBe(1);
      expect(mockImportExcel).toHaveBeenCalledTimes(1);
    });

    it('appends data by default', async () => {
      const { importCSV: mockImportCSV } = await import('../csvService.js');
      const originalCount = getAllData('applications').length;

      mockImportCSV.mockResolvedValue({
        success: true,
        data: [
          { id: 'APP-APPEND-001', name: 'AppendApp', domain: 'Clinical', team: 'Alpha Squad', techStack: 'Go', tier: 'Tier 1' },
        ],
        totalRows: 1,
        successCount: 1,
        errorCount: 0,
        skippedCount: 0,
        errors: [],
        headers: ['id', 'name', 'domain', 'team', 'techStack', 'tier'],
        duplicates: [],
      });

      const file = new File(['data'], 'apps.csv', { type: 'text/csv' });
      await importData(file, 'applications', adminUser);

      const newCount = getAllData('applications').length;
      expect(newCount).toBe(originalCount + 1);
    });

    it('replaces data when mode is replace', async () => {
      const { importCSV: mockImportCSV } = await import('../csvService.js');

      mockImportCSV.mockResolvedValue({
        success: true,
        data: [
          { id: 'APP-REPLACE-001', name: 'ReplaceApp', domain: 'Clinical', team: 'Alpha Squad', techStack: 'Go', tier: 'Tier 1' },
        ],
        totalRows: 1,
        successCount: 1,
        errorCount: 0,
        skippedCount: 0,
        errors: [],
        headers: ['id', 'name', 'domain', 'team', 'techStack', 'tier'],
        duplicates: [],
      });

      const file = new File(['data'], 'apps.csv', { type: 'text/csv' });
      await importData(file, 'applications', adminUser, { mode: 'replace' });

      const newData = getAllData('applications');
      expect(newData).toHaveLength(1);
      expect(newData[0].id).toBe('APP-REPLACE-001');
    });

    it('returns success with zero records when no valid data found', async () => {
      const { importCSV: mockImportCSV } = await import('../csvService.js');
      mockImportCSV.mockResolvedValue({
        success: true,
        data: [],
        totalRows: 5,
        successCount: 0,
        errorCount: 5,
        skippedCount: 0,
        errors: [
          { row: 1, column: 'id', message: 'Required field missing', code: 'FIELD_REQUIRED' },
        ],
        headers: ['id', 'name'],
        duplicates: [],
      });

      const file = new File(['data'], 'empty.csv', { type: 'text/csv' });
      const result = await importData(file, 'applications', adminUser);

      expect(result.success).toBe(true);
      expect(result.importedRecords).toBe(0);
      expect(result.message).toContain('No valid records');
    });
  });

  // ============================================================
  // exportData
  // ============================================================
  describe('exportData', () => {
    const adminUser = { name: 'Sarah Chen', role: 'Admin' };
    const viewerUser = { name: 'Lisa Anderson', role: 'View-Only' };
    const managerUser = { name: 'James Wilson', role: 'Manager' };

    beforeEach(() => {
      initializeData();
    });

    it('rejects export when user role lacks export permissions', async () => {
      const result = await exportData('applications', 'csv', viewerUser);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Access denied');
    });

    it('returns error for unknown data type', async () => {
      const result = await exportData('nonExistentType', 'csv', adminUser);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Unknown or empty data type');
    });

    it('exports data as CSV', async () => {
      const { exportCSV: mockExportCSV } = await import('../csvService.js');
      mockExportCSV.mockReturnValue({
        success: true,
        message: 'Successfully exported 25 rows to horizon_applications.csv',
        rowCount: 25,
      });

      const result = await exportData('applications', 'csv', adminUser);

      expect(result.success).toBe(true);
      expect(result.rowCount).toBeGreaterThan(0);
      expect(mockExportCSV).toHaveBeenCalledTimes(1);
    });

    it('exports data as Excel', async () => {
      const { exportExcel: mockExportExcel } = await import('../csvService.js');
      mockExportExcel.mockReturnValue({
        success: true,
        message: 'Successfully exported 25 rows to horizon_applications.xlsx',
        rowCount: 25,
      });

      const result = await exportData('applications', 'excel', adminUser);

      expect(result.success).toBe(true);
      expect(mockExportExcel).toHaveBeenCalledTimes(1);
    });

    it('allows manager role to export', async () => {
      const { exportCSV: mockExportCSV } = await import('../csvService.js');
      mockExportCSV.mockReturnValue({
        success: true,
        message: 'Exported',
        rowCount: 10,
      });

      const result = await exportData('applications', 'csv', managerUser);

      expect(result.success).toBe(true);
    });

    it('applies filters before export', async () => {
      const { exportCSV: mockExportCSV } = await import('../csvService.js');
      mockExportCSV.mockReturnValue({
        success: true,
        message: 'Exported',
        rowCount: 5,
      });

      await exportData('applications', 'csv', adminUser, {
        filters: { domain: 'Claims Processing' },
      });

      expect(mockExportCSV).toHaveBeenCalledTimes(1);
      const exportedData = mockExportCSV.mock.calls[0][0];
      exportedData.forEach((item) => {
        expect(item.domain.toLowerCase()).toBe('claims processing');
      });
    });

    it('logs an audit entry on successful export', async () => {
      const { exportCSV: mockExportCSV } = await import('../csvService.js');
      const { logEdit: mockLogEdit } = await import('../auditService.js');

      mockExportCSV.mockReturnValue({
        success: true,
        message: 'Exported',
        rowCount: 25,
      });

      await exportData('applications', 'csv', adminUser);

      expect(mockLogEdit).toHaveBeenCalledWith(
        expect.objectContaining({
          user: 'Sarah Chen',
          action: AUDIT_ACTIONS.EXPORT,
          entityType: 'applications',
        })
      );
    });

    it('returns success with zero rows when data is empty after filtering', async () => {
      const result = await exportData('applications', 'csv', adminUser, {
        filters: { domain: 'NonExistentDomain' },
      });

      expect(result.success).toBe(true);
      expect(result.rowCount).toBe(0);
      expect(result.message).toContain('No data to export');
    });

    it('exports without user for anonymous export', async () => {
      const { exportCSV: mockExportCSV } = await import('../csvService.js');
      mockExportCSV.mockReturnValue({
        success: true,
        message: 'Exported',
        rowCount: 25,
      });

      const result = await exportData('applications', 'csv', null);

      expect(result.success).toBe(true);
    });
  });

  // ============================================================
  // resetData
  // ============================================================
  describe('resetData', () => {
    const adminUser = { name: 'Sarah Chen', role: 'Admin' };

    beforeEach(() => {
      initializeData();
    });

    it('resets data to default mock data', async () => {
      // Edit a record first
      const allApps = getAllData('applications');
      const targetApp = allApps[0];
      await editField(targetApp.id, 'techStack', 'Modified Stack', adminUser, { dataType: 'applications' });

      // Verify edit took effect
      const editedApp = findRecordById('applications', targetApp.id);
      expect(editedApp.techStack).toBe('Modified Stack');

      // Reset
      const result = await resetData(adminUser);

      expect(result.success).toBe(true);
      expect(result.message).toContain('reset to default');

      // Verify data is back to original
      const resetApp = findRecordById('applications', targetApp.id);
      expect(resetApp.techStack).toBe(targetApp.techStack);
    });

    it('works without a user parameter', async () => {
      const result = await resetData();

      expect(result.success).toBe(true);
    });
  });

  // ============================================================
  // getDataTypes
  // ============================================================
  describe('getDataTypes', () => {
    it('returns all supported data types', () => {
      const types = getDataTypes();

      expect(types).toBeDefined();
      expect(types.APPLICATIONS).toBe('applications');
      expect(types.SPRINT_METRICS).toBe('sprintMetrics');
      expect(types.DORA_METRICS).toBe('doraMetrics');
      expect(types.TECH_DEBT).toBe('techDebtMetrics');
      expect(types.SECURITY_SCANS).toBe('securityScanResults');
    });
  });

  // ============================================================
  // getImportSchema
  // ============================================================
  describe('getImportSchema', () => {
    it('returns schema for applications data type', () => {
      const schema = getImportSchema('applications');

      expect(schema).toBeDefined();
      expect(schema.requiredFields).toContain('id');
      expect(schema.requiredFields).toContain('name');
      expect(schema.requiredFields).toContain('domain');
      expect(schema.primaryKey).toBe('id');
    });

    it('returns schema for sprint metrics data type', () => {
      const schema = getImportSchema('sprintMetrics');

      expect(schema).toBeDefined();
      expect(schema.requiredFields).toContain('sprintId');
      expect(schema.requiredFields).toContain('team');
      expect(schema.requiredFields).toContain('committed');
      expect(schema.requiredFields).toContain('done');
      expect(schema.primaryKey).toBe('sprintId');
    });

    it('returns default schema for unknown data type', () => {
      const schema = getImportSchema('unknownType');

      expect(schema).toBeDefined();
      expect(schema.requiredFields).toEqual([]);
      expect(schema.primaryKey).toBeNull();
    });
  });

  // ============================================================
  // getUniqueFieldValues
  // ============================================================
  describe('getUniqueFieldValues', () => {
    beforeEach(() => {
      initializeData();
    });

    it('returns unique domain values from applications', () => {
      const domains = getUniqueFieldValues('applications', 'domain');

      expect(Array.isArray(domains)).toBe(true);
      expect(domains.length).toBeGreaterThan(0);
      // Should be sorted
      const sorted = [...domains].sort();
      expect(domains).toEqual(sorted);
      // Should have no duplicates
      const unique = [...new Set(domains)];
      expect(domains).toEqual(unique);
    });

    it('returns unique team values from applications', () => {
      const teams = getUniqueFieldValues('applications', 'team');

      expect(Array.isArray(teams)).toBe(true);
      expect(teams.length).toBeGreaterThan(0);
    });

    it('returns unique tier values from applications', () => {
      const tiers = getUniqueFieldValues('applications', 'tier');

      expect(Array.isArray(tiers)).toBe(true);
      expect(tiers.length).toBeGreaterThan(0);
      expect(tiers).toContain('Tier 1');
    });

    it('returns empty array for unknown data type', () => {
      const values = getUniqueFieldValues('nonExistentType', 'domain');

      expect(values).toEqual([]);
    });

    it('returns empty array for empty field name', () => {
      const values = getUniqueFieldValues('applications', '');

      expect(values).toEqual([]);
    });
  });

  // ============================================================
  // getRecordCounts
  // ============================================================
  describe('getRecordCounts', () => {
    beforeEach(() => {
      initializeData();
    });

    it('returns counts for all data types', () => {
      const counts = getRecordCounts();

      expect(counts).toBeDefined();
      expect(typeof counts.applications).toBe('number');
      expect(counts.applications).toBeGreaterThan(0);
      expect(typeof counts.sprintMetrics).toBe('number');
      expect(counts.sprintMetrics).toBeGreaterThan(0);
      expect(typeof counts.doraMetrics).toBe('number');
      expect(counts.doraMetrics).toBeGreaterThan(0);
    });
  });
});