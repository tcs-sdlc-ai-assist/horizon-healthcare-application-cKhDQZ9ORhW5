import { useState, useRef, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { exportAsPDF, exportAsImage } from '@/services/exportService';
import { useRoleGuard } from '@/hooks/useRoleGuard';

/**
 * @typedef {Object} ExportOption
 * @property {string} key - Unique key for the export option
 * @property {string} label - Display label
 * @property {string} description - Short description of the export format
 * @property {string} format - Export format identifier ('pdf' | 'png' | 'jpeg')
 * @property {JSX.Element} icon - Icon element for the option
 */

/** @type {ExportOption[]} */
const EXPORT_OPTIONS = [
  {
    key: 'pdf',
    label: 'Export as PDF',
    description: 'Full dashboard with multi-page support',
    format: 'pdf',
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-4 w-4"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
        />
      </svg>
    ),
  },
  {
    key: 'png',
    label: 'Export as Image (PNG)',
    description: 'High-resolution PNG screenshot',
    format: 'png',
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-4 w-4"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z"
        />
      </svg>
    ),
  },
];

/**
 * Reusable export button component with dropdown menu offering PDF and Image (PNG)
 * export options. Accepts a ref to the dashboard container element to capture.
 * Uses exportService for generation. Shows loading spinner during export.
 * Checks RBAC permissions via useRoleGuard.
 *
 * @param {Object} props
 * @param {React.RefObject<HTMLElement>} props.targetRef - Ref to the DOM element to capture for export
 * @param {string} [props.filename='dashboard-export'] - Base filename for the exported file (without extension)
 * @param {string} [props.title] - Optional title to include in the PDF header
 * @param {string} [props.orientation='landscape'] - PDF page orientation ('landscape' | 'portrait')
 * @param {string} [props.className] - Additional CSS classes for the button wrapper
 * @param {boolean} [props.disabled=false] - Whether the button is disabled
 * @param {'sm'|'md'|'lg'} [props.size='md'] - Button size variant
 * @returns {JSX.Element|null}
 */
export function ExportButton({
  targetRef,
  filename = 'dashboard-export',
  title = '',
  orientation = 'landscape',
  className = '',
  disabled = false,
  size = 'md',
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState(null);
  const [activeFormat, setActiveFormat] = useState(null);
  const dropdownRef = useRef(null);

  const { canExport } = useRoleGuard();

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Close dropdown on Escape key
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
    }
  }, []);

  /**
   * Toggles the dropdown menu open/closed.
   */
  const handleToggle = useCallback(() => {
    if (isExporting) return;
    setIsOpen((prev) => !prev);
    setExportError(null);
  }, [isExporting]);

  /**
   * Handles an export action for the selected format.
   * @param {ExportOption} option - The selected export option
   */
  const handleExport = useCallback(
    async (option) => {
      if (isExporting || disabled) return;

      const element = targetRef?.current;
      if (!element) {
        setExportError('No content available to export. Please try again.');
        return;
      }

      setIsExporting(true);
      setActiveFormat(option.key);
      setExportError(null);
      setIsOpen(false);

      try {
        if (option.format === 'pdf') {
          await exportAsPDF(element, filename, {
            orientation,
            title,
            scale: 2,
          });
        } else if (option.format === 'png' || option.format === 'jpeg') {
          await exportAsImage(element, filename, option.format, {
            scale: 2,
          });
        }
      } catch (error) {
        console.error('Export failed:', error);
        setExportError(error.message || 'Export failed. Please try again.');
      } finally {
        setIsExporting(false);
        setActiveFormat(null);
      }
    },
    [isExporting, disabled, targetRef, filename, orientation, title]
  );

  // Do not render if user lacks export permission
  if (!canExport) {
    return null;
  }

  const sizeClasses = {
    sm: 'px-2.5 py-1.5 text-xs gap-1',
    md: 'px-3 py-2 text-sm gap-1.5',
    lg: 'px-4 py-2.5 text-sm gap-2',
  };

  const buttonSizeClass = sizeClasses[size] || sizeClasses.md;

  return (
    <div
      ref={dropdownRef}
      className={`relative inline-block ${className}`}
      onKeyDown={handleKeyDown}
    >
      {/* Export Button */}
      <button
        type="button"
        onClick={handleToggle}
        disabled={disabled || isExporting}
        className={`btn-secondary inline-flex items-center ${buttonSizeClass} ${
          isExporting ? 'cursor-wait opacity-70' : ''
        } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-label="Export dashboard"
      >
        {isExporting ? (
          <div
            className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600"
            aria-hidden="true"
          />
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"
            />
          </svg>
        )}
        <span>{isExporting ? 'Exporting…' : 'Export'}</span>
        {!isExporting && (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className={`h-3.5 w-3.5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && !isExporting && (
        <div className="absolute right-0 z-50 mt-1 w-64 rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-600 dark:bg-slate-800">
          <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-600">
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Export Options
            </p>
          </div>
          <ul role="menu" className="py-1" aria-label="Export format options">
            {EXPORT_OPTIONS.map((option) => (
              <li key={option.key} role="none">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => handleExport(option)}
                  className="flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors hover:bg-slate-50 focus:bg-slate-50 focus:outline-none dark:hover:bg-slate-700 dark:focus:bg-slate-700"
                >
                  <span className="mt-0.5 flex-shrink-0 text-slate-500 dark:text-slate-400">
                    {option.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                      {option.label}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {option.description}
                    </p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Export Error Toast */}
      {exportError && (
        <div
          className="absolute right-0 z-50 mt-1 w-72 rounded-lg border border-red-200 bg-red-50 p-3 shadow-lg dark:border-red-800 dark:bg-red-900/20"
          role="alert"
        >
          <div className="flex items-start gap-2">
            <svg
              className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500 dark:text-red-400"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-red-700 dark:text-red-300">
                Export Failed
              </p>
              <p className="mt-0.5 text-xs text-red-600 dark:text-red-400">
                {exportError}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setExportError(null)}
              className="flex-shrink-0 rounded p-0.5 text-red-400 transition-colors hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-800 dark:hover:text-red-300"
              aria-label="Dismiss error"
            >
              <svg
                className="h-3.5 w-3.5"
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
            </button>
          </div>
        </div>
      )}

      {/* Exporting Overlay Indicator */}
      {isExporting && activeFormat && (
        <div className="absolute right-0 z-50 mt-1 w-64 rounded-lg border border-blue-200 bg-blue-50 p-3 shadow-lg dark:border-blue-800 dark:bg-blue-900/20">
          <div className="flex items-center gap-2.5">
            <div
              className="h-4 w-4 animate-spin rounded-full border-2 border-blue-300 border-t-blue-600"
              aria-hidden="true"
            />
            <div>
              <p className="text-xs font-medium text-blue-700 dark:text-blue-300">
                Generating {activeFormat === 'pdf' ? 'PDF' : 'Image'}…
              </p>
              <p className="text-2xs text-blue-600 dark:text-blue-400">
                This may take a few seconds
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

ExportButton.propTypes = {
  targetRef: PropTypes.shape({
    current: PropTypes.instanceOf(typeof HTMLElement !== 'undefined' ? HTMLElement : Object),
  }).isRequired,
  filename: PropTypes.string,
  title: PropTypes.string,
  orientation: PropTypes.oneOf(['landscape', 'portrait']),
  className: PropTypes.string,
  disabled: PropTypes.bool,
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
};

ExportButton.defaultProps = {
  filename: 'dashboard-export',
  title: '',
  orientation: 'landscape',
  className: '',
  disabled: false,
  size: 'md',
};

export default ExportButton;