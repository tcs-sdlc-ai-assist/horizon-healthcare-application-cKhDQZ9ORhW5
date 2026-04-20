import { useState, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { CHART_COLORS } from '@/constants/constants';

/**
 * Custom tooltip component for the bar chart.
 * @param {object} props - Recharts tooltip props
 * @param {boolean} props.active - Whether tooltip is active
 * @param {Array} props.payload - Tooltip payload data
 * @param {string} props.label - Tooltip label
 * @param {string} props.valueFormatter - Function to format values
 * @param {string} props.valueSuffix - Suffix to append to values
 * @returns {JSX.Element|null}
 */
function CustomTooltip({ active, payload, label, valueFormatter, valueSuffix }) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-lg dark:border-slate-700 dark:bg-slate-800">
      <p className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
        {label}
      </p>
      <div className="space-y-1">
        {payload.map((entry, index) => {
          const formattedValue = valueFormatter
            ? valueFormatter(entry.value)
            : entry.value;
          return (
            <div key={`tooltip-${index}`} className="flex items-center gap-2 text-xs">
              <span
                className="inline-block h-2.5 w-2.5 rounded-sm"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-slate-600 dark:text-slate-300">
                {entry.name}:
              </span>
              <span className="font-medium text-slate-800 dark:text-slate-100">
                {formattedValue}
                {valueSuffix || ''}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

CustomTooltip.propTypes = {
  active: PropTypes.bool,
  payload: PropTypes.array,
  label: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  valueFormatter: PropTypes.func,
  valueSuffix: PropTypes.string,
};

/**
 * Recharts-based bar chart component used for Unit Testing coverage,
 * SAST/DAST scan results, and Flow Distribution.
 *
 * Supports grouped and stacked modes, tooltips, horizontal/vertical
 * orientation, and drill-down click handlers.
 *
 * @param {object} props
 * @param {Array<object>} props.data - Array of data objects to chart
 * @param {string} [props.title] - Chart title displayed above the chart
 * @param {string} props.xKey - Key in data objects for the X axis
 * @param {string[]} props.yKeys - Keys in data objects for the Y axis bars
 * @param {string[]} [props.colors] - Array of color hex strings for each bar series
 * @param {string[]} [props.labels] - Human-readable labels for each yKey in the legend
 * @param {'vertical'|'horizontal'} [props.orientation='vertical'] - Chart orientation
 * @param {'grouped'|'stacked'} [props.mode='grouped'] - Bar grouping mode
 * @param {Function} [props.onBarClick] - Callback when a bar is clicked: (data, dataKey, index) => void
 * @param {Function} [props.valueFormatter] - Function to format tooltip values
 * @param {string} [props.valueSuffix] - Suffix appended to tooltip values (e.g., '%', ' hrs')
 * @param {number} [props.height=400] - Chart height in pixels
 * @param {boolean} [props.showGrid=true] - Whether to show the cartesian grid
 * @param {boolean} [props.showLegend=true] - Whether to show the legend
 * @param {boolean} [props.showTooltip=true] - Whether to show tooltips on hover
 * @param {string} [props.xAxisLabel] - Label for the X axis
 * @param {string} [props.yAxisLabel] - Label for the Y axis
 * @param {number} [props.barSize] - Fixed bar size in pixels
 * @param {number} [props.barGap=4] - Gap between bars in a group
 * @param {number} [props.barCategoryGap='20%'] - Gap between bar groups
 * @param {string} [props.className] - Additional CSS classes for the wrapper
 * @returns {JSX.Element}
 */
export function BarChart({
  data,
  title,
  xKey,
  yKeys,
  colors,
  labels,
  orientation = 'vertical',
  mode = 'grouped',
  onBarClick,
  valueFormatter,
  valueSuffix,
  height = 400,
  showGrid = true,
  showLegend = true,
  showTooltip = true,
  xAxisLabel,
  yAxisLabel,
  barSize,
  barGap = 4,
  barCategoryGap = '20%',
  className,
}) {
  const [activeBarIndex, setActiveBarIndex] = useState(null);

  const chartColors = useMemo(() => {
    if (colors && colors.length > 0) {
      return colors;
    }
    return CHART_COLORS.primary;
  }, [colors]);

  const barLabels = useMemo(() => {
    if (labels && labels.length > 0) {
      return labels;
    }
    return yKeys;
  }, [labels, yKeys]);

  const isHorizontal = orientation === 'horizontal';
  const stackId = mode === 'stacked' ? 'stack' : undefined;

  const handleBarClick = useCallback(
    (dataKey) => (entry, index) => {
      if (onBarClick && typeof onBarClick === 'function') {
        onBarClick(entry, dataKey, index);
      }
    },
    [onBarClick]
  );

  const handleBarMouseEnter = useCallback((_, index) => {
    setActiveBarIndex(index);
  }, []);

  const handleBarMouseLeave = useCallback(() => {
    setActiveBarIndex(null);
  }, []);

  const chartLayout = isHorizontal ? 'vertical' : 'horizontal';

  const renderXAxis = () => {
    if (isHorizontal) {
      return (
        <XAxis
          type="number"
          tick={{ fontSize: 12, fill: '#64748b' }}
          tickLine={false}
          axisLine={{ stroke: '#e2e8f0' }}
          label={
            yAxisLabel
              ? {
                  value: yAxisLabel,
                  position: 'insideBottom',
                  offset: -5,
                  style: { fontSize: 12, fill: '#64748b' },
                }
              : undefined
          }
        />
      );
    }
    return (
      <XAxis
        dataKey={xKey}
        tick={{ fontSize: 12, fill: '#64748b' }}
        tickLine={false}
        axisLine={{ stroke: '#e2e8f0' }}
        interval="preserveStartEnd"
        label={
          xAxisLabel
            ? {
                value: xAxisLabel,
                position: 'insideBottom',
                offset: -5,
                style: { fontSize: 12, fill: '#64748b' },
              }
            : undefined
        }
      />
    );
  };

  const renderYAxis = () => {
    if (isHorizontal) {
      return (
        <YAxis
          dataKey={xKey}
          type="category"
          tick={{ fontSize: 12, fill: '#64748b' }}
          tickLine={false}
          axisLine={{ stroke: '#e2e8f0' }}
          width={120}
          label={
            xAxisLabel
              ? {
                  value: xAxisLabel,
                  angle: -90,
                  position: 'insideLeft',
                  style: { fontSize: 12, fill: '#64748b' },
                }
              : undefined
          }
        />
      );
    }
    return (
      <YAxis
        tick={{ fontSize: 12, fill: '#64748b' }}
        tickLine={false}
        axisLine={{ stroke: '#e2e8f0' }}
        label={
          yAxisLabel
            ? {
                value: yAxisLabel,
                angle: -90,
                position: 'insideLeft',
                style: { fontSize: 12, fill: '#64748b' },
              }
            : undefined
        }
      />
    );
  };

  if (!data || data.length === 0) {
    return (
      <div className={`card flex flex-col ${className || ''}`}>
        {title && (
          <h3 className="mb-4 text-base font-semibold text-slate-800 dark:text-slate-100">
            {title}
          </h3>
        )}
        <div
          className="flex items-center justify-center text-sm text-slate-500 dark:text-slate-400"
          style={{ height }}
        >
          No data available
        </div>
      </div>
    );
  }

  if (!yKeys || yKeys.length === 0) {
    return (
      <div className={`card flex flex-col ${className || ''}`}>
        {title && (
          <h3 className="mb-4 text-base font-semibold text-slate-800 dark:text-slate-100">
            {title}
          </h3>
        )}
        <div
          className="flex items-center justify-center text-sm text-slate-500 dark:text-slate-400"
          style={{ height }}
        >
          No data keys configured
        </div>
      </div>
    );
  }

  return (
    <div className={`card flex flex-col ${className || ''}`}>
      {title && (
        <h3 className="mb-4 text-base font-semibold text-slate-800 dark:text-slate-100">
          {title}
        </h3>
      )}
      <div style={{ width: '100%', height }}>
        <ResponsiveContainer width="100%" height="100%">
          <RechartsBarChart
            data={data}
            layout={chartLayout}
            barGap={barGap}
            barCategoryGap={barCategoryGap}
            margin={{ top: 10, right: 20, left: 10, bottom: xAxisLabel || yAxisLabel ? 30 : 10 }}
          >
            {showGrid && (
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#e2e8f0"
                vertical={!isHorizontal}
                horizontal={isHorizontal || true}
              />
            )}
            {renderXAxis()}
            {renderYAxis()}
            {showTooltip && (
              <Tooltip
                content={
                  <CustomTooltip
                    valueFormatter={valueFormatter}
                    valueSuffix={valueSuffix}
                  />
                }
                cursor={{ fill: 'rgba(148, 163, 184, 0.1)' }}
              />
            )}
            {showLegend && (
              <Legend
                wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                iconType="square"
                iconSize={10}
              />
            )}
            {yKeys.map((key, index) => {
              const barColor = chartColors[index % chartColors.length];
              const label = barLabels[index] || key;

              return (
                <Bar
                  key={key}
                  dataKey={key}
                  name={label}
                  fill={barColor}
                  stackId={stackId}
                  barSize={barSize}
                  radius={mode === 'stacked' ? undefined : [2, 2, 0, 0]}
                  onClick={handleBarClick(key)}
                  onMouseEnter={handleBarMouseEnter}
                  onMouseLeave={handleBarMouseLeave}
                  cursor={onBarClick ? 'pointer' : 'default'}
                >
                  {data.map((_, entryIndex) => (
                    <Cell
                      key={`cell-${key}-${entryIndex}`}
                      fillOpacity={
                        activeBarIndex === null || activeBarIndex === entryIndex
                          ? 1
                          : 0.6
                      }
                    />
                  ))}
                </Bar>
              );
            })}
          </RechartsBarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

BarChart.propTypes = {
  data: PropTypes.arrayOf(PropTypes.object).isRequired,
  title: PropTypes.string,
  xKey: PropTypes.string.isRequired,
  yKeys: PropTypes.arrayOf(PropTypes.string).isRequired,
  colors: PropTypes.arrayOf(PropTypes.string),
  labels: PropTypes.arrayOf(PropTypes.string),
  orientation: PropTypes.oneOf(['vertical', 'horizontal']),
  mode: PropTypes.oneOf(['grouped', 'stacked']),
  onBarClick: PropTypes.func,
  valueFormatter: PropTypes.func,
  valueSuffix: PropTypes.string,
  height: PropTypes.number,
  showGrid: PropTypes.bool,
  showLegend: PropTypes.bool,
  showTooltip: PropTypes.bool,
  xAxisLabel: PropTypes.string,
  yAxisLabel: PropTypes.string,
  barSize: PropTypes.number,
  barGap: PropTypes.number,
  barCategoryGap: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  className: PropTypes.string,
};

BarChart.defaultProps = {
  title: '',
  colors: [],
  labels: [],
  orientation: 'vertical',
  mode: 'grouped',
  onBarClick: null,
  valueFormatter: null,
  valueSuffix: '',
  height: 400,
  showGrid: true,
  showLegend: true,
  showTooltip: true,
  xAxisLabel: '',
  yAxisLabel: '',
  barSize: undefined,
  barGap: 4,
  barCategoryGap: '20%',
  className: '',
};

export default BarChart;