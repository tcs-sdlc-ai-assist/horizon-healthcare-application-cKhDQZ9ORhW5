/**
 * CSV/Excel import and export service.
 * Uses PapaParse for CSV parsing and SheetJS (xlsx) for Excel file handling.
 * Provides schema validation, error collection, data type coercion, and duplicate detection.
 * @module csvService
 *
 * Related stories: SCRUM-7326, SCRUM-7330, SCRUM-7335
 */

import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { validateCSVSchema } from '@/utils/validationUtils';

/**
 * @typedef {Object} FieldSchema
 * @property {string} type - Expected type: 'string' | 'number' | 'integer' | 'boolean' | 'date'
 * @property {boolean} [required] - Whether the field is required
 * @property {number} [min] - Minimum numeric value
 * @property {number} [max] - Maximum numeric value
 * @property {number} [minLength] - Minimum string length
 * @property {number} [maxLength] - Maximum string length
 * @property {Array} [oneOf] - Allowed values
 * @property {string} [alias] - Alternative column header name to map from
 */

/**
 * @typedef {Object} ImportSchema
 * @property {string[]} requiredFields - Fields that must be present in the file
 * @property {string[]} [optionalFields] - Fields that may be present
 * @property {boolean} [strictMode] - If true, disallow extra fields not in schema
 * @property {Object.<string, FieldSchema>} [fieldSchemas] - Per-field validation rules
 * @property {string} [primaryKey] - Field name used for duplicate detection
 */

/**
 * @typedef {Object} ImportError
 * @property {number|null} row - Row number (1-based, null for header-level errors)
 * @property {string|null} column - Column name (null for row-level errors)
 * @property {string} message - Human-readable error message
 * @property {string} code - Machine-readable error code
 */

/**
 * @typedef {Object} ImportResult
 * @property {boolean} success - Whether the import completed (may still have errors)
 * @property {Object[]} data - Successfully parsed and validated rows
 * @property {number} totalRows - Total rows found in the file
 * @property {number} successCount - Number of rows that passed validation
 * @property {number} errorCount - Number of rows that failed validation
 * @property {number} skippedCount - Number of rows skipped (empty or duplicate)
 * @property {ImportError[]} errors - Detailed error list
 * @property {string[]} headers - Detected column headers
 * @property {Object[]} duplicates - Rows detected as duplicates
 */

/**
 * Coerces a raw string value to the expected type defined in the field schema.
 * @param {*} value - The raw value to coerce
 * @param {FieldSchema} fieldSchema - The schema definition for the field
 * @param {string} fieldName - The name of the field (for error messages)
 * @returns {{ value: *, error: string|null }} Coerced value and optional error message
 */
function coerceValue(value, fieldSchema, fieldName) {
  if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) {
    return { value: null, error: null };
  }

  const rawValue = typeof value === 'string' ? value.trim() : value;

  switch (fieldSchema.type) {
    case 'number': {
      const num = Number(rawValue);
      if (isNaN(num)) {
        return { value: rawValue, error: `"${fieldName}" must be a valid number, got "${rawValue}"` };
      }
      return { value: num, error: null };
    }
    case 'integer': {
      const num = Number(rawValue);
      if (isNaN(num) || !Number.isInteger(num)) {
        return { value: rawValue, error: `"${fieldName}" must be a valid integer, got "${rawValue}"` };
      }
      return { value: num, error: null };
    }
    case 'boolean': {
      const lower = String(rawValue).toLowerCase();
      if (['true', '1', 'yes', 'y'].includes(lower)) {
        return { value: true, error: null };
      }
      if (['false', '0', 'no', 'n'].includes(lower)) {
        return { value: false, error: null };
      }
      return { value: rawValue, error: `"${fieldName}" must be a boolean value, got "${rawValue}"` };
    }
    case 'date': {
      const dateObj = new Date(rawValue);
      if (isNaN(dateObj.getTime())) {
        return { value: rawValue, error: `"${fieldName}" must be a valid date, got "${rawValue}"` };
      }
      return { value: dateObj.toISOString().split('T')[0], error: null };
    }
    case 'string':
    default:
      return { value: String(rawValue), error: null };
  }
}

/**
 * Validates a single row against the field schemas.
 * @param {Object} row - The data row to validate
 * @param {Object.<string, FieldSchema>} fieldSchemas - Per-field validation rules
 * @param {number} rowIndex - 1-based row number for error reporting
 * @returns {{ validatedRow: Object, errors: ImportError[] }}
 */
function validateRow(row, fieldSchemas, rowIndex) {
  const errors = [];
  const validatedRow = { ...row };

  for (const [fieldName, schema] of Object.entries(fieldSchemas)) {
    const rawValue = row[fieldName];
    const isNullOrEmpty = rawValue === null || rawValue === undefined ||
      (typeof rawValue === 'string' && rawValue.trim() === '');

    if (schema.required && isNullOrEmpty) {
      errors.push({
        row: rowIndex,
        column: fieldName,
        message: `Required field "${fieldName}" is empty`,
        code: 'FIELD_REQUIRED',
      });
      continue;
    }

    if (isNullOrEmpty) {
      validatedRow[fieldName] = null;
      continue;
    }

    const { value: coerced, error: coercionError } = coerceValue(rawValue, schema, fieldName);
    if (coercionError) {
      errors.push({
        row: rowIndex,
        column: fieldName,
        message: coercionError,
        code: 'TYPE_COERCION_FAILED',
      });
      continue;
    }

    validatedRow[fieldName] = coerced;

    if (schema.type === 'number' || schema.type === 'integer') {
      if (schema.min !== undefined && coerced < schema.min) {
        errors.push({
          row: rowIndex,
          column: fieldName,
          message: `"${fieldName}" value ${coerced} is below minimum ${schema.min}`,
          code: 'MIN_VALUE',
        });
      }
      if (schema.max !== undefined && coerced > schema.max) {
        errors.push({
          row: rowIndex,
          column: fieldName,
          message: `"${fieldName}" value ${coerced} exceeds maximum ${schema.max}`,
          code: 'MAX_VALUE',
        });
      }
    }

    if (schema.type === 'string' && typeof coerced === 'string') {
      if (schema.minLength !== undefined && coerced.length < schema.minLength) {
        errors.push({
          row: rowIndex,
          column: fieldName,
          message: `"${fieldName}" must be at least ${schema.minLength} characters`,
          code: 'MIN_LENGTH',
        });
      }
      if (schema.maxLength !== undefined && coerced.length > schema.maxLength) {
        errors.push({
          row: rowIndex,
          column: fieldName,
          message: `"${fieldName}" must be no more than ${schema.maxLength} characters`,
          code: 'MAX_LENGTH',
        });
      }
    }

    if (schema.oneOf && Array.isArray(schema.oneOf)) {
      if (!schema.oneOf.includes(coerced)) {
        errors.push({
          row: rowIndex,
          column: fieldName,
          message: `"${fieldName}" must be one of: ${schema.oneOf.join(', ')}`,
          code: 'NOT_IN_ALLOWED_VALUES',
        });
      }
    }
  }

  return { validatedRow, errors };
}

/**
 * Checks if a row is entirely empty (all values are null, undefined, or empty strings).
 * @param {Object} row - The row to check
 * @returns {boolean}
 */
function isEmptyRow(row) {
  if (!row || typeof row !== 'object') {
    return true;
  }
  return Object.values(row).every(
    (val) => val === null || val === undefined || (typeof val === 'string' && val.trim() === '')
  );
}

/**
 * Maps column headers using alias definitions from field schemas.
 * @param {Object} row - The raw data row
 * @param {Object.<string, FieldSchema>} fieldSchemas - Per-field validation rules with optional aliases
 * @returns {Object} Row with aliased columns mapped to canonical field names
 */
function applyAliases(row, fieldSchemas) {
  if (!fieldSchemas) {
    return row;
  }

  const mapped = { ...row };

  for (const [fieldName, schema] of Object.entries(fieldSchemas)) {
    if (schema.alias && mapped[fieldName] === undefined && mapped[schema.alias] !== undefined) {
      mapped[fieldName] = mapped[schema.alias];
      delete mapped[schema.alias];
    }
  }

  return mapped;
}

/**
 * Normalizes headers to lowercase trimmed strings for consistent matching.
 * @param {string[]} headers - Raw headers
 * @returns {string[]} Normalized headers
 */
function normalizeHeaders(headers) {
  return headers.map((h) => (typeof h === 'string' ? h.trim() : String(h)));
}

/**
 * Processes parsed rows through validation, coercion, and duplicate detection.
 * @param {Object[]} rawRows - Parsed data rows
 * @param {string[]} headers - Column headers
 * @param {ImportSchema} schema - Import schema definition
 * @returns {ImportResult}
 */
function processRows(rawRows, headers, schema) {
  const errors = [];
  const validData = [];
  const duplicates = [];
  let skippedCount = 0;

  const headerValidation = validateCSVSchema(headers, {
    requiredFields: schema.requiredFields || [],
    optionalFields: schema.optionalFields || [],
    strictMode: schema.strictMode || false,
  });

  if (!headerValidation.valid) {
    headerValidation.errors.forEach((err) => {
      errors.push({
        row: null,
        column: err.field,
        message: err.message,
        code: err.code,
      });
    });
  }

  const fieldSchemas = schema.fieldSchemas || {};
  const primaryKey = schema.primaryKey || null;
  const seenKeys = new Set();

  for (let i = 0; i < rawRows.length; i++) {
    const rowNumber = i + 1;
    let row = rawRows[i];

    if (isEmptyRow(row)) {
      skippedCount++;
      continue;
    }

    row = applyAliases(row, fieldSchemas);

    if (primaryKey && row[primaryKey] !== null && row[primaryKey] !== undefined && String(row[primaryKey]).trim() !== '') {
      const keyValue = String(row[primaryKey]).trim();
      if (seenKeys.has(keyValue)) {
        duplicates.push({ ...row, _rowNumber: rowNumber });
        errors.push({
          row: rowNumber,
          column: primaryKey,
          message: `Duplicate value "${keyValue}" found for primary key "${primaryKey}"`,
          code: 'DUPLICATE_ROW',
        });
        skippedCount++;
        continue;
      }
      seenKeys.add(keyValue);
    }

    const { validatedRow, errors: rowErrors } = validateRow(row, fieldSchemas, rowNumber);

    if (rowErrors.length > 0) {
      errors.push(...rowErrors);
    } else {
      validData.push(validatedRow);
    }
  }

  return {
    success: true,
    data: validData,
    totalRows: rawRows.length,
    successCount: validData.length,
    errorCount: errors.filter((e) => e.row !== null).length,
    skippedCount,
    errors,
    headers,
    duplicates,
  };
}

/**
 * Creates an error result for import failures.
 * @param {string} message - Error message
 * @param {string} code - Error code
 * @returns {ImportResult}
 */
function createErrorResult(message, code) {
  return {
    success: false,
    data: [],
    totalRows: 0,
    successCount: 0,
    errorCount: 1,
    skippedCount: 0,
    errors: [{
      row: null,
      column: null,
      message,
      code,
    }],
    headers: [],
    duplicates: [],
  };
}

/**
 * Imports and validates a CSV file.
 * @param {File} file - The CSV file to import
 * @param {ImportSchema} schema - Schema definition for validation
 * @returns {Promise<ImportResult>} Structured import result
 */
export function importCSV(file, schema) {
  return new Promise((resolve) => {
    if (!file) {
      resolve(createErrorResult('No file provided', 'NO_FILE'));
      return;
    }

    if (!schema || typeof schema !== 'object') {
      resolve(createErrorResult('Schema must be a valid object', 'INVALID_SCHEMA'));
      return;
    }

    const maxSizeMB = 10;
    if (file.size > maxSizeMB * 1024 * 1024) {
      resolve(createErrorResult(`File size exceeds maximum of ${maxSizeMB} MB`, 'FILE_TOO_LARGE'));
      return;
    }

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
      encoding: 'UTF-8',
      complete(results) {
        try {
          if (results.errors && results.errors.length > 0) {
            const parseErrors = results.errors
              .filter((e) => e.type === 'Quotes' || e.type === 'FieldMismatch')
              .map((e) => ({
                row: e.row !== undefined ? e.row + 1 : null,
                column: null,
                message: e.message,
                code: 'PARSE_ERROR',
              }));

            if (parseErrors.length > 0 && (!results.data || results.data.length === 0)) {
              resolve({
                success: false,
                data: [],
                totalRows: 0,
                successCount: 0,
                errorCount: parseErrors.length,
                skippedCount: 0,
                errors: parseErrors,
                headers: results.meta?.fields || [],
                duplicates: [],
              });
              return;
            }
          }

          const headers = normalizeHeaders(results.meta?.fields || []);
          const rawRows = results.data || [];

          const result = processRows(rawRows, headers, schema);
          resolve(result);
        } catch (error) {
          resolve(createErrorResult(`CSV processing failed: ${error.message}`, 'PROCESSING_ERROR'));
        }
      },
      error(error) {
        resolve(createErrorResult(`CSV parsing failed: ${error.message}`, 'PARSE_ERROR'));
      },
    });
  });
}

/**
 * Imports and validates an Excel file.
 * @param {File} file - The Excel (.xlsx, .xls) file to import
 * @param {ImportSchema} schema - Schema definition for validation
 * @param {Object} [options] - Additional options
 * @param {string|number} [options.sheetName] - Specific sheet name or index to import (defaults to first sheet)
 * @returns {Promise<ImportResult>} Structured import result
 */
export function importExcel(file, schema, options = {}) {
  return new Promise((resolve) => {
    if (!file) {
      resolve(createErrorResult('No file provided', 'NO_FILE'));
      return;
    }

    if (!schema || typeof schema !== 'object') {
      resolve(createErrorResult('Schema must be a valid object', 'INVALID_SCHEMA'));
      return;
    }

    const maxSizeMB = 10;
    if (file.size > maxSizeMB * 1024 * 1024) {
      resolve(createErrorResult(`File size exceeds maximum of ${maxSizeMB} MB`, 'FILE_TOO_LARGE'));
      return;
    }

    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });

        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
          resolve(createErrorResult('Excel file contains no sheets', 'EMPTY_WORKBOOK'));
          return;
        }

        let sheetName;
        if (options.sheetName !== undefined && options.sheetName !== null) {
          if (typeof options.sheetName === 'number') {
            if (options.sheetName >= 0 && options.sheetName < workbook.SheetNames.length) {
              sheetName = workbook.SheetNames[options.sheetName];
            } else {
              resolve(createErrorResult(
                `Sheet index ${options.sheetName} is out of range (0-${workbook.SheetNames.length - 1})`,
                'INVALID_SHEET_INDEX'
              ));
              return;
            }
          } else {
            if (workbook.SheetNames.includes(options.sheetName)) {
              sheetName = options.sheetName;
            } else {
              resolve(createErrorResult(
                `Sheet "${options.sheetName}" not found. Available sheets: ${workbook.SheetNames.join(', ')}`,
                'SHEET_NOT_FOUND'
              ));
              return;
            }
          }
        } else {
          sheetName = workbook.SheetNames[0];
        }

        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, {
          defval: '',
          raw: false,
          dateNF: 'YYYY-MM-DD',
        });

        if (!jsonData || jsonData.length === 0) {
          resolve({
            success: true,
            data: [],
            totalRows: 0,
            successCount: 0,
            errorCount: 0,
            skippedCount: 0,
            errors: [],
            headers: [],
            duplicates: [],
          });
          return;
        }

        const headers = normalizeHeaders(Object.keys(jsonData[0]));
        const result = processRows(jsonData, headers, schema);
        resolve(result);
      } catch (error) {
        resolve(createErrorResult(`Excel processing failed: ${error.message}`, 'PROCESSING_ERROR'));
      }
    };

    reader.onerror = () => {
      resolve(createErrorResult('Failed to read the Excel file', 'FILE_READ_ERROR'));
    };

    reader.readAsArrayBuffer(file);
  });
}

/**
 * Exports data to a CSV file and triggers a browser download.
 * @param {Object[]} data - Array of data objects to export
 * @param {string} filename - Desired filename (without extension)
 * @param {Object} [options] - Export options
 * @param {string[]} [options.columns] - Specific columns to include (in order)
 * @param {Object.<string, string>} [options.columnLabels] - Map of field names to display labels
 * @returns {{ success: boolean, message: string, rowCount: number }}
 */
export function exportCSV(data, filename, options = {}) {
  try {
    if (!Array.isArray(data)) {
      return {
        success: false,
        message: 'Data must be an array',
        rowCount: 0,
      };
    }

    if (!filename || typeof filename !== 'string') {
      return {
        success: false,
        message: 'Filename must be a non-empty string',
        rowCount: 0,
      };
    }

    if (data.length === 0) {
      return {
        success: true,
        message: 'No data to export',
        rowCount: 0,
      };
    }

    let exportData = data;
    const columns = options.columns || null;
    const columnLabels = options.columnLabels || {};

    if (columns && Array.isArray(columns)) {
      exportData = data.map((row) => {
        const filtered = {};
        columns.forEach((col) => {
          const label = columnLabels[col] || col;
          filtered[label] = row[col] !== undefined ? row[col] : '';
        });
        return filtered;
      });
    } else if (Object.keys(columnLabels).length > 0) {
      exportData = data.map((row) => {
        const labeled = {};
        Object.keys(row).forEach((key) => {
          const label = columnLabels[key] || key;
          labeled[label] = row[key];
        });
        return labeled;
      });
    }

    const csv = Papa.unparse(exportData, {
      quotes: true,
      quoteChar: '"',
      escapeChar: '"',
      header: true,
      newline: '\r\n',
    });

    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9_\-. ]/g, '_');
    const fullFilename = sanitizedFilename.endsWith('.csv') ? sanitizedFilename : `${sanitizedFilename}.csv`;

    triggerDownload(blob, fullFilename);

    return {
      success: true,
      message: `Successfully exported ${data.length} rows to ${fullFilename}`,
      rowCount: data.length,
    };
  } catch (error) {
    return {
      success: false,
      message: `CSV export failed: ${error.message}`,
      rowCount: 0,
    };
  }
}

/**
 * Exports data to an Excel (.xlsx) file and triggers a browser download.
 * @param {Object[]} data - Array of data objects to export
 * @param {string} filename - Desired filename (without extension)
 * @param {Object} [options] - Export options
 * @param {string[]} [options.columns] - Specific columns to include (in order)
 * @param {Object.<string, string>} [options.columnLabels] - Map of field names to display labels
 * @param {string} [options.sheetName] - Name for the worksheet (default: 'Sheet1')
 * @returns {{ success: boolean, message: string, rowCount: number }}
 */
export function exportExcel(data, filename, options = {}) {
  try {
    if (!Array.isArray(data)) {
      return {
        success: false,
        message: 'Data must be an array',
        rowCount: 0,
      };
    }

    if (!filename || typeof filename !== 'string') {
      return {
        success: false,
        message: 'Filename must be a non-empty string',
        rowCount: 0,
      };
    }

    if (data.length === 0) {
      return {
        success: true,
        message: 'No data to export',
        rowCount: 0,
      };
    }

    const columns = options.columns || null;
    const columnLabels = options.columnLabels || {};
    const sheetName = options.sheetName || 'Sheet1';

    let exportData = data;

    if (columns && Array.isArray(columns)) {
      exportData = data.map((row) => {
        const filtered = {};
        columns.forEach((col) => {
          const label = columnLabels[col] || col;
          filtered[label] = row[col] !== undefined ? row[col] : '';
        });
        return filtered;
      });
    } else if (Object.keys(columnLabels).length > 0) {
      exportData = data.map((row) => {
        const labeled = {};
        Object.keys(row).forEach((key) => {
          const label = columnLabels[key] || key;
          labeled[label] = row[key];
        });
        return labeled;
      });
    }

    const worksheet = XLSX.utils.json_to_sheet(exportData);

    const colWidths = [];
    if (exportData.length > 0) {
      const headerKeys = Object.keys(exportData[0]);
      headerKeys.forEach((key) => {
        let maxWidth = key.length;
        exportData.forEach((row) => {
          const cellValue = row[key];
          if (cellValue !== null && cellValue !== undefined) {
            const cellLength = String(cellValue).length;
            if (cellLength > maxWidth) {
              maxWidth = cellLength;
            }
          }
        });
        colWidths.push({ wch: Math.min(maxWidth + 2, 50) });
      });
      worksheet['!cols'] = colWidths;
    }

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

    const excelBuffer = XLSX.write(workbook, {
      bookType: 'xlsx',
      type: 'array',
    });

    const blob = new Blob([excelBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9_\-. ]/g, '_');
    const fullFilename = sanitizedFilename.endsWith('.xlsx') ? sanitizedFilename : `${sanitizedFilename}.xlsx`;

    triggerDownload(blob, fullFilename);

    return {
      success: true,
      message: `Successfully exported ${data.length} rows to ${fullFilename}`,
      rowCount: data.length,
    };
  } catch (error) {
    return {
      success: false,
      message: `Excel export failed: ${error.message}`,
      rowCount: 0,
    };
  }
}

/**
 * Triggers a file download in the browser.
 * @param {Blob} blob - The file blob to download
 * @param {string} filename - The filename for the download
 */
function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Generates a CSV template string for a given schema.
 * Useful for providing users with a downloadable template.
 * @param {ImportSchema} schema - The schema to generate a template for
 * @returns {{ success: boolean, message: string }}
 */
export function downloadTemplate(schema, filename) {
  try {
    if (!schema || typeof schema !== 'object') {
      return {
        success: false,
        message: 'Schema must be a valid object',
      };
    }

    const allFields = [
      ...(schema.requiredFields || []),
      ...(schema.optionalFields || []),
    ];

    if (allFields.length === 0) {
      return {
        success: false,
        message: 'Schema must define at least one field',
      };
    }

    const templateRow = {};
    allFields.forEach((field) => {
      templateRow[field] = '';
    });

    const csv = Papa.unparse([templateRow], {
      quotes: true,
      quoteChar: '"',
      escapeChar: '"',
      header: true,
      newline: '\r\n',
    });

    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
    const sanitizedFilename = (filename || 'import_template').replace(/[^a-zA-Z0-9_\-. ]/g, '_');
    const fullFilename = sanitizedFilename.endsWith('.csv') ? sanitizedFilename : `${sanitizedFilename}.csv`;

    triggerDownload(blob, fullFilename);

    return {
      success: true,
      message: `Template downloaded as ${fullFilename}`,
    };
  } catch (error) {
    return {
      success: false,
      message: `Template generation failed: ${error.message}`,
    };
  }
}