import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('papaparse', () => {
  return {
    default: {
      parse: vi.fn(),
      unparse: vi.fn(),
    },
  };
});

vi.mock('xlsx', () => {
  return {
    read: vi.fn(),
    utils: {
      sheet_to_json: vi.fn(),
      json_to_sheet: vi.fn(),
      book_new: vi.fn(),
      book_append_sheet: vi.fn(),
    },
    write: vi.fn(),
  };
});

vi.mock('@/utils/validationUtils', () => {
  return {
    validateCSVSchema: vi.fn(),
  };
});

import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { validateCSVSchema } from '@/utils/validationUtils';
import { importCSV, importExcel, exportCSV, exportExcel, downloadTemplate } from '../csvService';

/**
 * Creates a mock File object.
 * @param {string} name - File name
 * @param {string} content - File content
 * @param {string} type - MIME type
 * @param {number} [size] - Override file size in bytes
 * @returns {File}
 */
function createMockFile(name, content, type, size) {
  const file = new File([content], name, { type });
  if (size !== undefined) {
    Object.defineProperty(file, 'size', { value: size, writable: false });
  }
  return file;
}

/**
 * Creates a valid import schema for testing.
 * @returns {import('../csvService').ImportSchema}
 */
function createTestSchema() {
  return {
    requiredFields: ['id', 'name', 'value'],
    optionalFields: ['description'],
    strictMode: false,
    fieldSchemas: {
      id: { type: 'string', required: true },
      name: { type: 'string', required: true, minLength: 1, maxLength: 100 },
      value: { type: 'number', required: true, min: 0, max: 1000 },
      description: { type: 'string', required: false },
    },
    primaryKey: 'id',
  };
}

describe('csvService', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    validateCSVSchema.mockReturnValue({ valid: true, errors: [] });

    // Prevent actual downloads
    vi.spyOn(document, 'createElement').mockImplementation((tag) => {
      if (tag === 'a') {
        return {
          href: '',
          download: '',
          style: {},
          click: vi.fn(),
        };
      }
      return document.createElement.wrappedMethod
        ? document.createElement.wrappedMethod(tag)
        : {};
    });

    vi.spyOn(document.body, 'appendChild').mockImplementation(() => {});
    vi.spyOn(document.body, 'removeChild').mockImplementation(() => {});

    if (globalThis.URL.createObjectURL === undefined) {
      globalThis.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    } else {
      vi.spyOn(globalThis.URL, 'createObjectURL').mockReturnValue('blob:mock-url');
    }

    if (globalThis.URL.revokeObjectURL === undefined) {
      globalThis.URL.revokeObjectURL = vi.fn();
    } else {
      vi.spyOn(globalThis.URL, 'revokeObjectURL').mockImplementation(() => {});
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============================================================
  // importCSV
  // ============================================================
  describe('importCSV', () => {
    it('returns error result when no file is provided', async () => {
      const result = await importCSV(null, createTestSchema());

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('NO_FILE');
      expect(result.errors[0].message).toContain('No file provided');
      expect(result.data).toEqual([]);
    });

    it('returns error result when schema is invalid', async () => {
      const file = createMockFile('test.csv', 'id,name,value', 'text/csv');

      const result = await importCSV(file, null);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('INVALID_SCHEMA');
    });

    it('returns error result when file exceeds max size', async () => {
      const file = createMockFile('large.csv', 'data', 'text/csv', 11 * 1024 * 1024);

      const result = await importCSV(file, createTestSchema());

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('FILE_TOO_LARGE');
      expect(result.errors[0].message).toContain('10 MB');
    });

    it('successfully imports valid CSV data', async () => {
      const file = createMockFile('test.csv', 'id,name,value\n1,Test,42', 'text/csv');
      const schema = createTestSchema();

      Papa.parse.mockImplementation((f, options) => {
        options.complete({
          data: [
            { id: '1', name: 'Test Item', value: '42' },
            { id: '2', name: 'Another Item', value: '100' },
          ],
          meta: { fields: ['id', 'name', 'value'] },
          errors: [],
        });
      });

      const result = await importCSV(file, schema);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.totalRows).toBe(2);
      expect(result.successCount).toBe(2);
      expect(result.headers).toEqual(['id', 'name', 'value']);
      expect(Papa.parse).toHaveBeenCalledTimes(1);
    });

    it('reports validation errors for invalid rows', async () => {
      const file = createMockFile('test.csv', 'id,name,value\n1,,invalid', 'text/csv');
      const schema = createTestSchema();

      Papa.parse.mockImplementation((f, options) => {
        options.complete({
          data: [
            { id: '1', name: '', value: 'not-a-number' },
          ],
          meta: { fields: ['id', 'name', 'value'] },
          errors: [],
        });
      });

      const result = await importCSV(file, schema);

      expect(result.success).toBe(true);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('detects duplicate rows based on primary key', async () => {
      const file = createMockFile('test.csv', 'id,name,value', 'text/csv');
      const schema = createTestSchema();

      Papa.parse.mockImplementation((f, options) => {
        options.complete({
          data: [
            { id: 'DUP-1', name: 'First', value: '10' },
            { id: 'DUP-1', name: 'Duplicate', value: '20' },
          ],
          meta: { fields: ['id', 'name', 'value'] },
          errors: [],
        });
      });

      const result = await importCSV(file, schema);

      expect(result.success).toBe(true);
      expect(result.duplicates).toHaveLength(1);
      expect(result.duplicates[0].id).toBe('DUP-1');
      expect(result.skippedCount).toBeGreaterThanOrEqual(1);
      expect(result.errors.some((e) => e.code === 'DUPLICATE_ROW')).toBe(true);
    });

    it('skips empty rows', async () => {
      const file = createMockFile('test.csv', 'id,name,value', 'text/csv');
      const schema = createTestSchema();

      Papa.parse.mockImplementation((f, options) => {
        options.complete({
          data: [
            { id: '1', name: 'Valid', value: '50' },
            { id: '', name: '', value: '' },
            { id: '2', name: 'Also Valid', value: '75' },
          ],
          meta: { fields: ['id', 'name', 'value'] },
          errors: [],
        });
      });

      const result = await importCSV(file, schema);

      expect(result.success).toBe(true);
      expect(result.skippedCount).toBeGreaterThanOrEqual(1);
      expect(result.totalRows).toBe(3);
    });

    it('handles PapaParse errors gracefully', async () => {
      const file = createMockFile('bad.csv', 'malformed', 'text/csv');
      const schema = createTestSchema();

      Papa.parse.mockImplementation((f, options) => {
        options.error(new Error('Unexpected token'));
      });

      const result = await importCSV(file, schema);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('PARSE_ERROR');
      expect(result.errors[0].message).toContain('Unexpected token');
    });

    it('handles PapaParse parse warnings with data', async () => {
      const file = createMockFile('warn.csv', 'id,name,value', 'text/csv');
      const schema = createTestSchema();

      Papa.parse.mockImplementation((f, options) => {
        options.complete({
          data: [{ id: '1', name: 'Test', value: '10' }],
          meta: { fields: ['id', 'name', 'value'] },
          errors: [
            { type: 'FieldMismatch', row: 0, message: 'Too few fields' },
          ],
        });
      });

      const result = await importCSV(file, schema);

      expect(result.success).toBe(true);
      expect(result.data.length).toBeGreaterThanOrEqual(0);
    });

    it('handles PapaParse parse errors with no data', async () => {
      const file = createMockFile('broken.csv', '"unclosed', 'text/csv');
      const schema = createTestSchema();

      Papa.parse.mockImplementation((f, options) => {
        options.complete({
          data: [],
          meta: { fields: [] },
          errors: [
            { type: 'Quotes', row: 0, message: 'Quoted field unterminated' },
          ],
        });
      });

      const result = await importCSV(file, schema);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].code).toBe('PARSE_ERROR');
    });

    it('reports header validation errors from validateCSVSchema', async () => {
      const file = createMockFile('test.csv', 'wrong_col', 'text/csv');
      const schema = createTestSchema();

      validateCSVSchema.mockReturnValue({
        valid: false,
        errors: [
          { field: 'id', message: 'Missing required field: "id"', code: 'MISSING_REQUIRED_FIELD' },
          { field: 'name', message: 'Missing required field: "name"', code: 'MISSING_REQUIRED_FIELD' },
        ],
      });

      Papa.parse.mockImplementation((f, options) => {
        options.complete({
          data: [{ wrong_col: 'data' }],
          meta: { fields: ['wrong_col'] },
          errors: [],
        });
      });

      const result = await importCSV(file, schema);

      expect(result.success).toBe(true);
      expect(result.errors.some((e) => e.code === 'MISSING_REQUIRED_FIELD')).toBe(true);
    });

    it('handles processing exceptions gracefully', async () => {
      const file = createMockFile('test.csv', 'id,name,value', 'text/csv');
      const schema = createTestSchema();

      validateCSVSchema.mockImplementation(() => {
        throw new Error('Unexpected validation crash');
      });

      Papa.parse.mockImplementation((f, options) => {
        options.complete({
          data: [{ id: '1', name: 'Test', value: '10' }],
          meta: { fields: ['id', 'name', 'value'] },
          errors: [],
        });
      });

      const result = await importCSV(file, schema);

      expect(result.success).toBe(false);
      expect(result.errors[0].code).toBe('PROCESSING_ERROR');
    });
  });

  // ============================================================
  // importExcel
  // ============================================================
  describe('importExcel', () => {
    it('returns error result when no file is provided', async () => {
      const result = await importExcel(null, createTestSchema());

      expect(result.success).toBe(false);
      expect(result.errors[0].code).toBe('NO_FILE');
    });

    it('returns error result when schema is invalid', async () => {
      const file = createMockFile('test.xlsx', 'data', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

      const result = await importExcel(file, null);

      expect(result.success).toBe(false);
      expect(result.errors[0].code).toBe('INVALID_SCHEMA');
    });

    it('returns error result when file exceeds max size', async () => {
      const file = createMockFile(
        'large.xlsx',
        'data',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        11 * 1024 * 1024
      );

      const result = await importExcel(file, createTestSchema());

      expect(result.success).toBe(false);
      expect(result.errors[0].code).toBe('FILE_TOO_LARGE');
    });

    it('successfully imports valid Excel data', async () => {
      const file = createMockFile(
        'test.xlsx',
        'excel-content',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      const schema = createTestSchema();

      XLSX.read.mockReturnValue({
        SheetNames: ['Sheet1'],
        Sheets: {
          Sheet1: {},
        },
      });

      XLSX.utils.sheet_to_json.mockReturnValue([
        { id: '1', name: 'Excel Item', value: '55' },
        { id: '2', name: 'Another Excel Item', value: '88' },
      ]);

      // Mock FileReader
      const mockFileReader = {
        readAsArrayBuffer: vi.fn(),
        onload: null,
        onerror: null,
        result: new ArrayBuffer(8),
      };

      vi.spyOn(globalThis, 'FileReader').mockImplementation(() => mockFileReader);

      const resultPromise = importExcel(file, schema);

      // Trigger the onload callback
      mockFileReader.onload({ target: { result: new ArrayBuffer(8) } });

      const result = await resultPromise;

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.totalRows).toBe(2);
      expect(XLSX.read).toHaveBeenCalledTimes(1);
      expect(XLSX.utils.sheet_to_json).toHaveBeenCalledTimes(1);
    });

    it('handles empty workbook', async () => {
      const file = createMockFile(
        'empty.xlsx',
        'data',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      const schema = createTestSchema();

      XLSX.read.mockReturnValue({
        SheetNames: [],
        Sheets: {},
      });

      const mockFileReader = {
        readAsArrayBuffer: vi.fn(),
        onload: null,
        onerror: null,
        result: new ArrayBuffer(8),
      };

      vi.spyOn(globalThis, 'FileReader').mockImplementation(() => mockFileReader);

      const resultPromise = importExcel(file, schema);
      mockFileReader.onload({ target: { result: new ArrayBuffer(8) } });

      const result = await resultPromise;

      expect(result.success).toBe(false);
      expect(result.errors[0].code).toBe('EMPTY_WORKBOOK');
    });

    it('handles specific sheet name selection', async () => {
      const file = createMockFile(
        'multi.xlsx',
        'data',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      const schema = createTestSchema();

      XLSX.read.mockReturnValue({
        SheetNames: ['Sheet1', 'DataSheet'],
        Sheets: {
          Sheet1: {},
          DataSheet: {},
        },
      });

      XLSX.utils.sheet_to_json.mockReturnValue([
        { id: '1', name: 'From DataSheet', value: '99' },
      ]);

      const mockFileReader = {
        readAsArrayBuffer: vi.fn(),
        onload: null,
        onerror: null,
        result: new ArrayBuffer(8),
      };

      vi.spyOn(globalThis, 'FileReader').mockImplementation(() => mockFileReader);

      const resultPromise = importExcel(file, schema, { sheetName: 'DataSheet' });
      mockFileReader.onload({ target: { result: new ArrayBuffer(8) } });

      const result = await resultPromise;

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
    });

    it('returns error for non-existent sheet name', async () => {
      const file = createMockFile(
        'test.xlsx',
        'data',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      const schema = createTestSchema();

      XLSX.read.mockReturnValue({
        SheetNames: ['Sheet1'],
        Sheets: { Sheet1: {} },
      });

      const mockFileReader = {
        readAsArrayBuffer: vi.fn(),
        onload: null,
        onerror: null,
        result: new ArrayBuffer(8),
      };

      vi.spyOn(globalThis, 'FileReader').mockImplementation(() => mockFileReader);

      const resultPromise = importExcel(file, schema, { sheetName: 'NonExistent' });
      mockFileReader.onload({ target: { result: new ArrayBuffer(8) } });

      const result = await resultPromise;

      expect(result.success).toBe(false);
      expect(result.errors[0].code).toBe('SHEET_NOT_FOUND');
      expect(result.errors[0].message).toContain('NonExistent');
    });

    it('handles sheet index selection', async () => {
      const file = createMockFile(
        'test.xlsx',
        'data',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      const schema = createTestSchema();

      XLSX.read.mockReturnValue({
        SheetNames: ['Sheet1', 'Sheet2'],
        Sheets: { Sheet1: {}, Sheet2: {} },
      });

      XLSX.utils.sheet_to_json.mockReturnValue([
        { id: '1', name: 'From Sheet2', value: '77' },
      ]);

      const mockFileReader = {
        readAsArrayBuffer: vi.fn(),
        onload: null,
        onerror: null,
        result: new ArrayBuffer(8),
      };

      vi.spyOn(globalThis, 'FileReader').mockImplementation(() => mockFileReader);

      const resultPromise = importExcel(file, schema, { sheetName: 1 });
      mockFileReader.onload({ target: { result: new ArrayBuffer(8) } });

      const result = await resultPromise;

      expect(result.success).toBe(true);
    });

    it('returns error for out-of-range sheet index', async () => {
      const file = createMockFile(
        'test.xlsx',
        'data',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      const schema = createTestSchema();

      XLSX.read.mockReturnValue({
        SheetNames: ['Sheet1'],
        Sheets: { Sheet1: {} },
      });

      const mockFileReader = {
        readAsArrayBuffer: vi.fn(),
        onload: null,
        onerror: null,
        result: new ArrayBuffer(8),
      };

      vi.spyOn(globalThis, 'FileReader').mockImplementation(() => mockFileReader);

      const resultPromise = importExcel(file, schema, { sheetName: 5 });
      mockFileReader.onload({ target: { result: new ArrayBuffer(8) } });

      const result = await resultPromise;

      expect(result.success).toBe(false);
      expect(result.errors[0].code).toBe('INVALID_SHEET_INDEX');
    });

    it('handles FileReader error', async () => {
      const file = createMockFile(
        'test.xlsx',
        'data',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      const schema = createTestSchema();

      const mockFileReader = {
        readAsArrayBuffer: vi.fn(),
        onload: null,
        onerror: null,
        result: null,
      };

      vi.spyOn(globalThis, 'FileReader').mockImplementation(() => mockFileReader);

      const resultPromise = importExcel(file, schema);
      mockFileReader.onerror(new Error('Read failed'));

      const result = await resultPromise;

      expect(result.success).toBe(false);
      expect(result.errors[0].code).toBe('FILE_READ_ERROR');
    });

    it('handles empty sheet data', async () => {
      const file = createMockFile(
        'empty-sheet.xlsx',
        'data',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      const schema = createTestSchema();

      XLSX.read.mockReturnValue({
        SheetNames: ['Sheet1'],
        Sheets: { Sheet1: {} },
      });

      XLSX.utils.sheet_to_json.mockReturnValue([]);

      const mockFileReader = {
        readAsArrayBuffer: vi.fn(),
        onload: null,
        onerror: null,
        result: new ArrayBuffer(8),
      };

      vi.spyOn(globalThis, 'FileReader').mockImplementation(() => mockFileReader);

      const resultPromise = importExcel(file, schema);
      mockFileReader.onload({ target: { result: new ArrayBuffer(8) } });

      const result = await resultPromise;

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
      expect(result.totalRows).toBe(0);
    });

    it('handles XLSX processing exception', async () => {
      const file = createMockFile(
        'corrupt.xlsx',
        'data',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      const schema = createTestSchema();

      XLSX.read.mockImplementation(() => {
        throw new Error('Corrupt file');
      });

      const mockFileReader = {
        readAsArrayBuffer: vi.fn(),
        onload: null,
        onerror: null,
        result: new ArrayBuffer(8),
      };

      vi.spyOn(globalThis, 'FileReader').mockImplementation(() => mockFileReader);

      const resultPromise = importExcel(file, schema);
      mockFileReader.onload({ target: { result: new ArrayBuffer(8) } });

      const result = await resultPromise;

      expect(result.success).toBe(false);
      expect(result.errors[0].code).toBe('PROCESSING_ERROR');
      expect(result.errors[0].message).toContain('Corrupt file');
    });
  });

  // ============================================================
  // exportCSV
  // ============================================================
  describe('exportCSV', () => {
    it('returns error when data is not an array', () => {
      const result = exportCSV('not-an-array', 'test');

      expect(result.success).toBe(false);
      expect(result.message).toContain('Data must be an array');
      expect(result.rowCount).toBe(0);
    });

    it('returns error when filename is empty', () => {
      const result = exportCSV([{ id: 1 }], '');

      expect(result.success).toBe(false);
      expect(result.message).toContain('Filename must be a non-empty string');
    });

    it('returns success with zero rows for empty data', () => {
      const result = exportCSV([], 'empty-export');

      expect(result.success).toBe(true);
      expect(result.message).toContain('No data to export');
      expect(result.rowCount).toBe(0);
    });

    it('successfully exports data to CSV', () => {
      Papa.unparse.mockReturnValue('id,name\n1,Test');

      const data = [
        { id: '1', name: 'Test Item' },
        { id: '2', name: 'Another Item' },
      ];

      const result = exportCSV(data, 'test-export');

      expect(result.success).toBe(true);
      expect(result.rowCount).toBe(2);
      expect(result.message).toContain('Successfully exported');
      expect(result.message).toContain('test-export.csv');
      expect(Papa.unparse).toHaveBeenCalledTimes(1);
    });

    it('applies column filtering when columns option is provided', () => {
      Papa.unparse.mockReturnValue('id\n1\n2');

      const data = [
        { id: '1', name: 'Test', extra: 'hidden' },
        { id: '2', name: 'Another', extra: 'also hidden' },
      ];

      const result = exportCSV(data, 'filtered', { columns: ['id'] });

      expect(result.success).toBe(true);
      expect(result.rowCount).toBe(2);
      expect(Papa.unparse).toHaveBeenCalledTimes(1);

      const unparseArg = Papa.unparse.mock.calls[0][0];
      expect(Object.keys(unparseArg[0])).toContain('id');
      expect(Object.keys(unparseArg[0])).not.toContain('extra');
    });

    it('applies column labels when columnLabels option is provided', () => {
      Papa.unparse.mockReturnValue('ID,Full Name\n1,Test');

      const data = [{ id: '1', name: 'Test' }];
      const result = exportCSV(data, 'labeled', {
        columnLabels: { id: 'ID', name: 'Full Name' },
      });

      expect(result.success).toBe(true);
      const unparseArg = Papa.unparse.mock.calls[0][0];
      expect(Object.keys(unparseArg[0])).toContain('ID');
      expect(Object.keys(unparseArg[0])).toContain('Full Name');
    });

    it('handles export exceptions gracefully', () => {
      Papa.unparse.mockImplementation(() => {
        throw new Error('Unparse failed');
      });

      const result = exportCSV([{ id: 1 }], 'fail-export');

      expect(result.success).toBe(false);
      expect(result.message).toContain('CSV export failed');
      expect(result.rowCount).toBe(0);
    });

    it('sanitizes filename with special characters', () => {
      Papa.unparse.mockReturnValue('id\n1');

      const result = exportCSV([{ id: '1' }], 'test<>file|name');

      expect(result.success).toBe(true);
      expect(result.message).toContain('test__file_name.csv');
    });

    it('does not double-append .csv extension', () => {
      Papa.unparse.mockReturnValue('id\n1');

      const result = exportCSV([{ id: '1' }], 'already.csv');

      expect(result.success).toBe(true);
      expect(result.message).toContain('already.csv');
      expect(result.message).not.toContain('already.csv.csv');
    });
  });

  // ============================================================
  // exportExcel
  // ============================================================
  describe('exportExcel', () => {
    it('returns error when data is not an array', () => {
      const result = exportExcel('not-an-array', 'test');

      expect(result.success).toBe(false);
      expect(result.message).toContain('Data must be an array');
    });

    it('returns error when filename is empty', () => {
      const result = exportExcel([{ id: 1 }], '');

      expect(result.success).toBe(false);
      expect(result.message).toContain('Filename must be a non-empty string');
    });

    it('returns success with zero rows for empty data', () => {
      const result = exportExcel([], 'empty-export');

      expect(result.success).toBe(true);
      expect(result.message).toContain('No data to export');
      expect(result.rowCount).toBe(0);
    });

    it('successfully exports data to Excel', () => {
      XLSX.utils.json_to_sheet.mockReturnValue({ '!ref': 'A1:B2' });
      XLSX.utils.book_new.mockReturnValue({ SheetNames: [], Sheets: {} });
      XLSX.utils.book_append_sheet.mockImplementation(() => {});
      XLSX.write.mockReturnValue(new ArrayBuffer(100));

      const data = [
        { id: '1', name: 'Test Item' },
        { id: '2', name: 'Another Item' },
      ];

      const result = exportExcel(data, 'test-export');

      expect(result.success).toBe(true);
      expect(result.rowCount).toBe(2);
      expect(result.message).toContain('Successfully exported');
      expect(result.message).toContain('test-export.xlsx');
      expect(XLSX.utils.json_to_sheet).toHaveBeenCalledTimes(1);
      expect(XLSX.utils.book_new).toHaveBeenCalledTimes(1);
      expect(XLSX.utils.book_append_sheet).toHaveBeenCalledTimes(1);
      expect(XLSX.write).toHaveBeenCalledTimes(1);
    });

    it('applies column filtering for Excel export', () => {
      XLSX.utils.json_to_sheet.mockReturnValue({ '!ref': 'A1:A2' });
      XLSX.utils.book_new.mockReturnValue({ SheetNames: [], Sheets: {} });
      XLSX.utils.book_append_sheet.mockImplementation(() => {});
      XLSX.write.mockReturnValue(new ArrayBuffer(50));

      const data = [
        { id: '1', name: 'Test', extra: 'hidden' },
      ];

      const result = exportExcel(data, 'filtered', { columns: ['id'] });

      expect(result.success).toBe(true);
      const sheetArg = XLSX.utils.json_to_sheet.mock.calls[0][0];
      expect(Object.keys(sheetArg[0])).toContain('id');
      expect(Object.keys(sheetArg[0])).not.toContain('extra');
    });

    it('handles Excel export exceptions gracefully', () => {
      XLSX.utils.json_to_sheet.mockImplementation(() => {
        throw new Error('Sheet creation failed');
      });

      const result = exportExcel([{ id: 1 }], 'fail-export');

      expect(result.success).toBe(false);
      expect(result.message).toContain('Excel export failed');
      expect(result.rowCount).toBe(0);
    });

    it('uses custom sheet name when provided', () => {
      XLSX.utils.json_to_sheet.mockReturnValue({ '!ref': 'A1:B2' });
      XLSX.utils.book_new.mockReturnValue({ SheetNames: [], Sheets: {} });
      XLSX.utils.book_append_sheet.mockImplementation(() => {});
      XLSX.write.mockReturnValue(new ArrayBuffer(50));

      const data = [{ id: '1', name: 'Test' }];

      exportExcel(data, 'test', { sheetName: 'CustomSheet' });

      expect(XLSX.utils.book_append_sheet).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        'CustomSheet'
      );
    });
  });

  // ============================================================
  // downloadTemplate
  // ============================================================
  describe('downloadTemplate', () => {
    it('returns error when schema is invalid', () => {
      const result = downloadTemplate(null, 'template');

      expect(result.success).toBe(false);
      expect(result.message).toContain('Schema must be a valid object');
    });

    it('returns error when schema has no fields', () => {
      const result = downloadTemplate({ requiredFields: [], optionalFields: [] }, 'template');

      expect(result.success).toBe(false);
      expect(result.message).toContain('at least one field');
    });

    it('successfully generates a template CSV', () => {
      Papa.unparse.mockReturnValue('"id","name","value"');

      const schema = {
        requiredFields: ['id', 'name'],
        optionalFields: ['value'],
      };

      const result = downloadTemplate(schema, 'my_template');

      expect(result.success).toBe(true);
      expect(result.message).toContain('my_template.csv');
      expect(Papa.unparse).toHaveBeenCalledTimes(1);

      const unparseArg = Papa.unparse.mock.calls[0][0];
      expect(unparseArg).toHaveLength(1);
      expect(Object.keys(unparseArg[0])).toEqual(['id', 'name', 'value']);
    });

    it('uses default filename when none provided', () => {
      Papa.unparse.mockReturnValue('"id"');

      const schema = { requiredFields: ['id'] };

      const result = downloadTemplate(schema);

      expect(result.success).toBe(true);
      expect(result.message).toContain('import_template.csv');
    });

    it('handles template generation exceptions', () => {
      Papa.unparse.mockImplementation(() => {
        throw new Error('Template error');
      });

      const schema = { requiredFields: ['id'] };

      const result = downloadTemplate(schema, 'template');

      expect(result.success).toBe(false);
      expect(result.message).toContain('Template generation failed');
    });
  });
});