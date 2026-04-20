/**
 * Formatting utility functions for consistent data presentation
 * across all dashboard components.
 */

/**
 * Formats a numeric value as a percentage string.
 * @param {number|null|undefined} value - The value to format (e.g., 0.85 or 85)
 * @param {number} [decimals=1] - Number of decimal places
 * @returns {string} Formatted percentage string (e.g., "85.0%") or "N/A" if invalid
 */
export function formatPercentage(value, decimals = 1) {
  if (value === null || value === undefined || isNaN(Number(value))) {
    return 'N/A';
  }

  const numValue = Number(value);

  // If value is between -1 and 1 (exclusive of -1 and 1 for edge cases),
  // treat it as a decimal ratio and multiply by 100
  const percentage = Math.abs(numValue) <= 1 && numValue !== 0
    ? numValue * 100
    : numValue;

  return `${percentage.toFixed(decimals)}%`;
}

/**
 * Formats a number with locale-aware thousand separators.
 * @param {number|null|undefined} value - The number to format
 * @param {object} [options={}] - Intl.NumberFormat options
 * @param {number} [options.minimumFractionDigits=0] - Minimum decimal places
 * @param {number} [options.maximumFractionDigits=2] - Maximum decimal places
 * @returns {string} Formatted number string or "N/A" if invalid
 */
export function formatNumber(value, options = {}) {
  if (value === null || value === undefined || isNaN(Number(value))) {
    return 'N/A';
  }

  const {
    minimumFractionDigits = 0,
    maximumFractionDigits = 2,
    ...restOptions
  } = options;

  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits,
    maximumFractionDigits,
    ...restOptions,
  }).format(Number(value));
}

/**
 * Formats a date value into a human-readable string.
 * @param {Date|string|number|null|undefined} date - The date to format
 * @param {object} [options={}] - Intl.DateTimeFormat options
 * @returns {string} Formatted date string or "N/A" if invalid
 */
export function formatDate(date, options = {}) {
  if (date === null || date === undefined) {
    return 'N/A';
  }

  const dateObj = date instanceof Date ? date : new Date(date);

  if (isNaN(dateObj.getTime())) {
    return 'N/A';
  }

  const defaultOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...options,
  };

  return new Intl.DateTimeFormat('en-US', defaultOptions).format(dateObj);
}

/**
 * Formats a RAG (Red/Amber/Green) status string to a normalized label.
 * @param {string|null|undefined} status - The RAG status value (e.g., "red", "R", "amber", "A", "green", "G")
 * @returns {string} Normalized status label: "Red", "Amber", "Green", or "Unknown"
 */
export function formatRAGStatus(status) {
  if (!status || typeof status !== 'string') {
    return 'Unknown';
  }

  const normalized = status.trim().toLowerCase();

  const statusMap = {
    r: 'Red',
    red: 'Red',
    a: 'Amber',
    amber: 'Amber',
    yellow: 'Amber',
    y: 'Amber',
    g: 'Green',
    green: 'Green',
  };

  return statusMap[normalized] || 'Unknown';
}

/**
 * Truncates text to a specified maximum length, appending an ellipsis if truncated.
 * @param {string|null|undefined} text - The text to truncate
 * @param {number} [maxLength=100] - Maximum allowed length
 * @returns {string} Truncated text with ellipsis or original text if within limit
 */
export function truncateText(text, maxLength = 100) {
  if (!text || typeof text !== 'string') {
    return '';
  }

  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength).trimEnd()}…`;
}

/**
 * Returns a Tailwind-compatible color class string for a given RAG status.
 * @param {string|null|undefined} status - The status value (e.g., "red", "amber", "green", "R", "A", "G")
 * @returns {{ bg: string, text: string, border: string, dot: string }} Object with Tailwind color classes
 */
export function getStatusColor(status) {
  const normalizedStatus = formatRAGStatus(status);

  const colorMap = {
    Red: {
      bg: 'bg-red-100',
      text: 'text-red-700',
      border: 'border-red-300',
      dot: 'bg-red-500',
    },
    Amber: {
      bg: 'bg-amber-100',
      text: 'text-amber-700',
      border: 'border-amber-300',
      dot: 'bg-amber-500',
    },
    Green: {
      bg: 'bg-green-100',
      text: 'text-green-700',
      border: 'border-green-300',
      dot: 'bg-green-500',
    },
    Unknown: {
      bg: 'bg-gray-100',
      text: 'text-gray-700',
      border: 'border-gray-300',
      dot: 'bg-gray-500',
    },
  };

  return colorMap[normalizedStatus] || colorMap.Unknown;
}

/**
 * Determines a health indicator (RAG status) based on a value and threshold configuration.
 * @param {number|null|undefined} value - The metric value to evaluate
 * @param {object} thresholds - Threshold configuration
 * @param {number} thresholds.green - Minimum value for "Green" status (value >= green → Green)
 * @param {number} thresholds.amber - Minimum value for "Amber" status (value >= amber → Amber)
 * @param {boolean} [thresholds.invertScale=false] - If true, lower values are better (e.g., error rates)
 * @returns {{ status: string, colors: { bg: string, text: string, border: string, dot: string } }}
 *   Object containing the status label and corresponding color classes
 */
export function getHealthIndicator(value, thresholds = {}) {
  if (value === null || value === undefined || isNaN(Number(value))) {
    return {
      status: 'Unknown',
      colors: getStatusColor('unknown'),
    };
  }

  const numValue = Number(value);
  const { green = 90, amber = 70, invertScale = false } = thresholds;

  let status;

  if (invertScale) {
    // Lower is better (e.g., error rate, wait times)
    if (numValue <= green) {
      status = 'Green';
    } else if (numValue <= amber) {
      status = 'Amber';
    } else {
      status = 'Red';
    }
  } else {
    // Higher is better (e.g., satisfaction score, compliance rate)
    if (numValue >= green) {
      status = 'Green';
    } else if (numValue >= amber) {
      status = 'Amber';
    } else {
      status = 'Red';
    }
  }

  return {
    status,
    colors: getStatusColor(status),
  };
}