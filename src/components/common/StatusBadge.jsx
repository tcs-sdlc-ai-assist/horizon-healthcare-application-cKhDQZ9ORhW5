import PropTypes from 'prop-types';
import { formatRAGStatus, getStatusColor } from '@/utils/formatUtils';

const STATUS_ICONS = {
  Red: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-3.5 w-3.5"
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
  ),
  Amber: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-3.5 w-3.5"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
        clipRule="evenodd"
      />
    </svg>
  ),
  Green: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-3.5 w-3.5"
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
  ),
  Unknown: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-3.5 w-3.5"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z"
        clipRule="evenodd"
      />
    </svg>
  ),
};

const CONTEXTUAL_ICONS = {
  success: STATUS_ICONS.Green,
  failure: STATUS_ICONS.Red,
  failed: STATUS_ICONS.Red,
  pending: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-3.5 w-3.5 animate-spin"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
        clipRule="evenodd"
      />
    </svg>
  ),
  healthy: STATUS_ICONS.Green,
  warning: STATUS_ICONS.Amber,
  critical: STATUS_ICONS.Red,
  degraded: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-3.5 w-3.5"
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
  ),
};

const CONTEXTUAL_COLORS = {
  success: {
    bg: 'bg-green-100',
    text: 'text-green-700',
    border: 'border-green-300',
    dot: 'bg-green-500',
  },
  failure: {
    bg: 'bg-red-100',
    text: 'text-red-700',
    border: 'border-red-300',
    dot: 'bg-red-500',
  },
  failed: {
    bg: 'bg-red-100',
    text: 'text-red-700',
    border: 'border-red-300',
    dot: 'bg-red-500',
  },
  pending: {
    bg: 'bg-blue-100',
    text: 'text-blue-700',
    border: 'border-blue-300',
    dot: 'bg-blue-500',
  },
  healthy: {
    bg: 'bg-green-100',
    text: 'text-green-700',
    border: 'border-green-300',
    dot: 'bg-green-500',
  },
  warning: {
    bg: 'bg-amber-100',
    text: 'text-amber-700',
    border: 'border-amber-300',
    dot: 'bg-amber-500',
  },
  critical: {
    bg: 'bg-red-100',
    text: 'text-red-700',
    border: 'border-red-300',
    dot: 'bg-red-500',
  },
  degraded: {
    bg: 'bg-orange-100',
    text: 'text-orange-700',
    border: 'border-orange-300',
    dot: 'bg-orange-500',
  },
};

const SIZE_CLASSES = {
  sm: 'px-1.5 py-0.5 text-2xs gap-1',
  md: 'px-2.5 py-0.5 text-xs gap-1.5',
  lg: 'px-3 py-1 text-sm gap-1.5',
};

/**
 * Resolves the display label, color classes, and icon for a given status string.
 * Supports RAG statuses (red, amber, green) and contextual statuses
 * (success, failure, failed, pending, healthy, warning, critical, degraded).
 *
 * @param {string} status - The status value to resolve
 * @returns {{ label: string, colors: { bg: string, text: string, border: string, dot: string }, icon: JSX.Element }}
 */
function resolveStatus(status) {
  if (!status || typeof status !== 'string') {
    return {
      label: 'Unknown',
      colors: getStatusColor('unknown'),
      icon: STATUS_ICONS.Unknown,
    };
  }

  const normalized = status.trim().toLowerCase();

  if (CONTEXTUAL_COLORS[normalized]) {
    const contextLabel = normalized.charAt(0).toUpperCase() + normalized.slice(1);
    return {
      label: contextLabel,
      colors: CONTEXTUAL_COLORS[normalized],
      icon: CONTEXTUAL_ICONS[normalized] || STATUS_ICONS.Unknown,
    };
  }

  const ragLabel = formatRAGStatus(status);
  const ragColors = getStatusColor(status);
  const ragIcon = STATUS_ICONS[ragLabel] || STATUS_ICONS.Unknown;

  return {
    label: ragLabel,
    colors: ragColors,
    icon: ragIcon,
  };
}

/**
 * Small badge component displaying RAG (Red/Amber/Green) status or
 * success/failure/pending icons. Used in status matrices and summary
 * tables across all dashboards.
 *
 * @param {object} props
 * @param {string} props.status - Status value (e.g., 'red', 'amber', 'green', 'success', 'failure', 'pending', 'healthy', 'warning', 'critical', 'degraded')
 * @param {string} [props.label] - Optional custom label to override the default resolved label
 * @param {'sm'|'md'|'lg'} [props.size='md'] - Badge size variant
 * @param {boolean} [props.showIcon=true] - Whether to display the status icon
 * @param {boolean} [props.showDot=false] - Whether to display a colored dot instead of an icon
 * @param {boolean} [props.bordered=false] - Whether to display a border around the badge
 * @param {string} [props.className] - Additional CSS classes to apply
 * @returns {JSX.Element}
 */
export function StatusBadge({
  status,
  label: customLabel,
  size = 'md',
  showIcon = true,
  showDot = false,
  bordered = false,
  className = '',
}) {
  const resolved = resolveStatus(status);
  const displayLabel = customLabel || resolved.label;
  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.md;

  const borderClass = bordered ? `border ${resolved.colors.border}` : '';

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${resolved.colors.bg} ${resolved.colors.text} ${sizeClass} ${borderClass} ${className}`.trim()}
      role="status"
      aria-label={`Status: ${displayLabel}`}
    >
      {showDot && !showIcon && (
        <span
          className={`h-1.5 w-1.5 rounded-full ${resolved.colors.dot}`}
          aria-hidden="true"
        />
      )}
      {showIcon && resolved.icon}
      <span>{displayLabel}</span>
    </span>
  );
}

StatusBadge.propTypes = {
  status: PropTypes.string.isRequired,
  label: PropTypes.string,
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  showIcon: PropTypes.bool,
  showDot: PropTypes.bool,
  bordered: PropTypes.bool,
  className: PropTypes.string,
};

StatusBadge.defaultProps = {
  label: '',
  size: 'md',
  showIcon: true,
  showDot: false,
  bordered: false,
  className: '',
};

export default StatusBadge;