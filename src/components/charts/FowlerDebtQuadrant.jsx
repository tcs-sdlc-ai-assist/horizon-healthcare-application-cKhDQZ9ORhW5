import { useState, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Label,
  Cell,
} from 'recharts';

const QUADRANT_CONFIG = {
  recklessDeliberate: {
    key: 'recklessDeliberate',
    label: 'Reckless & Deliberate',
    description: '"We don\'t have time for design"',
    color: '#DC2626',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    textColor: 'text-red-700',
    badgeClass: 'badge-danger',
    xRange: [50, 100],
    yRange: [50, 100],
  },
  prudentDeliberate: {
    key: 'prudentDeliberate',
    label: 'Prudent & Deliberate',
    description: '"We must ship now and deal with consequences"',
    color: '#F59E0B',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    textColor: 'text-amber-700',
    badgeClass: 'badge-warning',
    xRange: [50, 100],
    yRange: [0, 50],
  },
  recklessInadvertent: {
    key: 'recklessInadvertent',
    label: 'Reckless & Inadvertent',
    description: '"What\'s layering?"',
    color: '#EF4444',
    bgColor: 'bg-red-100',
    borderColor: 'border-red-300',
    textColor: 'text-red-800',
    badgeClass: 'badge-danger',
    xRange: [0, 50],
    yRange: [50, 100],
  },
  prudentInadvertent: {
    key: 'prudentInadvertent',
    label: 'Prudent & Inadvertent',
    description: '"Now we know how we should have done it"',
    color: '#10B981',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    textColor: 'text-green-700',
    badgeClass: 'badge-success',
    xRange: [0, 50],
    yRange: [0, 50],
  },
};

/**
 * Classifies an application into a Fowler debt quadrant based on its x and y scores.
 * @param {number} deliberateScore - 0-100, higher = more deliberate (x-axis)
 * @param {number} recklessScore - 0-100, higher = more reckless (y-axis)
 * @returns {string} Quadrant key
 */
function classifyQuadrant(deliberateScore, recklessScore) {
  if (deliberateScore >= 50 && recklessScore >= 50) {
    return 'recklessDeliberate';
  }
  if (deliberateScore >= 50 && recklessScore < 50) {
    return 'prudentDeliberate';
  }
  if (deliberateScore < 50 && recklessScore >= 50) {
    return 'recklessInadvertent';
  }
  return 'prudentInadvertent';
}

/**
 * Gets the color for a data point based on its quadrant classification.
 * @param {number} deliberateScore
 * @param {number} recklessScore
 * @returns {string} Hex color
 */
function getPointColor(deliberateScore, recklessScore) {
  const quadrant = classifyQuadrant(deliberateScore, recklessScore);
  return QUADRANT_CONFIG[quadrant].color;
}

/**
 * Custom tooltip component for the scatter chart.
 */
function QuadrantTooltip({ active, payload }) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const data = payload[0]?.payload;
  if (!data) {
    return null;
  }

  const quadrant = classifyQuadrant(data.deliberateScore, data.recklessScore);
  const quadrantConfig = QUADRANT_CONFIG[quadrant];

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-lg dark:border-slate-600 dark:bg-slate-800">
      <p className="mb-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
        {data.name || data.applicationName || 'Unknown'}
      </p>
      {data.domain && (
        <p className="mb-1 text-xs text-slate-500 dark:text-slate-400">
          {data.domain}
        </p>
      )}
      <div className="mb-2 space-y-1">
        <p className="text-xs text-slate-600 dark:text-slate-300">
          <span className="font-medium">Deliberate Score:</span> {data.deliberateScore}
        </p>
        <p className="text-xs text-slate-600 dark:text-slate-300">
          <span className="font-medium">Reckless Score:</span> {data.recklessScore}
        </p>
        {data.debtIndex !== undefined && (
          <p className="text-xs text-slate-600 dark:text-slate-300">
            <span className="font-medium">Debt Index:</span> {data.debtIndex}
          </p>
        )}
        {data.estimatedRemediationDays !== undefined && (
          <p className="text-xs text-slate-600 dark:text-slate-300">
            <span className="font-medium">Remediation:</span> {data.estimatedRemediationDays} days
          </p>
        )}
      </div>
      <div
        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${quadrantConfig.bgColor} ${quadrantConfig.textColor}`}
      >
        {quadrantConfig.label}
      </div>
      <p className="mt-1 text-2xs italic text-slate-400 dark:text-slate-500">
        {quadrantConfig.description}
      </p>
    </div>
  );
}

QuadrantTooltip.propTypes = {
  active: PropTypes.bool,
  payload: PropTypes.arrayOf(PropTypes.object),
};

/**
 * FowlerDebtQuadrant — Quadrant chart implementing Martin Fowler's Technical Debt Quadrant.
 *
 * Plots applications on a 2D plane:
 *   - X-axis: Deliberate ↔ Inadvertent (0 = inadvertent, 100 = deliberate)
 *   - Y-axis: Prudent ↔ Reckless (0 = prudent, 100 = reckless)
 *
 * Each quadrant is color-coded:
 *   - Reckless & Deliberate (top-right): Red — "We don't have time for design"
 *   - Reckless & Inadvertent (top-left): Dark Red — "What's layering?"
 *   - Prudent & Deliberate (bottom-right): Amber — "We must ship now and deal with consequences"
 *   - Prudent & Inadvertent (bottom-left): Green — "Now we know how we should have done it"
 *
 * @param {Object} props
 * @param {Array<Object>} props.data - Array of application data points
 * @param {string} props.data[].name - Application name
 * @param {number} props.data[].deliberateScore - 0-100 deliberate score (x-axis)
 * @param {number} props.data[].recklessScore - 0-100 reckless score (y-axis)
 * @param {Function} [props.onDrillDown] - Callback when a data point is clicked
 * @param {number} [props.height] - Chart height in pixels
 * @param {string} [props.title] - Chart title
 * @param {boolean} [props.showLegend] - Whether to show the quadrant legend
 */
export function FowlerDebtQuadrant({
  data,
  onDrillDown,
  height,
  title,
  showLegend,
}) {
  const [selectedPoint, setSelectedPoint] = useState(null);

  const processedData = useMemo(() => {
    if (!Array.isArray(data)) {
      return [];
    }

    return data
      .filter(
        (item) =>
          item &&
          typeof item.deliberateScore === 'number' &&
          typeof item.recklessScore === 'number' &&
          !isNaN(item.deliberateScore) &&
          !isNaN(item.recklessScore)
      )
      .map((item) => ({
        ...item,
        x: item.deliberateScore,
        y: item.recklessScore,
        quadrant: classifyQuadrant(item.deliberateScore, item.recklessScore),
      }));
  }, [data]);

  const quadrantCounts = useMemo(() => {
    const counts = {
      recklessDeliberate: 0,
      prudentDeliberate: 0,
      recklessInadvertent: 0,
      prudentInadvertent: 0,
    };

    processedData.forEach((item) => {
      if (counts[item.quadrant] !== undefined) {
        counts[item.quadrant] += 1;
      }
    });

    return counts;
  }, [processedData]);

  const handlePointClick = useCallback(
    (pointData) => {
      if (!pointData) {
        return;
      }

      setSelectedPoint((prev) => {
        const newSelection =
          prev && prev.name === pointData.name ? null : pointData;
        return newSelection;
      });

      if (typeof onDrillDown === 'function') {
        onDrillDown(pointData);
      }
    },
    [onDrillDown]
  );

  if (!Array.isArray(data) || data.length === 0) {
    return (
      <div className="card flex flex-col items-center justify-center py-12">
        <svg
          className="mb-3 h-10 w-10 text-slate-300 dark:text-slate-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5"
          />
        </svg>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          No data available for the debt quadrant chart.
        </p>
      </div>
    );
  }

  return (
    <div className="card">
      {title && (
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            {title}
          </h3>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {processedData.length} application{processedData.length !== 1 ? 's' : ''}
          </span>
        </div>
      )}

      <div className="relative">
        {/* Quadrant background labels */}
        <div
          className="pointer-events-none absolute inset-0 z-0"
          aria-hidden="true"
        >
          <div className="relative h-full w-full">
            {/* Top-left: Reckless & Inadvertent */}
            <div className="absolute left-[5%] top-[5%] text-2xs font-medium text-red-300 opacity-60 dark:text-red-800">
              Reckless &amp; Inadvertent
            </div>
            {/* Top-right: Reckless & Deliberate */}
            <div className="absolute right-[5%] top-[5%] text-right text-2xs font-medium text-red-300 opacity-60 dark:text-red-800">
              Reckless &amp; Deliberate
            </div>
            {/* Bottom-left: Prudent & Inadvertent */}
            <div className="absolute bottom-[12%] left-[5%] text-2xs font-medium text-green-300 opacity-60 dark:text-green-800">
              Prudent &amp; Inadvertent
            </div>
            {/* Bottom-right: Prudent & Deliberate */}
            <div className="absolute bottom-[12%] right-[5%] text-right text-2xs font-medium text-amber-300 opacity-60 dark:text-amber-800">
              Prudent &amp; Deliberate
            </div>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={height}>
          <ScatterChart
            margin={{ top: 20, right: 30, bottom: 30, left: 30 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#e2e8f0"
              opacity={0.5}
            />
            <XAxis
              type="number"
              dataKey="x"
              domain={[0, 100]}
              tickCount={5}
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              axisLine={{ stroke: '#cbd5e1' }}
              tickLine={{ stroke: '#cbd5e1' }}
            >
              <Label
                value="Inadvertent ← → Deliberate"
                position="bottom"
                offset={10}
                style={{ fontSize: 12, fill: '#64748b', fontWeight: 500 }}
              />
            </XAxis>
            <YAxis
              type="number"
              dataKey="y"
              domain={[0, 100]}
              tickCount={5}
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              axisLine={{ stroke: '#cbd5e1' }}
              tickLine={{ stroke: '#cbd5e1' }}
            >
              <Label
                value="Prudent ← → Reckless"
                angle={-90}
                position="left"
                offset={10}
                style={{ fontSize: 12, fill: '#64748b', fontWeight: 500 }}
              />
            </YAxis>
            <ReferenceLine
              x={50}
              stroke="#94a3b8"
              strokeDasharray="6 4"
              strokeWidth={1.5}
            />
            <ReferenceLine
              y={50}
              stroke="#94a3b8"
              strokeDasharray="6 4"
              strokeWidth={1.5}
            />
            <Tooltip
              content={<QuadrantTooltip />}
              cursor={{ strokeDasharray: '3 3', stroke: '#94a3b8' }}
            />
            <Scatter
              data={processedData}
              onClick={(entry) => {
                if (entry && entry.payload) {
                  handlePointClick(entry.payload);
                }
              }}
              cursor="pointer"
            >
              {processedData.map((entry, index) => (
                <Cell
                  key={`cell-${entry.name || entry.applicationId || index}`}
                  fill={getPointColor(entry.deliberateScore, entry.recklessScore)}
                  fillOpacity={
                    selectedPoint && selectedPoint.name === entry.name
                      ? 1
                      : 0.75
                  }
                  stroke={
                    selectedPoint && selectedPoint.name === entry.name
                      ? '#1e293b'
                      : getPointColor(entry.deliberateScore, entry.recklessScore)
                  }
                  strokeWidth={
                    selectedPoint && selectedPoint.name === entry.name ? 2 : 1
                  }
                  r={
                    selectedPoint && selectedPoint.name === entry.name ? 7 : 5
                  }
                />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {showLegend && (
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {Object.entries(QUADRANT_CONFIG).map(([key, config]) => (
            <div
              key={key}
              className={`rounded-lg border p-2 ${config.bgColor} ${config.borderColor}`}
            >
              <div className="flex items-center gap-1.5">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: config.color }}
                />
                <span className={`text-xs font-medium ${config.textColor}`}>
                  {config.label}
                </span>
              </div>
              <p className="mt-0.5 text-2xs italic text-slate-500 dark:text-slate-400">
                {config.description}
              </p>
              <p className={`mt-1 text-sm font-semibold ${config.textColor}`}>
                {quadrantCounts[key]} app{quadrantCounts[key] !== 1 ? 's' : ''}
              </p>
            </div>
          ))}
        </div>
      )}

      {selectedPoint && (
        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              {selectedPoint.name || selectedPoint.applicationName}
            </h4>
            <button
              type="button"
              onClick={() => setSelectedPoint(null)}
              className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-300"
              aria-label="Close detail panel"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <p className="text-2xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Quadrant
              </p>
              <p
                className={`text-sm font-medium ${
                  QUADRANT_CONFIG[
                    classifyQuadrant(
                      selectedPoint.deliberateScore,
                      selectedPoint.recklessScore
                    )
                  ].textColor
                }`}
              >
                {
                  QUADRANT_CONFIG[
                    classifyQuadrant(
                      selectedPoint.deliberateScore,
                      selectedPoint.recklessScore
                    )
                  ].label
                }
              </p>
            </div>
            <div>
              <p className="text-2xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Deliberate Score
              </p>
              <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                {selectedPoint.deliberateScore}
              </p>
            </div>
            <div>
              <p className="text-2xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Reckless Score
              </p>
              <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                {selectedPoint.recklessScore}
              </p>
            </div>
            {selectedPoint.domain && (
              <div>
                <p className="text-2xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Domain
                </p>
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                  {selectedPoint.domain}
                </p>
              </div>
            )}
            {selectedPoint.debtIndex !== undefined && (
              <div>
                <p className="text-2xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Debt Index
                </p>
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                  {selectedPoint.debtIndex}
                </p>
              </div>
            )}
            {selectedPoint.estimatedRemediationDays !== undefined && (
              <div>
                <p className="text-2xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Remediation Days
                </p>
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                  {selectedPoint.estimatedRemediationDays}
                </p>
              </div>
            )}
            {selectedPoint.codeSmells !== undefined && (
              <div>
                <p className="text-2xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Code Smells
                </p>
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                  {selectedPoint.codeSmells}
                </p>
              </div>
            )}
            {selectedPoint.duplications !== undefined && (
              <div>
                <p className="text-2xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Duplications
                </p>
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                  {selectedPoint.duplications}%
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

FowlerDebtQuadrant.propTypes = {
  data: PropTypes.arrayOf(
    PropTypes.shape({
      name: PropTypes.string,
      applicationName: PropTypes.string,
      applicationId: PropTypes.string,
      domain: PropTypes.string,
      deliberateScore: PropTypes.number.isRequired,
      recklessScore: PropTypes.number.isRequired,
      debtIndex: PropTypes.number,
      estimatedRemediationDays: PropTypes.number,
      codeSmells: PropTypes.number,
      duplications: PropTypes.number,
      complexityScore: PropTypes.number,
      outdatedDependencies: PropTypes.number,
    })
  ),
  onDrillDown: PropTypes.func,
  height: PropTypes.number,
  title: PropTypes.string,
  showLegend: PropTypes.bool,
};

FowlerDebtQuadrant.defaultProps = {
  data: [],
  onDrillDown: null,
  height: 450,
  title: "Fowler's Technical Debt Quadrant",
  showLegend: true,
};

export default FowlerDebtQuadrant;