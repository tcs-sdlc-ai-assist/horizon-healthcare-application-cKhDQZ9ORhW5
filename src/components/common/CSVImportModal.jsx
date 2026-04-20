import { useState, useCallback, useRef, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useAuth } from '@/context/AuthContext';
import { canImport } from '@/constants/roles';
import { importData, getDataTypes, getImportSchema } from '@/services/dataService';

/**
 * @typedef {Object} CSVImportModalProps
 * @property {boolean} isOpen - Whether the modal is visible
 * @property {Function} onClose - Callback to close the modal
 * @property {string} dataType - The data type to import into (must match a DATA_TYPES value)
 * @property {Function} [onImportComplete] - Callback invoked after a successful import with the result
 * @property {string} [title] - Custom modal title
 */

const ACCEPTED_FILE_TYPES = {
  'text/csv': ['.csv'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/vnd.ms-excel': ['.xls'],
};

const ACCEPTED_EXTENSIONS = ['.csv', '.xlsx', '.xls'];

const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

/**
 * Validates that a file has an accepted extension and MIME type.
 * @param {File} file
 * @returns {{ valid: boolean, error: string|null }}
 */
function validateFileType(file) {
  if (!file) {
    return { valid: false, error: 'No file selected.' };
  }

  const fileName = file.name || '';
  const extension = fileName.substring(fileName.lastIndexOf('.')).toLowerCase();

  if (!ACCEPTED_EXTENSIONS.includes(extension)) {
    return {
      valid: false,
      error: `Unsupported file type "${extension}". Accepted formats: ${ACCEPTED_EXTENSIONS.join(', ')}`,
    };
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `File size (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds the maximum of ${MAX_FILE_SIZE_MB} MB.`,
    };
  }

  return { valid: true, error: null };
}

/**
 * Formats a file size in bytes to a human-readable string.
 * @param {number} bytes
 * @returns {string}
 */
function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * CSVImportModal — Modal dialog component for CSV/Excel file upload.
 *
 * Includes drag-and-drop zone, file type validation (.csv, .xlsx, .xls),
 * progress indicator, schema validation results display, error summary
 * with row/column details, and confirm/cancel buttons.
 *
 * Checks RBAC permissions before rendering. Uses csvService (via dataService)
 * for parsing and dataService for persistence.
 *
 * @param {CSVImportModalProps} props
 * @returns {JSX.Element|null}
 */
export function CSVImportModal({
  isOpen,
  onClose,
  dataType,
  onImportComplete,
  title,
}) {
  const { user } = useAuth();
  const fileInputRef = useRef(null);

  const [selectedFile, setSelectedFile] = useState(null);
  const [fileError, setFileError] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [importMode, setImportMode] = useState('append');
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [importProgress, setImportProgress] = useState(0);

  const hasPermission = useMemo(() => {
    if (!user || !user.role) return false;
    return canImport(user.role);
  }, [user]);

  const schema = useMemo(() => {
    return getImportSchema(dataType);
  }, [dataType]);

  const requiredFields = useMemo(() => {
    return schema.requiredFields || [];
  }, [schema]);

  const optionalFields = useMemo(() => {
    return schema.optionalFields || [];
  }, [schema]);

  const modalTitle = title || `Import Data — ${dataType || 'Unknown'}`;

  /**
   * Resets the modal state to its initial values.
   */
  const resetState = useCallback(() => {
    setSelectedFile(null);
    setFileError(null);
    setIsDragOver(false);
    setImportMode('append');
    setIsImporting(false);
    setImportResult(null);
    setImportProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  /**
   * Handles closing the modal and resetting state.
   */
  const handleClose = useCallback(() => {
    if (isImporting) return;
    resetState();
    if (typeof onClose === 'function') {
      onClose();
    }
  }, [isImporting, resetState, onClose]);

  /**
   * Handles file selection from the file input or drag-and-drop.
   * @param {File} file
   */
  const handleFileSelect = useCallback((file) => {
    setImportResult(null);
    setImportProgress(0);

    const validation = validateFileType(file);
    if (!validation.valid) {
      setSelectedFile(null);
      setFileError(validation.error);
      return;
    }

    setSelectedFile(file);
    setFileError(null);
  }, []);

  /**
   * Handles the file input change event.
   * @param {React.ChangeEvent<HTMLInputElement>} e
   */
  const handleInputChange = useCallback(
    (e) => {
      const file = e.target.files?.[0];
      if (file) {
        handleFileSelect(file);
      }
    },
    [handleFileSelect]
  );

  /**
   * Handles drag over events on the drop zone.
   * @param {React.DragEvent} e
   */
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  /**
   * Handles drag leave events on the drop zone.
   * @param {React.DragEvent} e
   */
  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  /**
   * Handles drop events on the drop zone.
   * @param {React.DragEvent} e
   */
  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      const file = e.dataTransfer?.files?.[0];
      if (file) {
        handleFileSelect(file);
      }
    },
    [handleFileSelect]
  );

  /**
   * Opens the native file picker dialog.
   */
  const handleBrowseClick = useCallback(() => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, []);

  /**
   * Clears the currently selected file.
   */
  const handleClearFile = useCallback(() => {
    setSelectedFile(null);
    setFileError(null);
    setImportResult(null);
    setImportProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  /**
   * Executes the import operation.
   */
  const handleImport = useCallback(async () => {
    if (!selectedFile || !user || !hasPermission || isImporting) return;

    setIsImporting(true);
    setImportResult(null);
    setImportProgress(10);

    try {
      setImportProgress(30);

      const result = await importData(selectedFile, dataType, user, {
        mode: importMode,
      });

      setImportProgress(100);
      setImportResult(result);

      if (result.success && typeof onImportComplete === 'function') {
        onImportComplete(result);
      }
    } catch (error) {
      setImportResult({
        success: false,
        importedRecords: 0,
        errorCount: 1,
        skippedCount: 0,
        errors: [
          {
            row: null,
            column: null,
            message: `Import failed: ${error.message || 'Unknown error'}`,
            code: 'IMPORT_EXCEPTION',
          },
        ],
        message: `Import failed: ${error.message || 'Unknown error'}`,
      });
    } finally {
      setIsImporting(false);
    }
  }, [selectedFile, user, hasPermission, isImporting, dataType, importMode, onImportComplete]);

  /**
   * Handles keyboard events on the modal backdrop for accessibility.
   * @param {React.KeyboardEvent} e
   */
  const handleBackdropKeyDown = useCallback(
    (e) => {
      if (e.key === 'Escape' && !isImporting) {
        handleClose();
      }
    },
    [isImporting, handleClose]
  );

  if (!isOpen) {
    return null;
  }

  if (!hasPermission) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        role="dialog"
        aria-modal="true"
        aria-label="Import Data"
        onKeyDown={handleBackdropKeyDown}
      >
        <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-lg dark:border-slate-700 dark:bg-slate-800">
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <svg
              className="mb-4 h-12 w-12 text-red-500"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636"
              />
            </svg>
            <h3 className="mb-2 text-lg font-semibold text-slate-800 dark:text-slate-100">
              Access Denied
            </h3>
            <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
              Your role does not have permission to import data.
            </p>
            <button
              type="button"
              onClick={handleClose}
              className="btn-secondary"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  const hasErrors = importResult && importResult.errors && importResult.errors.length > 0;
  const showErrorDetails = hasErrors && importResult.errors.filter((e) => e.row !== null).length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={modalTitle}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isImporting) {
          handleClose();
        }
      }}
      onKeyDown={handleBackdropKeyDown}
    >
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-700">
          <div>
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
              {modalTitle}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Upload a CSV or Excel file to import data
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={isImporting}
            className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-slate-700 dark:hover:text-slate-300"
            aria-label="Close modal"
          >
            <svg
              className="h-5 w-5"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18 18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Drop Zone */}
          {!importResult && (
            <div
              className={`relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors ${
                isDragOver
                  ? 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/20'
                  : selectedFile
                    ? 'border-green-400 bg-green-50 dark:border-green-500 dark:bg-green-900/20'
                    : 'border-slate-300 bg-slate-50 hover:border-slate-400 dark:border-slate-600 dark:bg-slate-800/50 dark:hover:border-slate-500'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleInputChange}
                className="hidden"
                aria-label="Select file to import"
              />

              {selectedFile ? (
                <div className="flex flex-col items-center gap-2">
                  <svg
                    className="h-10 w-10 text-green-500"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                    />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                      {selectedFile.name}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      {formatFileSize(selectedFile.size)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleClearFile}
                    disabled={isImporting}
                    className="mt-1 text-xs font-medium text-red-600 transition-colors hover:text-red-800 disabled:cursor-not-allowed disabled:opacity-50 dark:text-red-400 dark:hover:text-red-300"
                  >
                    Remove file
                  </button>
                </div>
              ) : (
                <>
                  <svg
                    className="mb-3 h-10 w-10 text-slate-400 dark:text-slate-500"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"
                    />
                  </svg>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Drag and drop your file here
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    or{' '}
                    <button
                      type="button"
                      onClick={handleBrowseClick}
                      className="font-medium text-blue-600 transition-colors hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                      browse files
                    </button>
                  </p>
                  <p className="mt-2 text-2xs text-slate-400 dark:text-slate-500">
                    Accepted formats: CSV, XLSX, XLS (max {MAX_FILE_SIZE_MB} MB)
                  </p>
                </>
              )}
            </div>
          )}

          {/* File Validation Error */}
          {fileError && (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 dark:border-red-800 dark:bg-red-900/20">
              <svg
                className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500 dark:text-red-400"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              <p className="text-sm text-red-700 dark:text-red-300">{fileError}</p>
            </div>
          )}

          {/* Import Mode Selection */}
          {!importResult && selectedFile && (
            <div className="mt-4">
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Import Mode
              </label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                  <input
                    type="radio"
                    name="importMode"
                    value="append"
                    checked={importMode === 'append'}
                    onChange={() => setImportMode('append')}
                    disabled={isImporting}
                    className="h-4 w-4 border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  Append to existing data
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                  <input
                    type="radio"
                    name="importMode"
                    value="replace"
                    checked={importMode === 'replace'}
                    onChange={() => setImportMode('replace')}
                    disabled={isImporting}
                    className="h-4 w-4 border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  Replace existing data
                </label>
              </div>
              {importMode === 'replace' && (
                <p className="mt-1 text-2xs text-amber-600 dark:text-amber-400">
                  ⚠ Replace mode will overwrite all existing records for this data type.
                </p>
              )}
            </div>
          )}

          {/* Schema Info */}
          {!importResult && (
            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                Expected Schema
              </h4>
              {requiredFields.length > 0 && (
                <div className="mb-2">
                  <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    Required Fields:
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {requiredFields.map((field) => (
                      <span
                        key={field}
                        className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-2xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                      >
                        {field}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {optionalFields.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    Optional Fields:
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {optionalFields.map((field) => (
                      <span
                        key={field}
                        className="inline-flex items-center rounded-full bg-slate-200 px-2 py-0.5 text-2xs font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-400"
                      >
                        {field}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {requiredFields.length === 0 && optionalFields.length === 0 && (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  No specific schema defined for this data type. All columns will be imported.
                </p>
              )}
            </div>
          )}

          {/* Progress Indicator */}
          {isImporting && (
            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Importing...
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {importProgress}%
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                <div
                  className="h-full rounded-full bg-blue-600 transition-all duration-500 ease-out"
                  style={{ width: `${importProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Import Result */}
          {importResult && (
            <div className="mt-4 space-y-4">
              {/* Summary */}
              <div
                className={`rounded-lg border p-4 ${
                  importResult.success
                    ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20'
                    : 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20'
                }`}
              >
                <div className="flex items-start gap-3">
                  {importResult.success ? (
                    <svg
                      className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-500"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                  <div className="flex-1">
                    <p
                      className={`text-sm font-medium ${
                        importResult.success
                          ? 'text-green-800 dark:text-green-300'
                          : 'text-red-800 dark:text-red-300'
                      }`}
                    >
                      {importResult.message}
                    </p>
                    <div className="mt-2 grid grid-cols-3 gap-3">
                      <div className="rounded-md bg-white/60 p-2 text-center dark:bg-slate-800/60">
                        <p className="text-lg font-bold text-slate-800 dark:text-slate-100">
                          {importResult.importedRecords ?? 0}
                        </p>
                        <p className="text-2xs text-slate-500 dark:text-slate-400">
                          Imported
                        </p>
                      </div>
                      <div className="rounded-md bg-white/60 p-2 text-center dark:bg-slate-800/60">
                        <p className="text-lg font-bold text-amber-600 dark:text-amber-400">
                          {importResult.skippedCount ?? 0}
                        </p>
                        <p className="text-2xs text-slate-500 dark:text-slate-400">
                          Skipped
                        </p>
                      </div>
                      <div className="rounded-md bg-white/60 p-2 text-center dark:bg-slate-800/60">
                        <p className="text-lg font-bold text-red-600 dark:text-red-400">
                          {importResult.errorCount ?? 0}
                        </p>
                        <p className="text-2xs text-slate-500 dark:text-slate-400">
                          Errors
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Error Details Table */}
              {showErrorDetails && (
                <div className="rounded-lg border border-slate-200 dark:border-slate-700">
                  <div className="border-b border-slate-200 px-4 py-2 dark:border-slate-700">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                      Error Details ({importResult.errors.filter((e) => e.row !== null).length})
                    </h4>
                  </div>
                  <div className="max-h-48 overflow-y-auto scrollbar-thin">
                    <table className="w-full text-left text-xs">
                      <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800">
                        <tr>
                          <th className="px-4 py-2 font-medium text-slate-600 dark:text-slate-400">
                            Row
                          </th>
                          <th className="px-4 py-2 font-medium text-slate-600 dark:text-slate-400">
                            Column
                          </th>
                          <th className="px-4 py-2 font-medium text-slate-600 dark:text-slate-400">
                            Error
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                        {importResult.errors
                          .filter((e) => e.row !== null)
                          .slice(0, 50)
                          .map((error, index) => (
                            <tr
                              key={`error-${index}`}
                              className="hover:bg-slate-50 dark:hover:bg-slate-700/50"
                            >
                              <td className="whitespace-nowrap px-4 py-1.5 font-mono text-slate-700 dark:text-slate-300">
                                {error.row}
                              </td>
                              <td className="whitespace-nowrap px-4 py-1.5 text-slate-600 dark:text-slate-400">
                                {error.column || '—'}
                              </td>
                              <td className="px-4 py-1.5 text-red-600 dark:text-red-400">
                                {error.message}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                    {importResult.errors.filter((e) => e.row !== null).length > 50 && (
                      <div className="border-t border-slate-200 px-4 py-2 text-center text-2xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                        Showing first 50 of{' '}
                        {importResult.errors.filter((e) => e.row !== null).length} errors
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Header-level errors */}
              {hasErrors &&
                importResult.errors.filter((e) => e.row === null).length > 0 && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-900/20">
                    <h4 className="mb-1 text-xs font-semibold text-amber-800 dark:text-amber-300">
                      Schema Warnings
                    </h4>
                    <ul className="space-y-1">
                      {importResult.errors
                        .filter((e) => e.row === null)
                        .map((error, index) => (
                          <li
                            key={`header-error-${index}`}
                            className="text-xs text-amber-700 dark:text-amber-400"
                          >
                            • {error.message}
                          </li>
                        ))}
                    </ul>
                  </div>
                )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4 dark:border-slate-700">
          {importResult ? (
            <>
              {importResult.success && (
                <button
                  type="button"
                  onClick={() => {
                    resetState();
                  }}
                  className="btn-secondary"
                >
                  Import Another
                </button>
              )}
              {!importResult.success && (
                <button
                  type="button"
                  onClick={() => {
                    setImportResult(null);
                    setImportProgress(0);
                  }}
                  className="btn-secondary"
                >
                  Try Again
                </button>
              )}
              <button
                type="button"
                onClick={handleClose}
                className="btn-primary"
              >
                Done
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={handleClose}
                disabled={isImporting}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleImport}
                disabled={!selectedFile || isImporting || !!fileError}
                className="btn-primary disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isImporting ? (
                  <span className="flex items-center gap-2">
                    <div
                      className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
                      aria-hidden="true"
                    />
                    Importing...
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <svg
                      className="h-4 w-4"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"
                      />
                    </svg>
                    Import
                  </span>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

CSVImportModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  dataType: PropTypes.string.isRequired,
  onImportComplete: PropTypes.func,
  title: PropTypes.string,
};

CSVImportModal.defaultProps = {
  onImportComplete: null,
  title: '',
};

export default CSVImportModal;