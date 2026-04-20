import { useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { formatNumber, formatPercentage } from '@/utils/formatUtils';

const TREND_CONFIG = {
  up: {
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-4 w-4"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path
          fillRule="evenodd"
          d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L10 6.414l-3.293 3.293a1 1 0 01-1.414 0z"
          clipRule="evenodd"
        />
      </svg>
    ),
    colorClass: 'text-green-600 dark:text-green-400',
    bgClass: 'bg-green-50 dark:bg-green-900/20',
    label: 'Trending up',
  },
  down: {
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-4 w-4"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path
          fillRule="evenodd"
          d="M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L10 13.586l3.293-3.293a1 1 0 011.414 0z"
          clipRule="evenodd"
        />
      </svg>
    ),
    colorClass: 'text-red-600 dark:text-red-400',
    bgClass: 'bg-red-50 dark:bg-red-900/20',
    label: 'Trending down',
  },
  flat: {
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-4 w-4"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path
          fillRule="evenodd"
          d="M5 10a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1z"
          clipRule="evenodd"
        />
      </svg>
    ),
    colorClass: 'text-gray-500 dark:text-gray-400',
    bgClass: 'bg-gray-50 dark:bg-gray-800/40',
    label: 'No change',
  },
};

/**
 * Formats the display value based on the unit type.
 * @param {number|string|null|undefined} value - The metric value
 * @param {string} unit - The unit type ('percentage', 'count', 'hours', 'days', 'ms', or custom string)
 * @returns {string} Formatted value string
 */
function formatDisplayValue(value, unit) {
  if (value === null || value === undefined || value === '') {
    return 'N/A';
  }

  const numValue = Number(value);

  if (isNaN(numValue)) {
    return String(value);
  }

  switch (unit) {
    case 'percentage':
      return formatPercentage(numValue > 1 ? numValue : numValue * 100, 1);
    case 'count':
      return formatNumber(numValue, { maximumFractionDigits: 0 });
    case 'hours':
      return `${formatNumber(numValue, { maximumFractionDigits: 1 })}h`;
    case 'days':
      return `${formatNumber(numValue, { maximumFractionDigits: 1 })}d`;
    case 'ms':
      return `${formatNumber(numValue, { maximumFractionDigits: 0 })}ms`;
    default:
      return unit
        ? `${formatNumber(numValue, { maximumFractionDigits: 2 })} ${unit}`
        : formatNumber(numValue, { maximumFractionDigits: 2 });
  }
}

/**
 * Summary metric card component displaying a single KPI value with label,
 * trend indicator (up/down/flat), and optional sparkline.
 *
 * Used for deploy metrics (Frequency, Lead Time, Change Failure Rate, Reliability)
 * and security/compliance snapshots.
 *
 * @param {object} props
 * @param {string} props.title - The metric label/title
 * @param {number|string} props.value - The primary KPI value to display
 * @param {'up'|'down'|'flat'} [props.trend] - Trend direction indicator
 * @param {string} [props.trendValue] - Optional trend delta text (e.g., "+5.2%")
 * @param {string} [props.unit] - Unit type for formatting ('percentage', 'count', 'hours', 'days', 'ms', or custom)
 * @param {boolean} [props.invertTrend] - If true, "down" is positive (green) and "up" is negative (red)
 * @param {Array<{value: number}>} [props.sparklineData] - Data points for the sparkline chart
 * @param {string} [props.sparklineColor] - Color for the sparkline stroke
 * @param {string} [props.description] - Optional description text below the value
 * @param {Function} [props.onClick] - Click handler for the card
 * @param {string} [props.className] - Additional CSS classes
 * @returns {JSX.Element}
 */
export function MetricCard({
  title,
  value,
  trend,
  trendValue,
  unit,
  invertTrend,
  sparklineData,
  sparklineColor,
  description,
  onClick,
  className,
}) {
  const [isHovered, setIsHovered] = useState(false);

  const formattedValue = useMemo(() => formatDisplayValue(value, unit), [value, unit]);

  const trendConfig = useMemo(() => {
    if (!trend) return null;

    const normalizedTrend = trend.toLowerCase();
    if (!TREND_CONFIG[normalizedTrend]) return null;

    if (invertTrend) {
      if (normalizedTrend === 'up') {
        return {
          ...TREND_CONFIG.up,
          colorClass: TREND_CONFIG.down.colorClass,
          bgClass: TREND_CONFIG.down.bgClass,
          label: 'Trending up (negative)',
        };
      }
      if (normalizedTrend === 'down') {
        return {
          ...TREND_CONFIG.down,
          colorClass: TREND_CONFIG.up.colorClass,
          bgClass: TREND_CONFIG.up.bgClass,
          label: 'Trending down (positive)',
        };
      }
    }

    return TREND_CONFIG[normalizedTrend];
  }, [trend, invertTrend]);

  const resolvedSparklineColor = useMemo(() => {
    if (sparklineColor) return sparklineColor;
    if (!trendConfig) return '#3B82F6';
    if (trendConfig.colorClass.includes('green')) return '#10B981';
    if (trendConfig.colorClass.includes('red')) return '#EF4444';
    return '#6B7280';
  }, [sparklineColor, trendConfig]);

  const normalizedSparklineData = useMemo(() => {
    if (!sparklineData || !Array.isArray(sparklineData) || sparklineData.length === 0) {
      return null;
    }
    return sparklineData.map((point, index) => {
      if (typeof point === 'number') {
        return { value: point, index };
      }
      if (point && typeof point === 'object' && 'value' in point) {
        return { value: Number(point.value), index };
      }
      return { value: 0, index };
    });
  }, [sparklineData]);

  const isClickable = typeof onClick === 'function';

  const handleClick = () => {
    if (isClickable) {
      onClick();
    }
  };

  const handleKeyDown = (e) => {
    if (isClickable && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <div
      className={`card flex flex-col justify-between transition-all duration-200 ${
        isClickable
          ? 'cursor-pointer hover:shadow-card-hover hover:border-blue-300 dark:hover:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
          : ''
      } ${className || ''}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      aria-label={isClickable ? `${title}: ${formattedValue}. Click for details.` : undefined}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
            {title}
          </p>
          <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">
            {formattedValue}
          </p>
          {description && (
            <p className="mt-1 text-xs text-gray-400 dark:text-gray-500 truncate">
              {description}
            </p>
          )}
        </div>

        {trendConfig && (
          <div
            className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${trendConfig.bgClass} ${trendConfig.colorClass}`}
            aria-label={trendConfig.label}
          >
            {trendConfig.icon}
            {trendValue && <span>{trendValue}</span>}
          </div>
        )}
      </div>

      {normalizedSparklineData && (
        <div className="mt-3 h-10 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={normalizedSparklineData}>
              <Line
                type="monotone"
                dataKey="value"
                stroke={resolvedSparklineColor}
                strokeWidth={1.5}
                dot={false}
                activeDot={isHovered ? { r: 2, strokeWidth: 0 } : false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

MetricCard.propTypes = {
  title: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  trend: PropTypes.oneOf(['up', 'down', 'flat']),
  trendValue: PropTypes.string,
  unit: PropTypes.string,
  invertTrend: PropTypes.bool,
  sparklineData: PropTypes.arrayOf(
    PropTypes.oneOfType([
      PropTypes.number,
      PropTypes.shape({
        value: PropTypes.number,
      }),
    ])
  ),
  sparklineColor: PropTypes.string,
  description: PropTypes.string,
  onClick: PropTypes.func,
  className: PropTypes.string,
};

MetricCard.defaultProps = {
  value: null,
  trend: null,
  trendValue: '',
  unit: '',
  invertTrend: false,
  sparklineData: null,
  sparklineColor: '',
  description: '',
  onClick: null,
  className: '',
};

export default MetricCard;