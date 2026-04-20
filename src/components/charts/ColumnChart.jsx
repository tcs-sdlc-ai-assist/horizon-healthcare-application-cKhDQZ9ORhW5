import { useState, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
  Text,
} from 'recharts';
import { CHART_COLORS } from '@/constants/constants';
import { formatNumber, formatPercentage } from '@/utils/formatUtils';

/**
 * Custom tooltip component for the column chart.
 * @param {object} props - Recharts tooltip props
 * @param {boolean} props.active - Whether tooltip is active
 * @param {Array} props.payload - Tooltip payload data
 * @param {string} props.label - Category label
 * @param {object|null} props.annotations - Annotation config keyed by category
 * @param {string} props.valueFormat - Format type for values ('number' | 'percentage' | 'duration')
 * @returns {JSX.Element|null}
 */
function CustomTooltip({ active, payload, label, annotations, valueFormat }) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const annotation = annotations && annotations[label] ? annotations[label] : null;

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-lg dark:border-slate-600 dark:bg-slate-800">
      <p className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
        {label}
      </p>
      <div className="space-y-1">
        {payload.map((entry) => {
          let formattedValue;
          if (valueFormat === 'percentage') {
            formattedValue = formatPercentage(entry.value);
          } else if (valueFormat === 'duration') {
            formattedValue = `${formatNumber(entry.value)}s`;
          } else {
            formattedValue = formatNumber(entry.value);
          }

          return (
            <div key={entry.dataKey} className="flex items-center gap-2 text-sm">
              <span
                className="inline-block h-3 w-3 rounded-sm"
                style={{ backgroundColor: entry.color || entry.fill }}
              />
              <span className="text-slate-600 dark:text-slate-300">
                {entry.name}:
              </span>
              <span className="font-medium text-slate-800 dark:text-slate-100">
                {formattedValue}
              </span>
            </div>
          );
        })}
      </div>
      {annotation && (
        <div className="mt-2 border-t border-slate-200 pt-2 dark:border-slate-600">
          <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
            {annotation.label}: {annotation.format === 'percentage'
              ? formatPercentage(annotation.value)
              : formatNumber(annotation.value)}
          </span>
        </div>
      )}
    </div>
  );
}

CustomTooltip.propTypes = {
  active: PropTypes.bool,
  payload: PropTypes.array,
  label: PropTypes.string,
  annotations: PropTypes.object,
  valueFormat: PropTypes.oneOf(['number', 'percentage', 'duration']),
};

CustomTooltip.defaultProps = {
  active: false,
  payload: [],
  label: '',
  annotations: null,
  valueFormat: 'number',
};

/**
 * Custom legend renderer with interactive click-to-toggle series visibility.
 * @param {object} props
 * @param {Array} props.payload - Legend payload from Recharts
 * @param {Set} props.hiddenSeries - Set of hidden dataKey strings
 * @param {Function} props.onToggle - Callback to toggle series visibility
 * @returns {JSX.Element}
 */
function CustomLegend({ payload, hiddenSeries, onToggle }) {
  if (!payload || payload.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
      {payload.map((entry) => {
        const isHidden = hiddenSeries.has(entry.dataKey);
        return (
          <button
            key={entry.dataKey}
            type="button"
            onClick={() => onToggle(entry.dataKey)}
            className={`flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium transition-opacity ${
              isHidden ? 'opacity-40' : 'opacity-100'
            } hover:bg-slate-100 dark:hover:bg-slate-700`}
          >
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-slate-700 dark:text-slate-300">
              {entry.value}
            </span>
          </button>
        );
      })}
    </div>
  );
}

CustomLegend.propTypes = {
  payload: PropTypes.array,
  hiddenSeries: PropTypes.instanceOf(Set).isRequired,
  onToggle: PropTypes.func.isRequired,
};

CustomLegend.defaultProps = {
  payload: [],
};

/**
 * ColumnChart — Recharts-based column (vertical bar) chart component.
 *
 * Designed for:
 * - Deployment Pipeline stage progression visualization
 * - Sprint committed/done/deployed comparison
 *
 * Supports interactive hover tooltips, drill-down callbacks, annotations
 * (e.g., Predictability %), and series toggle via legend clicks.
 *
 * @param {object} props
 * @param {Array<object>} props.data - Array of data objects, each with a category key and series value keys
 * @param {string} props.title - Chart title
 * @param {string} props.categoryKey - Key in data objects used for the X-axis category labels
 * @param {Array<object>} props.series - Series configuration array
 * @param {string} props.series[].dataKey - Key in data objects for this series' values
 * @param {string} props.series[].name - Display name for this series
 * @param {string} [props.series[].color] - Bar fill color (defaults to CHART_COLORS.primary)
 * @param {number} [props.series[].stackId] - Stack group identifier for stacked bars
 * @param {object} [props.annotations] - Annotations keyed by category value
 * @param {string} [props.valueFormat] - Format type for values ('number' | 'percentage' | 'duration')
 * @param {string} [props.yAxisLabel] - Label for the Y-axis
 * @param {number} [props.height] - Chart height in pixels
 * @param {boolean} [props.showGrid] - Whether to show the cartesian grid
 * @param {boolean} [props.showLegend] - Whether to show the legend
 * @param {number} [props.referenceLine] - Optional horizontal reference line value
 * @param {string} [props.referenceLineLabel] - Label for the reference line
 * @param {string} [props.referenceLineColor] - Color for the reference line
 * @param {Function} [props.onBarClick] - Callback when a bar is clicked (receives { category, dataKey, value, data })
 * @param {Function} [props.onDrillDown] - Callback for drill-down (receives the full data entry)
 * @param {string} [props.className] - Additional CSS classes for the wrapper
 * @param {string} [props.emptyMessage] - Message to display when data is empty
 * @param {number} [props.barSize] - Width of each bar in pixels
 * @param {number} [props.barGap] - Gap between bars in the same category
 * @param {number} [props.barCategoryGap] - Gap between categories
 * @returns {JSX.Element}
 */
export function ColumnChart({
  data,
  title,
  categoryKey,
  series,
  annotations,
  valueFormat,
  yAxisLabel,
  height,
  showGrid,
  showLegend,
  referenceLine,
  referenceLineLabel,
  referenceLineColor,
  onBarClick,
  onDrillDown,
  className,
  emptyMessage,
  barSize,
  barGap,
  barCategoryGap,
}) {
  const [hiddenSeries, setHiddenSeries] = useState(new Set());
  const [activeIndex, setActiveIndex] = useState(null);

  const handleToggleSeries = useCallback((dataKey) => {
    setHiddenSeries((prev) => {
      const next = new Set(prev);
      if (next.has(dataKey)) {
        next.delete(dataKey);
      } else {
        next.add(dataKey);
      }
      return next;
    });
  }, []);

  const handleBarClick = useCallback(
    (entry, dataKey) => {
      if (!entry) return;

      const categoryValue = entry[categoryKey];
      const value = entry[dataKey];

      if (onBarClick) {
        onBarClick({
          category: categoryValue,
          dataKey,
          value,
          data: entry,
        });
      }

      if (onDrillDown) {
        onDrillDown(entry);
      }
    },
    [categoryKey, onBarClick, onDrillDown]
  );

  const handleMouseEnter = useCallback((_, index) => {
    setActiveIndex(index);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setActiveIndex(null);
  }, []);

  const visibleSeries = useMemo(() => {
    return series.filter((s) => !hiddenSeries.has(s.dataKey));
  }, [series, hiddenSeries]);

  const yAxisTickFormatter = useCallback(
    (value) => {
      if (valueFormat === 'percentage') {
        return `${value}%`;
      }
      if (valueFormat === 'duration') {
        return `${value}s`;
      }
      if (value >= 1000) {
        return `${(value / 1000).toFixed(1)}k`;
      }
      return value;
    },
    [valueFormat]
  );

  const hasDrillDown = typeof onBarClick === 'function' || typeof onDrillDown === 'function';

  if (!data || data.length === 0) {
    return (
      <div className={`card flex flex-col ${className}`}>
        {title && (
          <h3 className="mb-4 text-base font-semibold text-slate-800 dark:text-slate-100">
            {title}
          </h3>
        )}
        <div className="flex flex-1 items-center justify-center py-12">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {emptyMessage}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`card flex flex-col ${className}`}>
      {title && (
        <h3 className="mb-4 text-base font-semibold text-slate-800 dark:text-slate-100">
          {title}
        </h3>
      )}
      <div className="flex-1" style={{ minHeight: height }}>
        <ResponsiveContainer width="100%" height={height}>
          <BarChart
            data={data}
            margin={{ top: 10, right: 20, left: 10, bottom: 5 }}
            barGap={barGap}
            barCategoryGap={barCategoryGap}
          >
            {showGrid && (
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#e2e8f0"
                vertical={false}
              />
            )}
            <XAxis
              dataKey={categoryKey}
              tick={{ fontSize: 12, fill: '#64748b' }}
              tickLine={false}
              axisLine={{ stroke: '#e2e8f0' }}
              interval={0}
              angle={data.length > 8 ? -45 : 0}
              textAnchor={data.length > 8 ? 'end' : 'middle'}
              height={data.length > 8 ? 80 : 40}
            />
            <YAxis
              tick={{ fontSize: 12, fill: '#64748b' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={yAxisTickFormatter}
              label={
                yAxisLabel
                  ? {
                      value: yAxisLabel,
                      angle: -90,
                      position: 'insideLeft',
                      style: { fontSize: 12, fill: '#94a3b8', textAnchor: 'middle' },
                      offset: 0,
                    }
                  : undefined
              }
            />
            <Tooltip
              content={
                <CustomTooltip
                  annotations={annotations}
                  valueFormat={valueFormat}
                />
              }
              cursor={{ fill: 'rgba(148, 163, 184, 0.1)' }}
            />
            {showLegend && (
              <Legend
                content={
                  <CustomLegend
                    hiddenSeries={hiddenSeries}
                    onToggle={handleToggleSeries}
                  />
                }
              />
            )}
            {referenceLine !== null && referenceLine !== undefined && (
              <ReferenceLine
                y={referenceLine}
                stroke={referenceLineColor}
                strokeDasharray="6 4"
                strokeWidth={1.5}
                label={
                  referenceLineLabel
                    ? {
                        value: referenceLineLabel,
                        position: 'right',
                        style: {
                          fontSize: 11,
                          fill: referenceLineColor,
                          fontWeight: 500,
                        },
                      }
                    : undefined
                }
              />
            )}
            {visibleSeries.map((s, seriesIdx) => {
              const color = s.color || CHART_COLORS.primary[seriesIdx % CHART_COLORS.primary.length];
              return (
                <Bar
                  key={s.dataKey}
                  dataKey={s.dataKey}
                  name={s.name}
                  fill={color}
                  stackId={s.stackId !== undefined ? String(s.stackId) : undefined}
                  barSize={barSize}
                  radius={s.stackId !== undefined ? [0, 0, 0, 0] : [4, 4, 0, 0]}
                  cursor={hasDrillDown ? 'pointer' : 'default'}
                  onClick={(barData) => handleBarClick(barData, s.dataKey)}
                  onMouseEnter={handleMouseEnter}
                  onMouseLeave={handleMouseLeave}
                >
                  {data.map((entry, index) => (
                    <Cell
                      key={`cell-${s.dataKey}-${index}`}
                      fill={color}
                      fillOpacity={activeIndex !== null && activeIndex !== index ? 0.6 : 1}
                    />
                  ))}
                </Bar>
              );
            })}
          </BarChart>
        </ResponsiveContainer>
      </div>
      {annotations && (
        <div className="mt-3 flex flex-wrap gap-3 border-t border-slate-200 pt-3 dark:border-slate-700">
          {Object.entries(annotations).map(([category, annotation]) => (
            <div
              key={category}
              className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400"
            >
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {category}:
              </span>
              <span className="rounded bg-blue-50 px-1.5 py-0.5 font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                {annotation.label}{' '}
                {annotation.format === 'percentage'
                  ? formatPercentage(annotation.value)
                  : formatNumber(annotation.value)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

ColumnChart.propTypes = {
  data: PropTypes.arrayOf(PropTypes.object).isRequired,
  title: PropTypes.string,
  categoryKey: PropTypes.string.isRequired,
  series: PropTypes.arrayOf(
    PropTypes.shape({
      dataKey: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
      color: PropTypes.string,
      stackId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    })
  ).isRequired,
  annotations: PropTypes.objectOf(
    PropTypes.shape({
      label: PropTypes.string.isRequired,
      value: PropTypes.number.isRequired,
      format: PropTypes.oneOf(['number', 'percentage']),
    })
  ),
  valueFormat: PropTypes.oneOf(['number', 'percentage', 'duration']),
  yAxisLabel: PropTypes.string,
  height: PropTypes.number,
  showGrid: PropTypes.bool,
  showLegend: PropTypes.bool,
  referenceLine: PropTypes.number,
  referenceLineLabel: PropTypes.string,
  referenceLineColor: PropTypes.string,
  onBarClick: PropTypes.func,
  onDrillDown: PropTypes.func,
  className: PropTypes.string,
  emptyMessage: PropTypes.string,
  barSize: PropTypes.number,
  barGap: PropTypes.number,
  barCategoryGap: PropTypes.string,
};

ColumnChart.defaultProps = {
  title: '',
  annotations: null,
  valueFormat: 'number',
  yAxisLabel: '',
  height: 350,
  showGrid: true,
  showLegend: true,
  referenceLine: null,
  referenceLineLabel: '',
  referenceLineColor: '#94a3b8',
  onBarClick: null,
  onDrillDown: null,
  className: '',
  emptyMessage: 'No data available to display.',
  barSize: undefined,
  barGap: 4,
  barCategoryGap: '20%',
};

export default ColumnChart;