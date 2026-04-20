import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useRoleGuard } from '@/hooks/useRoleGuard';
import { useAuth } from '@/context/AuthContext';
import { editField } from '@/services/dataService';
import { formatDate } from '@/utils/formatUtils';

/**
 * @typedef {Object} EditableFieldProps
 * @property {string} recordId - The ID of the record to edit
 * @property {string} field - The field name to update
 * @property {*} value - The current value of the field
 * @property {'text'|'number'|'select'} [type='text'] - The input type for editing
 * @property {Array<{label: string, value: string}>} [options] - Options for select type
 * @property {Function} [onSave] - Callback invoked after a successful save with { recordId, field, oldValue, newValue, auditEntry }
 * @property {string} [dataType] - The data type containing the record (passed to editField)
 * @property {string} [idField] - The field name used as the record identifier
 * @property {number} [min] - Minimum value for number inputs
 * @property {number} [max] - Maximum value for number inputs
 * @property {number} [step] - Step value for number inputs
 * @property {string} [placeholder] - Placeholder text for the input
 * @property {string} [className] - Additional CSS classes for the wrapper
 * @property {string} [lastEditedBy] - Name of the user who last edited this field
 * @property {string} [lastEditedAt] - ISO timestamp of the last edit
 */

/**
 * Returns Tailwind classes for RAG status display.
 * @param {string} value - The RAG status value
 * @returns {{ bg: string, text: string, dot: string }}
 */
function getRAGDisplayClasses(value) {
  if (!value || typeof value !== 'string') {
    return { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-600 dark:text-gray-400', dot: 'bg-gray-400' };
  }

  const normalized = value.trim().toLowerCase();

  switch (normalized) {
    case 'red':
    case 'r':
      return { bg: 'bg-red-50 dark:bg-red-900/20', text: 'text-red-700 dark:text-red-400', dot: 'bg-red-500' };
    case 'amber':
    case 'yellow':
    case 'a':
    case 'y':
      return { bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-700 dark:text-amber-400', dot: 'bg-amber-500' };
    case 'green':
    case 'g':
      return { bg: 'bg-green-50 dark:bg-green-900/20', text: 'text-green-700 dark:text-green-400', dot: 'bg-green-500' };
    default:
      return { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-600 dark:text-gray-400', dot: 'bg-gray-400' };
  }
}

/**
 * Formats a display value for rendering in read mode.
 * @param {*} value - The value to format
 * @param {'text'|'number'|'select'} type - The field type
 * @param {Array<{label: string, value: string}>} [options] - Options for select type
 * @returns {string}
 */
function formatDisplayValue(value, type, options) {
  if (value === null || value === undefined || value === '') {
    return '—';
  }

  if (type === 'select' && Array.isArray(options)) {
    const matched = options.find((opt) => String(opt.value) === String(value));
    if (matched) {
      return matched.label;
    }
  }

  if (type === 'number') {
    const num = Number(value);
    if (!isNaN(num)) {
      return num.toLocaleString('en-US');
    }
  }

  return String(value);
}

/**
 * Determines if the select options represent RAG status values.
 * @param {Array<{label: string, value: string}>} [options]
 * @returns {boolean}
 */
function isRAGSelect(options) {
  if (!Array.isArray(options) || options.length === 0) {
    return false;
  }

  const ragValues = ['red', 'amber', 'green', 'yellow', 'r', 'a', 'g', 'y'];
  return options.every((opt) =>
    ragValues.includes(String(opt.value).trim().toLowerCase())
  );
}

/**
 * EditableField — Reusable inline-editable field component.
 *
 * Supports text, number, and select (including RAG status) input types.
 * Shows the current value with an edit icon; clicking enters edit mode
 * with save/cancel buttons. On save, calls dataService.editField() and
 * logs via the audit service. Checks RBAC permissions via useRoleGuard
 * before allowing edits. Displays last-edited info tooltip on hover.
 *
 * @param {EditableFieldProps} props
 * @returns {JSX.Element}
 */
export function EditableField({
  recordId,
  field,
  value,
  type = 'text',
  options,
  onSave,
  dataType,
  idField,
  min,
  max,
  step,
  placeholder,
  className,
  lastEditedBy,
  lastEditedAt,
}) {
  const { canEdit } = useRoleGuard();
  const { user } = useAuth();

  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const inputRef = useRef(null);
  const containerRef = useRef(null);
  const tooltipTimeoutRef = useRef(null);
  const successTimeoutRef = useRef(null);

  const isRAG = useMemo(() => type === 'select' && isRAGSelect(options), [type, options]);

  // Sync editValue when the external value prop changes
  useEffect(() => {
    if (!isEditing) {
      setEditValue(value);
    }
  }, [value, isEditing]);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      if (type === 'text' && inputRef.current.select) {
        inputRef.current.select();
      }
    }
  }, [isEditing, type]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (tooltipTimeoutRef.current) {
        clearTimeout(tooltipTimeoutRef.current);
      }
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
      }
    };
  }, []);

  /**
   * Enters edit mode.
   */
  const handleStartEdit = useCallback(() => {
    if (!canEdit) {
      return;
    }
    setEditValue(value);
    setError(null);
    setSaveSuccess(false);
    setIsEditing(true);
  }, [canEdit, value]);

  /**
   * Cancels editing and reverts to the original value.
   */
  const handleCancel = useCallback(() => {
    setIsEditing(false);
    setEditValue(value);
    setError(null);
  }, [value]);

  /**
   * Saves the edited value via dataService.editField().
   */
  const handleSave = useCallback(async () => {
    if (!user) {
      setError('You must be logged in to edit fields.');
      return;
    }

    // Coerce the value based on type
    let coercedValue = editValue;
    if (type === 'number') {
      const num = Number(editValue);
      if (isNaN(num)) {
        setError('Please enter a valid number.');
        return;
      }
      if (min !== undefined && num < min) {
        setError(`Value must be at least ${min}.`);
        return;
      }
      if (max !== undefined && num > max) {
        setError(`Value must be no more than ${max}.`);
        return;
      }
      coercedValue = num;
    }

    if (type === 'text' && typeof coercedValue === 'string') {
      coercedValue = coercedValue.trim();
    }

    // Check if value actually changed
    if (coercedValue === value) {
      setIsEditing(false);
      setError(null);
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const result = await editField(recordId, field, coercedValue, {
        name: user.name || user.id,
        role: user.role,
      }, {
        dataType: dataType || undefined,
        idField: idField || undefined,
      });

      if (result.success) {
        setIsEditing(false);
        setSaveSuccess(true);

        if (successTimeoutRef.current) {
          clearTimeout(successTimeoutRef.current);
        }
        successTimeoutRef.current = setTimeout(() => {
          setSaveSuccess(false);
        }, 2000);

        if (typeof onSave === 'function') {
          onSave({
            recordId,
            field,
            oldValue: value,
            newValue: coercedValue,
            auditEntry: result.auditEntry || null,
          });
        }
      } else {
        setError(result.error || 'Failed to save changes.');
      }
    } catch (err) {
      setError(`Save failed: ${err.message || 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  }, [editValue, value, type, min, max, user, recordId, field, dataType, idField, onSave]);

  /**
   * Handles input value changes.
   */
  const handleChange = useCallback((e) => {
    setEditValue(e.target.value);
    setError(null);
  }, []);

  /**
   * Handles keyboard events in edit mode.
   */
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  }, [handleSave, handleCancel]);

  /**
   * Handles keyboard events on the read-mode display.
   */
  const handleDisplayKeyDown = useCallback((e) => {
    if ((e.key === 'Enter' || e.key === ' ') && canEdit) {
      e.preventDefault();
      handleStartEdit();
    }
  }, [canEdit, handleStartEdit]);

  /**
   * Shows the last-edited tooltip.
   */
  const handleMouseEnter = useCallback(() => {
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
    }
    tooltipTimeoutRef.current = setTimeout(() => {
      setShowTooltip(true);
    }, 300);
  }, []);

  /**
   * Hides the last-edited tooltip.
   */
  const handleMouseLeave = useCallback(() => {
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
    }
    setShowTooltip(false);
  }, []);

  const displayValue = formatDisplayValue(value, type, options);
  const ragClasses = isRAG ? getRAGDisplayClasses(String(value)) : null;
  const hasEditInfo = lastEditedBy || lastEditedAt;

  // Render edit mode
  if (isEditing) {
    return (
      <div className={`inline-flex items-center gap-1.5 ${className || ''}`} ref={containerRef}>
        <div className="flex items-center gap-1.5">
          {type === 'select' && Array.isArray(options) ? (
            <select
              ref={inputRef}
              value={editValue ?? ''}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              disabled={isSaving}
              className="rounded-md border border-blue-400 bg-white px-2 py-1 text-sm text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-blue-500 dark:bg-slate-700 dark:text-slate-100"
              aria-label={`Edit ${field}`}
            >
              <option value="">Select...</option>
              {options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          ) : type === 'number' ? (
            <input
              ref={inputRef}
              type="number"
              value={editValue ?? ''}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              disabled={isSaving}
              min={min}
              max={max}
              step={step}
              placeholder={placeholder || ''}
              className="w-24 rounded-md border border-blue-400 bg-white px-2 py-1 text-sm text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-blue-500 dark:bg-slate-700 dark:text-slate-100"
              aria-label={`Edit ${field}`}
            />
          ) : (
            <input
              ref={inputRef}
              type="text"
              value={editValue ?? ''}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              disabled={isSaving}
              placeholder={placeholder || ''}
              className="rounded-md border border-blue-400 bg-white px-2 py-1 text-sm text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-blue-500 dark:bg-slate-700 dark:text-slate-100"
              aria-label={`Edit ${field}`}
            />
          )}

          {/* Save button */}
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="inline-flex items-center justify-center rounded-md p-1 text-green-600 transition-colors hover:bg-green-50 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-1 disabled:opacity-50 dark:text-green-400 dark:hover:bg-green-900/20"
            aria-label="Save changes"
            title="Save (Enter)"
          >
            {isSaving ? (
              <div
                className="h-4 w-4 animate-spin rounded-full border-2 border-green-300 border-t-green-600"
                aria-hidden="true"
              />
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            )}
          </button>

          {/* Cancel button */}
          <button
            type="button"
            onClick={handleCancel}
            disabled={isSaving}
            className="inline-flex items-center justify-center rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1 disabled:opacity-50 dark:hover:bg-slate-700 dark:hover:text-slate-300"
            aria-label="Cancel editing"
            title="Cancel (Escape)"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        {/* Error message */}
        {error && (
          <span className="text-xs text-red-600 dark:text-red-400" role="alert">
            {error}
          </span>
        )}
      </div>
    );
  }

  // Render read mode
  return (
    <div
      ref={containerRef}
      className={`relative inline-flex items-center gap-1.5 ${className || ''}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Value display */}
      <span
        role={canEdit ? 'button' : undefined}
        tabIndex={canEdit ? 0 : undefined}
        onClick={canEdit ? handleStartEdit : undefined}
        onKeyDown={canEdit ? handleDisplayKeyDown : undefined}
        className={`inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-sm transition-colors ${
          canEdit
            ? 'cursor-pointer hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 dark:hover:bg-blue-900/20'
            : ''
        } ${saveSuccess ? 'ring-2 ring-green-400/50' : ''}`}
        aria-label={
          canEdit
            ? `${field}: ${displayValue}. Click to edit.`
            : `${field}: ${displayValue}`
        }
      >
        {/* RAG dot for RAG select fields */}
        {isRAG && ragClasses && (
          <span
            className={`inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full ${ragClasses.dot}`}
            aria-hidden="true"
          />
        )}

        <span
          className={
            isRAG && ragClasses
              ? `font-medium ${ragClasses.text}`
              : 'text-slate-800 dark:text-slate-200'
          }
        >
          {displayValue}
        </span>

        {/* Edit icon */}
        {canEdit && (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-3.5 w-3.5 flex-shrink-0 text-slate-400 dark:text-slate-500"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
          </svg>
        )}

        {/* Success indicator */}
        {saveSuccess && (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-3.5 w-3.5 flex-shrink-0 text-green-500"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
        )}
      </span>

      {/* Last-edited tooltip */}
      {showTooltip && hasEditInfo && (
        <span
          className="absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 whitespace-nowrap rounded-md bg-gray-900 px-3 py-1.5 text-xs font-medium text-white shadow-lg dark:bg-gray-700"
          role="tooltip"
        >
          <span className="block">
            {lastEditedBy && (
              <span>
                Edited by <span className="font-semibold">{lastEditedBy}</span>
              </span>
            )}
          </span>
          {lastEditedAt && (
            <span className="block text-gray-300 dark:text-gray-400">
              {formatDate(lastEditedAt, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          )}
          <span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-gray-900 dark:border-t-gray-700" />
        </span>
      )}
    </div>
  );
}

EditableField.propTypes = {
  recordId: PropTypes.string.isRequired,
  field: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  type: PropTypes.oneOf(['text', 'number', 'select']),
  options: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string.isRequired,
      value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    })
  ),
  onSave: PropTypes.func,
  dataType: PropTypes.string,
  idField: PropTypes.string,
  min: PropTypes.number,
  max: PropTypes.number,
  step: PropTypes.number,
  placeholder: PropTypes.string,
  className: PropTypes.string,
  lastEditedBy: PropTypes.string,
  lastEditedAt: PropTypes.string,
};

EditableField.defaultProps = {
  value: null,
  type: 'text',
  options: null,
  onSave: null,
  dataType: '',
  idField: '',
  min: undefined,
  max: undefined,
  step: undefined,
  placeholder: '',
  className: '',
  lastEditedBy: '',
  lastEditedAt: '',
};

export default EditableField;