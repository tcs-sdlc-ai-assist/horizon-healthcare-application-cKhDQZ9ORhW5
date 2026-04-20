import { useMemo } from 'react';
import PropTypes from 'prop-types';
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { CHART_COLORS } from '@/constants/constants';

/**
 * Computes a simple linear trend direction from a numeric data series.
 * @param {number[]} values - Array of numeric values over time.
 * @returns {'up' | 'down' | 'flat'} Trend direction.
 */
function computeTrendDirection(values) {
  if (!Array.isArray(values) || values.length < 2) {
    return 'flat';
  }

  const validValues = values.filter((v) => typeof v === 'number' && !isNaN(v));
  if (validValues.length < 2) {
    return 'flat';
  }

  const n = validValues.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;

  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += validValues[i];
    sumXY += i * validValues[i];
    sumX2 += i * i;
  }

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);

  if (Math.abs(slope) < 0.5) {
    return 'flat';
  }
  return slope > 0 ? 'up' : 'down';
}

/**
 * Returns a trend indicator icon and label.
 * @param {'up' | 'down' | 'flat'} direction
 * @param {string} label
 * @param {boolean} [invertColor=false] - If true, "up" is bad (red) and "down" is good (green).
 * @returns {JSX.Element}
 */
function TrendIndicator({ direction, label, invertColor }) {
  const colorMap = {
    up: invertColor ? CHART_COLORS.trend.negative : CHART_COLORS.trend.positive,
    down: invertColor ? CHART_COLORS.trend.positive : CHART_COLORS.trend.negative,
    flat: CHART_COLORS.trend.neutral,
  };

  const arrowMap = {
    up: '↑',
    down: '↓',
    flat: '→',
  };

  const textMap = {
    up: 'Increasing',
    down: 'Decreasing',
    flat: 'Stable',
  };

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ color: colorMap[direction], backgroundColor: `${colorMap[direction]}15` }}
    >
      <span className="text-sm">{arrowMap[direction]}</span>
      {label}: {textMap[direction]}
    </span>
  );
}

TrendIndicator.propTypes = {
  direction: PropTypes.oneOf(['up', 'down', 'flat']).isRequired,
  label: PropTypes.string.isRequired,
  invertColor: PropTypes.bool,
};

TrendIndicator.defaultProps = {
  invertColor: false,
};

/**
 * Custom tooltip for the TrendChart.
 * @param {object} props - Recharts tooltip props.
 * @returns {JSX.Element|null}
 */
function CustomTooltip({ active, payload, label, accumulationLabel, remediationLabel }) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-lg dark:border-slate-600 dark:bg-slate-800">
      <p className="mb-2 text-xs font-semibold text-slate-600 dark:text-slate-300">{label}</p>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex items-center gap-2 text-sm">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-slate-600 dark:text-slate-400">
            {entry.dataKey === 'accumulation' ? accumulationLabel : remediationLabel}:
          </span>
          <span className="font-medium text-slate-900 dark:text-slate-100">
            {typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}
          </span>
        </div>
      ))}
      {payload.length === 2 && typeof payload[0].value === 'number' && typeof payload[1].value === 'number' && (
        <div className="mt-2 border-t border-slate-200 pt-2 dark:border-slate-600">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span>Net:</span>
            <span
              className="font-medium"
              style={{
                color:
                  payload[0].value - payload[1].value > 0
                    ? CHART_COLORS.trend.negative
                    : CHART_COLORS.trend.positive,
              }}
            >
              {(payload[0].value - payload[1].value).toLocaleString()}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

CustomTooltip.propTypes = {
  active: PropTypes.bool,
  payload: PropTypes.array,
  label: PropTypes.string,
  accumulationLabel: PropTypes.string,
  remediationLabel: PropTypes.string,
};

CustomTooltip.defaultProps = {
  active: false,
  payload: [],
  label: '',
  accumulationLabel: 'Accumulation',
  remediationLabel: 'Remediation',
};

/**
 * TrendChart — Recharts-based dual-area/line chart showing tech debt
 * accumulation vs remediation over time.
 *
 * @param {object} props
 * @param {string} props.title - Chart title.
 * @param {Array<{ date: string, accumulation: number, remediation: number }>} props.data - Time series data.
 * @param {string} [props.accumulationLabel] - Label for the accumulation series.
 * @param {string} [props.remediationLabel] - Label for the remediation series.
 * @param {string} [props.accumulationColor] - Color for the accumulation area/line.
 * @param {string} [props.remediationColor] - Color for the remediation area/line.
 * @param {string} [props.timeRange] - Display label for the time range (e.g., "Last 12 Months").
 * @param {number} [props.height] - Chart height in pixels.
 * @param {boolean} [props.showTrendIndicators] - Whether to show trend direction indicators.
 * @param {number|null} [props.targetLine] - Optional horizontal reference line value.
 * @param {string} [props.targetLabel] - Label for the target reference line.
 * @returns {JSX.Element}
 */
export function TrendChart({
  title,
  data,
  accumulationLabel,
  remediationLabel,
  accumulationColor,
  remediationColor,
  timeRange,
  height,
  showTrendIndicators,
  targetLine,
  targetLabel,
}) {
  const accumulationTrend = useMemo(() => {
    if (!data || data.length === 0) return 'flat';
    return computeTrendDirection(data.map((d) => d.accumulation));
  }, [data]);

  const remediationTrend = useMemo(() => {
    if (!data || data.length === 0) return 'flat';
    return computeTrendDirection(data.map((d) => d.remediation));
  }, [data]);

  const hasData = Array.isArray(data) && data.length > 0;

  return (
    <div className="card">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">
            {title}
          </h3>
          {timeRange && (
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{timeRange}</p>
          )}
        </div>
        {showTrendIndicators && hasData && (
          <div className="flex flex-wrap items-center gap-2">
            <TrendIndicator
              direction={accumulationTrend}
              label={accumulationLabel}
              invertColor
            />
            <TrendIndicator
              direction={remediationTrend}
              label={remediationLabel}
              invertColor={false}
            />
          </div>
        )}
      </div>

      {!hasData ? (
        <div
          className="flex items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 dark:border-slate-600 dark:bg-slate-800/50"
          style={{ height }}
        >
          <p className="text-sm text-slate-400 dark:text-slate-500">
            No data available for the selected time range.
          </p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          <ComposedChart
            data={data}
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="gradientAccumulation" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={accumulationColor} stopOpacity={0.3} />
                <stop offset="95%" stopColor={accumulationColor} stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="gradientRemediation" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={remediationColor} stopOpacity={0.3} />
                <stop offset="95%" stopColor={remediationColor} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              tickLine={false}
              axisLine={{ stroke: '#e2e8f0' }}
              dy={8}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              tickLine={false}
              axisLine={false}
              width={50}
            />
            <Tooltip
              content={
                <CustomTooltip
                  accumulationLabel={accumulationLabel}
                  remediationLabel={remediationLabel}
                />
              }
            />
            <Legend
              verticalAlign="top"
              align="right"
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: 12, paddingBottom: 8 }}
              formatter={(value) => {
                if (value === 'accumulation') return accumulationLabel;
                if (value === 'remediation') return remediationLabel;
                return value;
              }}
            />
            {targetLine !== null && targetLine !== undefined && (
              <ReferenceLine
                y={targetLine}
                stroke="#94a3b8"
                strokeDasharray="6 4"
                strokeWidth={1.5}
                label={{
                  value: targetLabel || `Target: ${targetLine}`,
                  position: 'insideTopRight',
                  fill: '#94a3b8',
                  fontSize: 11,
                }}
              />
            )}
            <Area
              type="monotone"
              dataKey="accumulation"
              stroke={accumulationColor}
              strokeWidth={2}
              fill="url(#gradientAccumulation)"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, fill: '#fff' }}
              animationDuration={800}
            />
            <Line
              type="monotone"
              dataKey="remediation"
              stroke={remediationColor}
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, fill: '#fff' }}
              animationDuration={800}
            />
            <Area
              type="monotone"
              dataKey="remediation"
              stroke="none"
              fill="url(#gradientRemediation)"
              animationDuration={800}
            />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

TrendChart.propTypes = {
  title: PropTypes.string.isRequired,
  data: PropTypes.arrayOf(
    PropTypes.shape({
      date: PropTypes.string.isRequired,
      accumulation: PropTypes.number.isRequired,
      remediation: PropTypes.number.isRequired,
    })
  ),
  accumulationLabel: PropTypes.string,
  remediationLabel: PropTypes.string,
  accumulationColor: PropTypes.string,
  remediationColor: PropTypes.string,
  timeRange: PropTypes.string,
  height: PropTypes.number,
  showTrendIndicators: PropTypes.bool,
  targetLine: PropTypes.number,
  targetLabel: PropTypes.string,
};

TrendChart.defaultProps = {
  data: [],
  accumulationLabel: 'Accumulation',
  remediationLabel: 'Remediation',
  accumulationColor: CHART_COLORS.severity.high,
  remediationColor: CHART_COLORS.status.passed,
  timeRange: '',
  height: 320,
  showTrendIndicators: true,
  targetLine: null,
  targetLabel: '',
};

export default TrendChart;