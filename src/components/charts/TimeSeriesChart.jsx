import { useState, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';
import { CHART_COLORS } from '@/constants/constants';
import { formatDate, formatNumber, formatPercentage } from '@/utils/formatUtils';

/**
 * Custom tooltip component for the time series chart.
 * @param {object} props - Recharts tooltip props
 * @param {boolean} props.active - Whether the tooltip is active
 * @param {Array} props.payload - Data payload for the hovered point
 * @param {string} props.label - The x-axis label (date)
 * @param {string} props.valueUnit - Unit for formatting values
 * @returns {JSX.Element|null}
 */
function CustomTooltip({ active, payload, label, valueUnit }) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-lg dark:border-slate-600 dark:bg-slate-800">
      <p className="mb-2 text-xs font-semibold text-slate-700 dark:text-slate-200">
        {formatDate(label, { year: 'numeric', month: 'short', day: 'numeric' })}
      </p>
      <div className="space-y-1">
        {payload.map((entry) => (
          <div key={entry.dataKey} className="flex items-center gap-2 text-xs">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-slate-600 dark:text-slate-300">{entry.name}:</span>
            <span className="font-medium text-slate-800 dark:text-slate-100">
              {valueUnit === 'percentage'
                ? formatPercentage(entry.value, 1)
                : formatNumber(entry.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

CustomTooltip.propTypes = {
  active: PropTypes.bool,
  payload: PropTypes.arrayOf(PropTypes.object),
  label: PropTypes.string,
  valueUnit: PropTypes.string,
};

CustomTooltip.defaultProps = {
  active: false,
  payload: [],
  label: '',
  valueUnit: 'number',
};

/**
 * Custom active dot component that renders a larger clickable dot on hover.
 * @param {object} props - Recharts dot props
 * @param {number} props.cx - X coordinate
 * @param {number} props.cy - Y coordinate
 * @param {string} props.fill - Fill color
 * @param {object} props.payload - Data point payload
 * @param {string} props.dataKey - The series data key
 * @param {Function} props.onDrillDown - Drill-down click handler
 * @returns {JSX.Element}
 */
function ActiveDot({ cx, cy, fill, payload, dataKey, onDrillDown }) {
  const handleClick = useCallback(() => {
    if (typeof onDrillDown === 'function') {
      onDrillDown({ ...payload, seriesKey: dataKey });
    }
  }, [onDrillDown, payload, dataKey]);

  const handleKeyDown = useCallback(
    (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && typeof onDrillDown === 'function') {
        e.preventDefault();
        onDrillDown({ ...payload, seriesKey: dataKey });
      }
    },
    [onDrillDown, payload, dataKey]
  );

  return (
    <circle
      cx={cx}
      cy={cy}
      r={6}
      fill={fill}
      stroke="#fff"
      strokeWidth={2}
      style={{ cursor: typeof onDrillDown === 'function' ? 'pointer' : 'default' }}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={typeof onDrillDown === 'function' ? 0 : -1}
      role={typeof onDrillDown === 'function' ? 'button' : undefined}
      aria-label={
        typeof onDrillDown === 'function'
          ? `Drill down into ${dataKey} on ${payload?.date || ''}`
          : undefined
      }
    />
  );
}

ActiveDot.propTypes = {
  cx: PropTypes.number,
  cy: PropTypes.number,
  fill: PropTypes.string,
  payload: PropTypes.object,
  dataKey: PropTypes.string,
  onDrillDown: PropTypes.func,
};

ActiveDot.defaultProps = {
  cx: 0,
  cy: 0,
  fill: '#3B82F6',
  payload: {},
  dataKey: '',
  onDrillDown: null,
};

/**
 * TimeSeriesChart — A Recharts-based time series line chart for Development Readiness trending.
 *
 * Supports multiple series, tooltips, legend, responsive sizing, reference lines,
 * and drill-down click handlers on data points.
 *
 * @param {object} props
 * @param {Array<object>} props.data - Array of data objects. Each object must have a `date` field
 *   and one or more numeric value fields matching the keys defined in `series`.
 * @param {string} props.title - Chart title displayed above the chart.
 * @param {Array<{ key: string, name: string, color?: string }>} props.series - Series configuration.
 *   Each entry defines a line on the chart.
 * @param {object} [props.config] - Optional chart configuration.
 * @param {string} [props.config.valueUnit] - Unit type for formatting: 'percentage', 'number', or 'count'.
 * @param {number} [props.config.yAxisMin] - Minimum Y-axis value.
 * @param {number} [props.config.yAxisMax] - Maximum Y-axis value.
 * @param {boolean} [props.config.showGrid] - Whether to show the cartesian grid.
 * @param {boolean} [props.config.showLegend] - Whether to show the legend.
 * @param {boolean} [props.config.showDots] - Whether to show dots on data points.
 * @param {number} [props.config.strokeWidth] - Line stroke width.
 * @param {string} [props.config.curveType] - Recharts curve type (e.g., 'monotone', 'linear').
 * @param {Array<{ value: number, label?: string, color?: string }>} [props.config.referenceLines] - Horizontal reference lines.
 * @param {number} [props.height] - Chart height in pixels.
 * @param {Function} [props.onDrillDown] - Callback when a data point is clicked. Receives the data point object.
 * @returns {JSX.Element}
 */
export function TimeSeriesChart({
  data,
  title,
  series,
  config,
  height,
  onDrillDown,
}) {
  const [hoveredSeries, setHoveredSeries] = useState(null);

  const {
    valueUnit = 'number',
    yAxisMin,
    yAxisMax,
    showGrid = true,
    showLegend = true,
    showDots = true,
    strokeWidth = 2,
    curveType = 'monotone',
    referenceLines = [],
  } = config || {};

  const seriesColors = useMemo(() => {
    return series.map((s, index) => ({
      ...s,
      color: s.color || CHART_COLORS.primary[index % CHART_COLORS.primary.length],
    }));
  }, [series]);

  const formattedData = useMemo(() => {
    if (!Array.isArray(data) || data.length === 0) {
      return [];
    }
    return data.map((entry) => ({ ...entry }));
  }, [data]);

  const formatYAxisTick = useCallback(
    (value) => {
      if (valueUnit === 'percentage') {
        return `${value}%`;
      }
      return formatNumber(value, { maximumFractionDigits: 0 });
    },
    [valueUnit]
  );

  const formatXAxisTick = useCallback((value) => {
    if (!value) return '';
    const dateObj = new Date(value);
    if (isNaN(dateObj.getTime())) return value;
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(dateObj);
  }, []);

  const handleLegendMouseEnter = useCallback((entry) => {
    setHoveredSeries(entry.dataKey);
  }, []);

  const handleLegendMouseLeave = useCallback(() => {
    setHoveredSeries(null);
  }, []);

  const handleLineClick = useCallback(
    (seriesKey, pointData) => {
      if (typeof onDrillDown === 'function' && pointData) {
        onDrillDown({ ...pointData, seriesKey });
      }
    },
    [onDrillDown]
  );

  if (!Array.isArray(data) || data.length === 0) {
    return (
      <div className="card flex flex-col">
        {title && (
          <h3 className="mb-4 text-base font-semibold text-slate-800 dark:text-slate-100">
            {title}
          </h3>
        )}
        <div className="flex flex-1 items-center justify-center py-12">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No data available for this time period.
          </p>
        </div>
      </div>
    );
  }

  if (!Array.isArray(series) || series.length === 0) {
    return (
      <div className="card flex flex-col">
        {title && (
          <h3 className="mb-4 text-base font-semibold text-slate-800 dark:text-slate-100">
            {title}
          </h3>
        )}
        <div className="flex flex-1 items-center justify-center py-12">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No series configured for this chart.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="card flex flex-col">
      {title && (
        <h3 className="mb-4 text-base font-semibold text-slate-800 dark:text-slate-100">
          {title}
        </h3>
      )}
      <div className="w-full" style={{ height: height || 320 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={formattedData}
            margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
          >
            {showGrid && (
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#e2e8f0"
                vertical={false}
              />
            )}
            <XAxis
              dataKey="date"
              tickFormatter={formatXAxisTick}
              tick={{ fontSize: 11, fill: '#64748b' }}
              tickLine={false}
              axisLine={{ stroke: '#cbd5e1' }}
              dy={8}
              interval="preserveStartEnd"
            />
            <YAxis
              tickFormatter={formatYAxisTick}
              tick={{ fontSize: 11, fill: '#64748b' }}
              tickLine={false}
              axisLine={false}
              domain={[
                yAxisMin !== undefined ? yAxisMin : 'auto',
                yAxisMax !== undefined ? yAxisMax : 'auto',
              ]}
              width={48}
            />
            <Tooltip
              content={<CustomTooltip valueUnit={valueUnit} />}
              cursor={{ stroke: '#94a3b8', strokeDasharray: '4 4' }}
            />
            {showLegend && (
              <Legend
                verticalAlign="bottom"
                height={36}
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }}
                onMouseEnter={handleLegendMouseEnter}
                onMouseLeave={handleLegendMouseLeave}
              />
            )}
            {referenceLines.map((refLine, index) => (
              <ReferenceLine
                key={`ref-${index}-${refLine.value}`}
                y={refLine.value}
                stroke={refLine.color || '#9ca3af'}
                strokeDasharray="6 4"
                label={
                  refLine.label
                    ? {
                        value: refLine.label,
                        position: 'insideTopRight',
                        fontSize: 10,
                        fill: refLine.color || '#9ca3af',
                      }
                    : undefined
                }
              />
            ))}
            {seriesColors.map((s) => (
              <Line
                key={s.key}
                type={curveType}
                dataKey={s.key}
                name={s.name}
                stroke={s.color}
                strokeWidth={
                  hoveredSeries === null || hoveredSeries === s.key
                    ? strokeWidth
                    : strokeWidth * 0.5
                }
                strokeOpacity={
                  hoveredSeries === null || hoveredSeries === s.key ? 1 : 0.3
                }
                dot={
                  showDots
                    ? { r: 3, fill: s.color, strokeWidth: 0 }
                    : false
                }
                activeDot={
                  <ActiveDot
                    fill={s.color}
                    dataKey={s.key}
                    onDrillDown={onDrillDown}
                  />
                }
                connectNulls
                onClick={(pointData) => {
                  if (pointData && pointData.payload) {
                    handleLineClick(s.key, pointData.payload);
                  }
                }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

TimeSeriesChart.propTypes = {
  data: PropTypes.arrayOf(
    PropTypes.shape({
      date: PropTypes.string.isRequired,
    })
  ).isRequired,
  title: PropTypes.string,
  series: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
      color: PropTypes.string,
    })
  ).isRequired,
  config: PropTypes.shape({
    valueUnit: PropTypes.oneOf(['percentage', 'number', 'count']),
    yAxisMin: PropTypes.number,
    yAxisMax: PropTypes.number,
    showGrid: PropTypes.bool,
    showLegend: PropTypes.bool,
    showDots: PropTypes.bool,
    strokeWidth: PropTypes.number,
    curveType: PropTypes.oneOf([
      'monotone',
      'linear',
      'basis',
      'natural',
      'step',
      'stepBefore',
      'stepAfter',
    ]),
    referenceLines: PropTypes.arrayOf(
      PropTypes.shape({
        value: PropTypes.number.isRequired,
        label: PropTypes.string,
        color: PropTypes.string,
      })
    ),
  }),
  height: PropTypes.number,
  onDrillDown: PropTypes.func,
};

TimeSeriesChart.defaultProps = {
  title: '',
  config: {},
  height: 320,
  onDrillDown: null,
};

export default TimeSeriesChart;