import { useState, useRef, useCallback } from 'react';
import PropTypes from 'prop-types';
import { getHealthIndicator, formatPercentage, formatNumber } from '@/utils/formatUtils';

/**
 * @typedef {Object} HealthThresholds
 * @property {number} [green=90] - Minimum value for green status (or max if invertScale)
 * @property {number} [amber=70] - Minimum value for amber status (or max if invertScale)
 * @property {boolean} [invertScale=false] - If true, lower values are better
 */

/**
 * Visual health indicator component showing a colored dot or icon with tooltip
 * for metric health status. Used in sprint summary tables and application status views.
 *
 * @param {Object} props
 * @param {number|null|undefined} props.value - The metric value to evaluate
 * @param {HealthThresholds} [props.thresholds] - Threshold configuration for RAG status
 * @param {string} [props.label] - Optional label displayed next to the indicator
 * @param {string} [props.unit] - Unit of measurement ('percentage', 'count', 'hours', 'ms')
 * @param {string} [props.tooltipText] - Custom tooltip text override
 * @param {'dot'|'badge'|'icon'} [props.variant='dot'] - Visual variant of the indicator
 * @param {'sm'|'md'|'lg'} [props.size='md'] - Size of the indicator
 * @param {boolean} [props.showValue=false] - Whether to display the numeric value
 * @param {string} [props.className] - Additional CSS classes
 */
export function HealthIndicator({
  value,
  thresholds,
  label,
  unit,
  tooltipText,
  variant = 'dot',
  size = 'md',
  showValue = false,
  className = '',
}) {
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);
  const tooltipTimeoutRef = useRef(null);
  const containerRef = useRef(null);

  const { status, colors } = getHealthIndicator(value, thresholds);

  const handleMouseEnter = useCallback(() => {
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
    }
    tooltipTimeoutRef.current = setTimeout(() => {
      setIsTooltipVisible(true);
    }, 200);
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
    }
    setIsTooltipVisible(false);
  }, []);

  const handleFocus = useCallback(() => {
    setIsTooltipVisible(true);
  }, []);

  const handleBlur = useCallback(() => {
    setIsTooltipVisible(false);
  }, []);

  /**
   * Formats the display value based on the unit type.
   * @param {number|null|undefined} val
   * @param {string} [unitType]
   * @returns {string}
   */
  const formatDisplayValue = (val, unitType) => {
    if (val === null || val === undefined || isNaN(Number(val))) {
      return 'N/A';
    }

    switch (unitType) {
      case 'percentage':
        return formatPercentage(val);
      case 'hours':
        return `${formatNumber(val, { maximumFractionDigits: 1 })}h`;
      case 'ms':
        return `${formatNumber(val, { maximumFractionDigits: 0 })}ms`;
      case 'count':
        return formatNumber(val, { maximumFractionDigits: 0 });
      default:
        return formatNumber(val);
    }
  };

  const displayValue = formatDisplayValue(value, unit);

  const resolvedTooltipText =
    tooltipText ||
    `${label ? `${label}: ` : ''}${displayValue} — ${status}`;

  const dotSizeClasses = {
    sm: 'h-2 w-2',
    md: 'h-3 w-3',
    lg: 'h-4 w-4',
  };

  const textSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };

  const badgePaddingClasses = {
    sm: 'px-1.5 py-0.5',
    md: 'px-2 py-0.5',
    lg: 'px-2.5 py-1',
  };

  const renderDot = () => (
    <span
      className={`inline-block rounded-full ${colors.dot} ${dotSizeClasses[size] || dotSizeClasses.md} flex-shrink-0`}
      aria-hidden="true"
    />
  );

  const renderBadge = () => (
    <span
      className={`inline-flex items-center rounded-full ${colors.bg} ${colors.text} ${colors.border} border font-medium ${badgePaddingClasses[size] || badgePaddingClasses.md} ${textSizeClasses[size] || textSizeClasses.md}`}
    >
      {renderDot()}
      <span className="ml-1.5">{showValue ? displayValue : status}</span>
    </span>
  );

  const renderIcon = () => {
    const iconSizeClasses = {
      sm: 'h-4 w-4',
      md: 'h-5 w-5',
      lg: 'h-6 w-6',
    };

    const iconSize = iconSizeClasses[size] || iconSizeClasses.md;

    if (status === 'Green') {
      return (
        <svg
          className={`${iconSize} text-green-500`}
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
          />
        </svg>
      );
    }

    if (status === 'Amber') {
      return (
        <svg
          className={`${iconSize} text-amber-500`}
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
          />
        </svg>
      );
    }

    if (status === 'Red') {
      return (
        <svg
          className={`${iconSize} text-red-500`}
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m9.75 9.75 4.5 4.5m0-4.5-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
          />
        </svg>
      );
    }

    return (
      <svg
        className={`${iconSize} text-gray-400`}
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={2}
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z"
        />
      </svg>
    );
  };

  const renderIndicator = () => {
    switch (variant) {
      case 'badge':
        return renderBadge();
      case 'icon':
        return renderIcon();
      case 'dot':
      default:
        return (
          <span className="inline-flex items-center gap-1.5">
            {renderDot()}
            {showValue && (
              <span className={`${textSizeClasses[size] || textSizeClasses.md} text-gray-700 dark:text-gray-300`}>
                {displayValue}
              </span>
            )}
            {label && !showValue && (
              <span className={`${textSizeClasses[size] || textSizeClasses.md} text-gray-700 dark:text-gray-300`}>
                {label}
              </span>
            )}
          </span>
        );
    }
  };

  return (
    <span
      ref={containerRef}
      className={`relative inline-flex items-center ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleFocus}
      onBlur={handleBlur}
      tabIndex={0}
      role="status"
      aria-label={resolvedTooltipText}
    >
      {renderIndicator()}

      {isTooltipVisible && (
        <span
          className="absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 whitespace-nowrap rounded-md bg-gray-900 px-3 py-1.5 text-xs font-medium text-white shadow-lg dark:bg-gray-700"
          role="tooltip"
        >
          {resolvedTooltipText}
          <span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-gray-900 dark:border-t-gray-700" />
        </span>
      )}
    </span>
  );
}

HealthIndicator.propTypes = {
  value: PropTypes.number,
  thresholds: PropTypes.shape({
    green: PropTypes.number,
    amber: PropTypes.number,
    invertScale: PropTypes.bool,
  }),
  label: PropTypes.string,
  unit: PropTypes.oneOf(['percentage', 'count', 'hours', 'ms']),
  tooltipText: PropTypes.string,
  variant: PropTypes.oneOf(['dot', 'badge', 'icon']),
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  showValue: PropTypes.bool,
  className: PropTypes.string,
};

HealthIndicator.defaultProps = {
  value: undefined,
  thresholds: undefined,
  label: '',
  unit: undefined,
  tooltipText: '',
  variant: 'dot',
  size: 'md',
  showValue: false,
  className: '',
};

export default HealthIndicator;