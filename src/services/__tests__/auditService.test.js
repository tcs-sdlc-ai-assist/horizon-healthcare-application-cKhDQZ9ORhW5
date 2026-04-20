import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  logEdit,
  getAuditTrail,
  revertEdit,
  exportAuditLog,
  verifyAuditTrailIntegrity,
  clearAuditTrail,
  getAuditEntryById,
  getAuditTrailCount,
} from '../auditService.js';
import { LOCAL_STORAGE_KEYS, AUDIT_ACTIONS } from '../../constants/constants.js';

// Mock the hashUtils module to avoid Web Crypto API issues in test environment
vi.mock('../../utils/hashUtils.js', () => {
  let hashCounter = 0;

  return {
    generateHash: vi.fn(async (data, previousHash = '') => {
      hashCounter++;
      const dataStr = typeof data === 'string' ? data : JSON.stringify(data);
      return `mock-hash-${hashCounter}-${previousHash.slice(0, 8)}`;
    }),
    verifyChain: vi.fn(async (entries) => {
      if (!Array.isArray(entries)) {
        return { valid: false, brokenAt: null, message: 'Audit logs must be an array.' };
      }
      if (entries.length === 0) {
        return { valid: true, brokenAt: null, message: 'Empty chain is valid.' };
      }
      // Simple chain verification: check previousHash linkage
      for (let i = 0; i < entries.length; i++) {
        if (i === 0 && entries[i].previousHash !== '') {
          return { valid: false, brokenAt: 0, message: 'First entry must have an empty previousHash.' };
        }
        if (i > 0 && entries[i].previousHash !== entries[i - 1].hash) {
          return {
            valid: false,
            brokenAt: i,
            message: `Chain broken at index ${i}: previousHash does not match prior entry hash.`,
          };
        }
      }
      return { valid: true, brokenAt: null, message: 'Chain integrity verified successfully.' };
    }),
  };
});

describe('auditService', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('logEdit', () => {
    it('creates an audit entry with correct fields and persists to localStorage', async () => {
      const entry = await logEdit({
        user: 'Sarah Chen',
        action: AUDIT_ACTIONS.UPDATE,
        fieldName: 'passRate',
        oldValue: 85,
        newValue: 92,
        entityType: 'record',
        entityId: 'REC-001',
        description: 'Updated pass rate for Claims Processing',
      });

      expect(entry).toBeDefined();
      expect(entry.id).toMatch(/^AUD-/);
      expect(entry.user).toBe('Sarah Chen');
      expect(entry.action).toBe(AUDIT_ACTIONS.UPDATE);
      expect(entry.fieldName).toBe('passRate');
      expect(entry.oldValue).toBe(85);
      expect(entry.newValue).toBe(92);
      expect(entry.entityType).toBe('record');
      expect(entry.entityId).toBe('REC-001');
      expect(entry.description).toBe('Updated pass rate for Claims Processing');
      expect(entry.timestamp).toBeDefined();
      expect(entry.hash).toBeDefined();
      expect(entry.previousHash).toBe('');
      expect(entry.reverted).toBe(false);
      expect(entry.revertedBy).toBeNull();

      const stored = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.HORIZON_AUDIT_TRAIL));
      expect(stored).toHaveLength(1);
      expect(stored[0].id).toBe(entry.id);
    });

    it('chains hashes correctly for multiple entries', async () => {
      const entry1 = await logEdit({
        user: 'admin',
        action: AUDIT_ACTIONS.CREATE,
        fieldName: 'testField',
        oldValue: null,
        newValue: 'value1',
        entityType: 'record',
        entityId: 'REC-001',
      });

      const entry2 = await logEdit({
        user: 'admin',
        action: AUDIT_ACTIONS.UPDATE,
        fieldName: 'testField',
        oldValue: 'value1',
        newValue: 'value2',
        entityType: 'record',
        entityId: 'REC-001',
      });

      expect(entry1.previousHash).toBe('');
      expect(entry2.previousHash).toBe(entry1.hash);
      expect(entry2.hash).not.toBe(entry1.hash);
    });

    it('generates a default description when none is provided', async () => {
      const entry = await logEdit({
        user: 'admin',
        action: AUDIT_ACTIONS.UPDATE,
        fieldName: 'coverage',
        entityType: 'record',
        entityId: 'REC-002',
      });

      expect(entry.description).toContain('Updated');
      expect(entry.description).toContain('coverage');
      expect(entry.description).toContain('record');
      expect(entry.description).toContain('REC-002');
    });

    it('throws an error when user is missing', async () => {
      await expect(
        logEdit({
          user: '',
          action: AUDIT_ACTIONS.UPDATE,
        })
      ).rejects.toThrow('User must be a non-empty string.');
    });

    it('throws an error when action is missing', async () => {
      await expect(
        logEdit({
          user: 'admin',
          action: '',
        })
      ).rejects.toThrow('Action must be a non-empty string.');
    });

    it('handles different action types with correct default descriptions', async () => {
      const createEntry = await logEdit({
        user: 'admin',
        action: AUDIT_ACTIONS.CREATE,
        entityType: 'record',
        entityId: 'REC-010',
      });
      expect(createEntry.description).toContain('Created');

      const deleteEntry = await logEdit({
        user: 'admin',
        action: AUDIT_ACTIONS.DELETE,
        entityType: 'record',
        entityId: 'REC-010',
      });
      expect(deleteEntry.description).toContain('Deleted');

      const importEntry = await logEdit({
        user: 'admin',
        action: AUDIT_ACTIONS.IMPORT,
        entityType: 'csv',
      });
      expect(importEntry.description).toContain('Imported');

      const configEntry = await logEdit({
        user: 'admin',
        action: AUDIT_ACTIONS.CONFIG_CHANGE,
        fieldName: 'theme',
      });
      expect(configEntry.description).toContain('Configuration changed');
    });
  });

  describe('getAuditTrail', () => {
    beforeEach(async () => {
      await logEdit({
        user: 'Sarah Chen',
        action: AUDIT_ACTIONS.UPDATE,
        fieldName: 'passRate',
        oldValue: 85,
        newValue: 92,
        entityType: 'record',
        entityId: 'REC-001',
      });

      await logEdit({
        user: 'James Wilson',
        action: AUDIT_ACTIONS.CREATE,
        fieldName: 'testCases',
        oldValue: null,
        newValue: 100,
        entityType: 'record',
        entityId: 'REC-002',
      });

      await logEdit({
        user: 'Sarah Chen',
        action: AUDIT_ACTIONS.DELETE,
        entityType: 'config',
        entityId: 'CFG-001',
      });
    });

    it('returns all entries sorted newest first', () => {
      const entries = getAuditTrail();
      expect(entries).toHaveLength(3);
      // Newest first
      expect(entries[0].action).toBe(AUDIT_ACTIONS.DELETE);
      expect(entries[2].action).toBe(AUDIT_ACTIONS.UPDATE);
    });

    it('filters by user', () => {
      const entries = getAuditTrail({ user: 'Sarah' });
      expect(entries).toHaveLength(2);
      entries.forEach((entry) => {
        expect(entry.user.toLowerCase()).toContain('sarah');
      });
    });

    it('filters by action', () => {
      const entries = getAuditTrail({ action: AUDIT_ACTIONS.UPDATE });
      expect(entries).toHaveLength(1);
      expect(entries[0].action).toBe(AUDIT_ACTIONS.UPDATE);
    });

    it('filters by fieldName', () => {
      const entries = getAuditTrail({ fieldName: 'passRate' });
      expect(entries).toHaveLength(1);
      expect(entries[0].fieldName).toBe('passRate');
    });

    it('filters by entityType', () => {
      const entries = getAuditTrail({ entityType: 'config' });
      expect(entries).toHaveLength(1);
      expect(entries[0].entityType).toBe('config');
    });

    it('filters by entityId', () => {
      const entries = getAuditTrail({ entityId: 'REC-002' });
      expect(entries).toHaveLength(1);
      expect(entries[0].entityId).toBe('REC-002');
    });

    it('filters by date range', async () => {
      const today = new Date().toISOString().split('T')[0];
      const entries = getAuditTrail({ startDate: today, endDate: today });
      expect(entries).toHaveLength(3);
    });

    it('excludes reverted entries when includeReverted is false', async () => {
      // Revert the first entry
      const allEntries = getAuditTrail();
      const entryToRevert = allEntries[allEntries.length - 1]; // oldest entry
      await revertEdit(entryToRevert.id, 'admin');

      const withReverted = getAuditTrail({ includeReverted: true });
      const withoutReverted = getAuditTrail({ includeReverted: false });

      expect(withoutReverted.length).toBeLessThan(withReverted.length);
    });

    it('returns empty array when no entries match filters', () => {
      const entries = getAuditTrail({ user: 'nonexistent-user' });
      expect(entries).toHaveLength(0);
    });

    it('returns empty array when localStorage is empty', () => {
      localStorage.clear();
      const entries = getAuditTrail();
      expect(entries).toHaveLength(0);
    });

    it('combines multiple filters', () => {
      const entries = getAuditTrail({
        user: 'Sarah',
        action: AUDIT_ACTIONS.UPDATE,
      });
      expect(entries).toHaveLength(1);
      expect(entries[0].user).toBe('Sarah Chen');
      expect(entries[0].action).toBe(AUDIT_ACTIONS.UPDATE);
    });
  });

  describe('revertEdit', () => {
    it('reverts an audit entry and creates a new revert entry', async () => {
      const original = await logEdit({
        user: 'Sarah Chen',
        action: AUDIT_ACTIONS.UPDATE,
        fieldName: 'passRate',
        oldValue: 85,
        newValue: 92,
        entityType: 'record',
        entityId: 'REC-001',
      });

      const { revertEntry, originalEntry } = await revertEdit(original.id, 'admin');

      expect(revertEntry).toBeDefined();
      expect(revertEntry.id).toMatch(/^AUD-/);
      expect(revertEntry.action).toBe(AUDIT_ACTIONS.UPDATE);
      expect(revertEntry.fieldName).toBe('passRate');
      expect(revertEntry.oldValue).toBe(92); // swapped
      expect(revertEntry.newValue).toBe(85); // swapped
      expect(revertEntry.description).toContain('Reverted');
      expect(revertEntry.description).toContain(original.id);

      expect(originalEntry.reverted).toBe(true);
      expect(originalEntry.revertedBy).toBe(revertEntry.id);
    });

    it('throws an error when audit ID is missing', async () => {
      await expect(revertEdit('', 'admin')).rejects.toThrow(
        'Audit ID must be a non-empty string.'
      );
    });

    it('throws an error when user is missing', async () => {
      await expect(revertEdit('AUD-123', '')).rejects.toThrow(
        'User must be a non-empty string.'
      );
    });

    it('throws an error when audit entry is not found', async () => {
      await expect(revertEdit('AUD-nonexistent', 'admin')).rejects.toThrow(
        'Audit entry with ID "AUD-nonexistent" not found.'
      );
    });

    it('throws an error when entry has already been reverted', async () => {
      const original = await logEdit({
        user: 'admin',
        action: AUDIT_ACTIONS.UPDATE,
        fieldName: 'coverage',
        oldValue: 70,
        newValue: 80,
        entityType: 'record',
        entityId: 'REC-005',
      });

      await revertEdit(original.id, 'admin');

      await expect(revertEdit(original.id, 'admin')).rejects.toThrow(
        `Audit entry "${original.id}" has already been reverted.`
      );
    });
  });

  describe('exportAuditLog', () => {
    it('exports all audit entries as a JSON string', async () => {
      await logEdit({
        user: 'admin',
        action: AUDIT_ACTIONS.CREATE,
        entityType: 'record',
        entityId: 'REC-001',
      });

      await logEdit({
        user: 'admin',
        action: AUDIT_ACTIONS.UPDATE,
        fieldName: 'status',
        oldValue: 'draft',
        newValue: 'published',
        entityType: 'record',
        entityId: 'REC-001',
      });

      const result = exportAuditLog();

      expect(result.success).toBeUndefined(); // exportAuditLog doesn't have a success field
      expect(result.data).toBeDefined();
      expect(typeof result.data).toBe('string');
      expect(result.entryCount).toBe(2);
      expect(result.filename).toMatch(/^horizon_audit_trail_.*\.json$/);
      expect(result.exportedAt).toBeDefined();

      const parsed = JSON.parse(result.data);
      expect(parsed.entries).toHaveLength(2);
      expect(parsed.exportedAt).toBe(result.exportedAt);
    });

    it('exports filtered entries when filters are provided', async () => {
      await logEdit({
        user: 'Sarah Chen',
        action: AUDIT_ACTIONS.UPDATE,
        entityType: 'record',
        entityId: 'REC-001',
      });

      await logEdit({
        user: 'James Wilson',
        action: AUDIT_ACTIONS.CREATE,
        entityType: 'record',
        entityId: 'REC-002',
      });

      const result = exportAuditLog({ user: 'Sarah' });

      expect(result.entryCount).toBe(1);
      const parsed = JSON.parse(result.data);
      expect(parsed.entries).toHaveLength(1);
      expect(parsed.entries[0].user).toBe('Sarah Chen');
      expect(parsed.filters).toEqual({ user: 'Sarah' });
    });

    it('exports empty result when no entries exist', () => {
      const result = exportAuditLog();

      expect(result.entryCount).toBe(0);
      expect(result.filename).toMatch(/\.json$/);

      const parsed = JSON.parse(result.data);
      expect(parsed.entries).toHaveLength(0);
    });
  });

  describe('verifyAuditTrailIntegrity', () => {
    it('returns valid for an empty audit trail', async () => {
      const result = await verifyAuditTrailIntegrity();

      expect(result.valid).toBe(true);
      expect(result.brokenAt).toBeNull();
      expect(result.totalEntries).toBe(0);
    });

    it('returns valid for a properly chained audit trail', async () => {
      await logEdit({
        user: 'admin',
        action: AUDIT_ACTIONS.CREATE,
        entityType: 'record',
        entityId: 'REC-001',
      });

      await logEdit({
        user: 'admin',
        action: AUDIT_ACTIONS.UPDATE,
        fieldName: 'status',
        oldValue: 'draft',
        newValue: 'active',
        entityType: 'record',
        entityId: 'REC-001',
      });

      const result = await verifyAuditTrailIntegrity();

      expect(result.valid).toBe(true);
      expect(result.brokenAt).toBeNull();
      expect(result.totalEntries).toBe(2);
    });

    it('detects a tampered audit trail', async () => {
      await logEdit({
        user: 'admin',
        action: AUDIT_ACTIONS.CREATE,
        entityType: 'record',
        entityId: 'REC-001',
      });

      await logEdit({
        user: 'admin',
        action: AUDIT_ACTIONS.UPDATE,
        entityType: 'record',
        entityId: 'REC-001',
      });

      // Tamper with the stored data
      const stored = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.HORIZON_AUDIT_TRAIL));
      stored[1].previousHash = 'tampered-hash';
      localStorage.setItem(LOCAL_STORAGE_KEYS.HORIZON_AUDIT_TRAIL, JSON.stringify(stored));

      const result = await verifyAuditTrailIntegrity();

      expect(result.valid).toBe(false);
      expect(result.brokenAt).toBe(1);
      expect(result.totalEntries).toBe(2);
    });
  });

  describe('clearAuditTrail', () => {
    it('clears all entries and logs the clear action', async () => {
      await logEdit({
        user: 'admin',
        action: AUDIT_ACTIONS.CREATE,
        entityType: 'record',
        entityId: 'REC-001',
      });

      await logEdit({
        user: 'admin',
        action: AUDIT_ACTIONS.UPDATE,
        entityType: 'record',
        entityId: 'REC-002',
      });

      const clearEntry = await clearAuditTrail('admin');

      expect(clearEntry).toBeDefined();
      expect(clearEntry.action).toBe(AUDIT_ACTIONS.DELETE);
      expect(clearEntry.entityType).toBe('audit_trail');
      expect(clearEntry.description).toContain('Cleared audit trail');
      expect(clearEntry.description).toContain('2 entries removed');

      // Only the clear action entry should remain
      const entries = getAuditTrail();
      expect(entries).toHaveLength(1);
      expect(entries[0].id).toBe(clearEntry.id);
    });

    it('throws an error when user is missing', async () => {
      await expect(clearAuditTrail('')).rejects.toThrow(
        'User must be a non-empty string.'
      );
    });
  });

  describe('getAuditEntryById', () => {
    it('returns the correct entry by ID', async () => {
      const entry = await logEdit({
        user: 'admin',
        action: AUDIT_ACTIONS.CREATE,
        entityType: 'record',
        entityId: 'REC-001',
      });

      const found = getAuditEntryById(entry.id);

      expect(found).toBeDefined();
      expect(found.id).toBe(entry.id);
      expect(found.user).toBe('admin');
    });

    it('returns null for a non-existent ID', () => {
      const found = getAuditEntryById('AUD-nonexistent');
      expect(found).toBeNull();
    });

    it('returns null for invalid input', () => {
      expect(getAuditEntryById('')).toBeNull();
      expect(getAuditEntryById(null)).toBeNull();
      expect(getAuditEntryById(undefined)).toBeNull();
    });
  });

  describe('getAuditTrailCount', () => {
    it('returns the total count of entries', async () => {
      await logEdit({
        user: 'admin',
        action: AUDIT_ACTIONS.CREATE,
        entityType: 'record',
        entityId: 'REC-001',
      });

      await logEdit({
        user: 'admin',
        action: AUDIT_ACTIONS.UPDATE,
        entityType: 'record',
        entityId: 'REC-002',
      });

      expect(getAuditTrailCount()).toBe(2);
    });

    it('returns filtered count when filters are provided', async () => {
      await logEdit({
        user: 'Sarah Chen',
        action: AUDIT_ACTIONS.UPDATE,
        entityType: 'record',
        entityId: 'REC-001',
      });

      await logEdit({
        user: 'James Wilson',
        action: AUDIT_ACTIONS.CREATE,
        entityType: 'record',
        entityId: 'REC-002',
      });

      expect(getAuditTrailCount({ user: 'Sarah' })).toBe(1);
      expect(getAuditTrailCount({ action: AUDIT_ACTIONS.CREATE })).toBe(1);
    });

    it('returns 0 when no entries exist', () => {
      expect(getAuditTrailCount()).toBe(0);
    });
  });

  describe('localStorage error handling', () => {
    it('handles corrupted localStorage data gracefully', () => {
      localStorage.setItem(LOCAL_STORAGE_KEYS.HORIZON_AUDIT_TRAIL, 'not-valid-json{{{');

      const entries = getAuditTrail();
      expect(entries).toHaveLength(0);
    });

    it('handles non-array localStorage data gracefully', () => {
      localStorage.setItem(LOCAL_STORAGE_KEYS.HORIZON_AUDIT_TRAIL, JSON.stringify({ not: 'an array' }));

      const entries = getAuditTrail();
      expect(entries).toHaveLength(0);
    });
  });
});