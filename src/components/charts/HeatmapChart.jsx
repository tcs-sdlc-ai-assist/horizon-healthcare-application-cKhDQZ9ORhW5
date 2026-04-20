import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';

/**
 * Returns a background color class or inline style based on the debt index value.
 * Higher debt = more intense red/warm color. Lower debt = cooler green/blue.
 * @param {number} value - Debt index value (0-100)
 * @returns {{ backgroundColor: string }} Inline style object with computed color
 */
function getHeatmapColor(value) {
  if (value === null || value === undefined || isNaN(Number(value))) {
    return { backgroundColor: '#f3f4f6' };
  }

  const v = Math.max(0, Math.min(100, Number(value)));

  if (v <= 20) {
    return { backgroundColor: '#dcfce7' };
  }
  if (v <= 35) {
    return { backgroundColor: '#bbf7d0' };
  }
  if (v <= 50) {
    return { backgroundColor: '#fef08a' };
  }
  if (v <= 65) {
    return { backgroundColor: '#fde68a' };
  }
  if (v <= 75) {
    return { backgroundColor: '#fdba74' };
  }
  if (v <= 85) {
    return { backgroundColor: '#fca5a5' };
  }
  return { backgroundColor: '#f87171' };
}

/**
 * Returns a text color that contrasts well with the heatmap cell background.
 * @param {number} value - Debt index value (0-100)
 * @returns {string} Tailwind text color class
 */
function getTextColorClass(value) {
  if (value === null || value === undefined || isNaN(Number(value))) {
    return 'text-gray-400';
  }
  const v = Number(value);
  if (v > 75) {
    return 'text-red-900';
  }
  if (v > 50) {
    return 'text-amber-900';
  }
  if (v > 35) {
    return 'text-yellow-900';
  }
  return 'text-green-900';
}

/**
 * HeatmapChart — Custom heatmap visualization for Tech Debt Index display
 * per Domain and Application. Renders a grid of colored cells with intensity
 * based on debt score. Supports tooltips showing detailed metrics and
 * drill-down to application details.
 *
 * @param {object} props
 * @param {Array<object>} props.data - Array of tech debt metric entries. Each entry should have:
 *   applicationId, applicationName, domain, date, debtIndex, codeSmells,
 *   duplications, complexityScore, outdatedDependencies, estimatedRemediationDays
 * @param {string} [props.title] - Optional chart title
 * @param {Function} [props.onCellClick] - Callback when a cell is clicked, receives the data entry
 * @param {string} [props.className] - Additional CSS classes for the container
 * @param {boolean} [props.showLegend] - Whether to show the color legend (default: true)
 * @param {boolean} [props.showValues] - Whether to show numeric values in cells (default: true)
 */
export function HeatmapChart({
  data,
  title,
  onCellClick,
  className,
  showLegend,
  showValues,
}) {
  const [tooltip, setTooltip] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const containerRef = useRef(null);
  const tooltipRef = useRef(null);

  /**
   * Organize data into a grid structure: rows = domains, columns = applications.
   * Uses the latest date entry per application if multiple dates exist.
   */
  const { domains, applicationsByDomain, gridData } = useMemo(() => {
    if (!Array.isArray(data) || data.length === 0) {
      return { domains: [], applicationsByDomain: {}, gridData: {} };
    }

    const latestByApp = {};
    data.forEach((entry) => {
      const key = entry.applicationId;
      if (!latestByApp[key] || entry.date > latestByApp[key].date) {
        latestByApp[key] = entry;
      }
    });

    const entries = Object.values(latestByApp);

    const domainMap = {};
    entries.forEach((entry) => {
      const domain = entry.domain || 'Unknown';
      if (!domainMap[domain]) {
        domainMap[domain] = {};
      }
      domainMap[domain][entry.applicationName] = entry;
    });

    const sortedDomains = Object.keys(domainMap).sort();

    const appsByDomain = {};
    sortedDomains.forEach((domain) => {
      appsByDomain[domain] = Object.keys(domainMap[domain]).sort();
    });

    return {
      domains: sortedDomains,
      applicationsByDomain: appsByDomain,
      gridData: domainMap,
    };
  }, [data]);

  const handleMouseEnter = useCallback((entry, event) => {
    if (!entry) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const containerRect = containerRef.current
      ? containerRef.current.getBoundingClientRect()
      : { left: 0, top: 0 };

    setTooltipPosition({
      x: rect.left - containerRect.left + rect.width / 2,
      y: rect.top - containerRect.top,
    });
    setTooltip(entry);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setTooltip(null);
  }, []);

  const handleCellClick = useCallback(
    (entry) => {
      if (onCellClick && entry) {
        onCellClick(entry);
      }
    },
    [onCellClick]
  );

  const handleCellKeyDown = useCallback(
    (entry, event) => {
      if ((event.key === 'Enter' || event.key === ' ') && onCellClick && entry) {
        event.preventDefault();
        onCellClick(entry);
      }
    },
    [onCellClick]
  );

  useEffect(() => {
    if (tooltip && tooltipRef.current && containerRef.current) {
      const tooltipEl = tooltipRef.current;
      const containerRect = containerRef.current.getBoundingClientRect();
      const tooltipRect = tooltipEl.getBoundingClientRect();

      let adjustedX = tooltipPosition.x;
      const tooltipLeft = containerRect.left + adjustedX - tooltipRect.width / 2;
      const tooltipRight = tooltipLeft + tooltipRect.width;

      if (tooltipLeft < containerRect.left) {
        adjustedX = tooltipRect.width / 2;
      } else if (tooltipRight > containerRect.right) {
        adjustedX = containerRect.width - tooltipRect.width / 2;
      }

      if (adjustedX !== tooltipPosition.x) {
        setTooltipPosition((prev) => ({ ...prev, x: adjustedX }));
      }
    }
  }, [tooltip, tooltipPosition.x]);

  if (!Array.isArray(data) || data.length === 0) {
    return (
      <div className={`rounded-xl border border-slate-200 bg-white p-6 ${className || ''}`}>
        {title && (
          <h3 className="mb-4 text-lg font-semibold text-slate-800">{title}</h3>
        )}
        <div className="flex items-center justify-center py-12 text-sm text-gray-500">
          No tech debt data available to display.
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`relative rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow duration-200 hover:shadow-md ${className || ''}`}
    >
      {title && (
        <h3 className="mb-4 text-lg font-semibold text-slate-800">{title}</h3>
      )}

      <div className="overflow-x-auto scrollbar-thin">
        <div className="min-w-[400px]">
          {domains.map((domain) => {
            const apps = applicationsByDomain[domain] || [];
            return (
              <div key={domain} className="mb-6 last:mb-0">
                <h4 className="mb-2 text-sm font-semibold text-slate-700">
                  {domain}
                </h4>
                <div className="flex flex-wrap gap-2">
                  {apps.map((appName) => {
                    const entry = gridData[domain]?.[appName];
                    const debtValue = entry ? entry.debtIndex : null;
                    const colorStyle = getHeatmapColor(debtValue);
                    const textClass = getTextColorClass(debtValue);

                    return (
                      <div
                        key={entry ? entry.applicationId : appName}
                        role={onCellClick ? 'button' : undefined}
                        tabIndex={onCellClick ? 0 : undefined}
                        className={`relative flex flex-col items-center justify-center rounded-lg border border-slate-200 px-3 py-2 text-center transition-all duration-150 ${
                          onCellClick
                            ? 'cursor-pointer hover:scale-105 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1'
                            : ''
                        }`}
                        style={{
                          ...colorStyle,
                          minWidth: '100px',
                          minHeight: '64px',
                        }}
                        onClick={() => handleCellClick(entry)}
                        onKeyDown={(e) => handleCellKeyDown(entry, e)}
                        onMouseEnter={(e) => handleMouseEnter(entry, e)}
                        onMouseLeave={handleMouseLeave}
                        aria-label={
                          entry
                            ? `${appName}: Tech Debt Index ${debtValue}`
                            : `${appName}: No data`
                        }
                      >
                        <span className={`text-xs font-medium leading-tight ${textClass}`}>
                          {appName.length > 16
                            ? `${appName.slice(0, 14)}…`
                            : appName}
                        </span>
                        {showValues && debtValue !== null && (
                          <span className={`mt-1 text-lg font-bold leading-none ${textClass}`}>
                            {debtValue.toFixed(1)}
                          </span>
                        )}
                        {debtValue === null && (
                          <span className="mt-1 text-xs text-gray-400">N/A</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {showLegend && (
        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
          <span className="text-xs font-medium text-slate-600">Debt Index:</span>
          {[
            { label: '0–20', color: '#dcfce7' },
            { label: '21–35', color: '#bbf7d0' },
            { label: '36–50', color: '#fef08a' },
            { label: '51–65', color: '#fde68a' },
            { label: '66–75', color: '#fdba74' },
            { label: '76–85', color: '#fca5a5' },
            { label: '86–100', color: '#f87171' },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-1">
              <div
                className="h-3 w-5 rounded-sm border border-slate-200"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-2xs text-slate-500">{item.label}</span>
            </div>
          ))}
        </div>
      )}

      {tooltip && (
        <div
          ref={tooltipRef}
          className="pointer-events-none absolute z-50 w-56 rounded-lg border border-slate-200 bg-white p-3 shadow-lg"
          style={{
            left: `${tooltipPosition.x}px`,
            top: `${tooltipPosition.y - 8}px`,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <div className="mb-2 border-b border-slate-100 pb-2">
            <p className="text-sm font-semibold text-slate-800">
              {tooltip.applicationName}
            </p>
            <p className="text-xs text-slate-500">{tooltip.domain}</p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-600">Debt Index</span>
              <span className={`text-xs font-bold ${getTextColorClass(tooltip.debtIndex)}`}>
                {tooltip.debtIndex !== null && tooltip.debtIndex !== undefined
                  ? tooltip.debtIndex.toFixed(1)
                  : 'N/A'}
              </span>
            </div>
            {tooltip.codeSmells !== undefined && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-600">Code Smells</span>
                <span className="text-xs font-medium text-slate-800">
                  {tooltip.codeSmells.toLocaleString()}
                </span>
              </div>
            )}
            {tooltip.duplications !== undefined && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-600">Duplications</span>
                <span className="text-xs font-medium text-slate-800">
                  {tooltip.duplications}%
                </span>
              </div>
            )}
            {tooltip.complexityScore !== undefined && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-600">Complexity</span>
                <span className="text-xs font-medium text-slate-800">
                  {tooltip.complexityScore}
                </span>
              </div>
            )}
            {tooltip.outdatedDependencies !== undefined && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-600">Outdated Deps</span>
                <span className="text-xs font-medium text-slate-800">
                  {tooltip.outdatedDependencies}
                </span>
              </div>
            )}
            {tooltip.estimatedRemediationDays !== undefined && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-600">Est. Remediation</span>
                <span className="text-xs font-medium text-slate-800">
                  {tooltip.estimatedRemediationDays}d
                </span>
              </div>
            )}
          </div>
          {onCellClick && (
            <p className="mt-2 border-t border-slate-100 pt-1 text-center text-2xs text-blue-500">
              Click to view details
            </p>
          )}
        </div>
      )}
    </div>
  );
}

HeatmapChart.propTypes = {
  data: PropTypes.arrayOf(
    PropTypes.shape({
      applicationId: PropTypes.string.isRequired,
      applicationName: PropTypes.string.isRequired,
      domain: PropTypes.string.isRequired,
      date: PropTypes.string,
      debtIndex: PropTypes.number,
      codeSmells: PropTypes.number,
      duplications: PropTypes.number,
      complexityScore: PropTypes.number,
      outdatedDependencies: PropTypes.number,
      estimatedRemediationDays: PropTypes.number,
    })
  ).isRequired,
  title: PropTypes.string,
  onCellClick: PropTypes.func,
  className: PropTypes.string,
  showLegend: PropTypes.bool,
  showValues: PropTypes.bool,
};

HeatmapChart.defaultProps = {
  title: '',
  onCellClick: null,
  className: '',
  showLegend: true,
  showValues: true,
};