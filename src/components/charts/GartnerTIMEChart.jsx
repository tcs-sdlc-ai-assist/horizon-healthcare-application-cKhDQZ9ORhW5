import { useState, useMemo, useCallback } from 'react';
import PropTypes from 'prop-types';

const TIME_QUADRANTS = {
  TOLERATE: {
    key: 'Tolerate',
    label: 'Tolerate',
    description: 'Low business value, low technical quality — maintain as-is with minimal investment',
    color: '#F59E0B',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    textColor: 'text-amber-800',
    dotColor: 'bg-amber-500',
    hoverBg: 'hover:bg-amber-100',
    gridPosition: 'bottom-left',
  },
  INVEST: {
    key: 'Invest',
    label: 'Invest',
    description: 'High business value, high technical quality — continue investing and enhancing',
    color: '#10B981',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    textColor: 'text-green-800',
    dotColor: 'bg-green-500',
    hoverBg: 'hover:bg-green-100',
    gridPosition: 'top-right',
  },
  MIGRATE: {
    key: 'Migrate',
    label: 'Migrate',
    description: 'High business value, low technical quality — migrate to modern platform',
    color: '#3B82F6',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    textColor: 'text-blue-800',
    dotColor: 'bg-blue-500',
    hoverBg: 'hover:bg-blue-100',
    gridPosition: 'top-left',
  },
  ELIMINATE: {
    key: 'Eliminate',
    label: 'Eliminate',
    description: 'Low business value, low technical quality — decommission or replace',
    color: '#EF4444',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    textColor: 'text-red-800',
    dotColor: 'bg-red-500',
    hoverBg: 'hover:bg-red-100',
    gridPosition: 'bottom-right',
  },
};

const QUADRANT_ORDER = ['MIGRATE', 'INVEST', 'TOLERATE', 'ELIMINATE'];

function classifyApplication(app) {
  const businessValue = app.businessValue ?? 50;
  const technicalQuality = app.technicalQuality ?? 50;

  if (businessValue >= 50 && technicalQuality >= 50) {
    return 'INVEST';
  }
  if (businessValue >= 50 && technicalQuality < 50) {
    return 'MIGRATE';
  }
  if (businessValue < 50 && technicalQuality < 50) {
    return 'ELIMINATE';
  }
  return 'TOLERATE';
}

function ApplicationDot({ app, quadrant, onClick, isSelected }) {
  const [showTooltip, setShowTooltip] = useState(false);

  const handleMouseEnter = useCallback(() => {
    setShowTooltip(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setShowTooltip(false);
  }, []);

  const handleClick = useCallback(() => {
    if (onClick) {
      onClick(app);
    }
  }, [app, onClick]);

  const handleKeyDown = useCallback(
    (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && onClick) {
        e.preventDefault();
        onClick(app);
      }
    },
    [app, onClick]
  );

  const xPercent = Math.min(90, Math.max(10, ((app.technicalQuality ?? 50) % 50) * 1.6 + 10));
  const yPercent = Math.min(90, Math.max(10, ((app.businessValue ?? 50) % 50) * 1.6 + 10));

  const config = TIME_QUADRANTS[quadrant];

  return (
    <div
      className="absolute"
      style={{
        left: `${xPercent}%`,
        bottom: `${yPercent}%`,
        transform: 'translate(-50%, 50%)',
      }}
    >
      <div
        role="button"
        tabIndex={0}
        className={`relative w-4 h-4 rounded-full cursor-pointer transition-all duration-200 ${config.dotColor} ${
          isSelected ? 'ring-2 ring-offset-1 ring-slate-700 scale-150' : 'hover:scale-125'
        }`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        aria-label={`${app.name} — ${config.label} quadrant`}
      />
      {showTooltip && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 rounded-lg border border-slate-200 bg-white p-3 shadow-lg dark:border-slate-600 dark:bg-slate-800">
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1">
            {app.name}
          </div>
          {app.domain && (
            <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">
              {app.domain}
            </div>
          )}
          <div className="flex items-center gap-1.5 mb-1">
            <span className={`inline-block w-2 h-2 rounded-full ${config.dotColor}`} />
            <span className={`text-xs font-medium ${config.textColor}`}>
              {config.label}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1 text-xs text-slate-600 dark:text-slate-300">
            <div>
              <span className="text-slate-400 dark:text-slate-500">Business Value:</span>{' '}
              <span className="font-medium">{app.businessValue ?? 'N/A'}</span>
            </div>
            <div>
              <span className="text-slate-400 dark:text-slate-500">Tech Quality:</span>{' '}
              <span className="font-medium">{app.technicalQuality ?? 'N/A'}</span>
            </div>
          </div>
          {app.team && (
            <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              Team: {app.team}
            </div>
          )}
          {app.tier && (
            <div className="text-xs text-slate-400 dark:text-slate-500">
              Tier: {app.tier}
            </div>
          )}
          <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-white dark:border-t-slate-800" />
        </div>
      )}
    </div>
  );
}

ApplicationDot.propTypes = {
  app: PropTypes.shape({
    id: PropTypes.string,
    name: PropTypes.string.isRequired,
    domain: PropTypes.string,
    team: PropTypes.string,
    tier: PropTypes.string,
    businessValue: PropTypes.number,
    technicalQuality: PropTypes.number,
    classification: PropTypes.string,
  }).isRequired,
  quadrant: PropTypes.string.isRequired,
  onClick: PropTypes.func,
  isSelected: PropTypes.bool,
};

ApplicationDot.defaultProps = {
  onClick: null,
  isSelected: false,
};

function QuadrantPanel({ quadrantKey, applications: apps, onAppClick, selectedAppId }) {
  const config = TIME_QUADRANTS[quadrantKey];

  return (
    <div
      className={`relative ${config.bgColor} ${config.borderColor} border rounded-lg p-3 min-h-[180px] overflow-hidden transition-colors duration-200`}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <span className={`inline-block w-2.5 h-2.5 rounded-full ${config.dotColor}`} />
        <span className={`text-sm font-semibold ${config.textColor}`}>
          {config.label}
        </span>
        <span className="text-xs text-slate-500 dark:text-slate-400 ml-auto">
          {apps.length} {apps.length === 1 ? 'app' : 'apps'}
        </span>
      </div>
      <p className="text-2xs text-slate-500 dark:text-slate-400 mb-3 leading-tight">
        {config.description}
      </p>
      <div className="relative w-full h-32">
        {apps.map((app) => (
          <ApplicationDot
            key={app.id || app.name}
            app={app}
            quadrant={quadrantKey}
            onClick={onAppClick}
            isSelected={selectedAppId === (app.id || app.name)}
          />
        ))}
        {apps.length === 0 && (
          <div className="flex items-center justify-center h-full text-xs text-slate-400 dark:text-slate-500">
            No applications
          </div>
        )}
      </div>
    </div>
  );
}

QuadrantPanel.propTypes = {
  quadrantKey: PropTypes.string.isRequired,
  applications: PropTypes.array.isRequired,
  onAppClick: PropTypes.func,
  selectedAppId: PropTypes.string,
};

QuadrantPanel.defaultProps = {
  onAppClick: null,
  selectedAppId: null,
};

function DrillDownPanel({ app, quadrantKey, onClose }) {
  const config = TIME_QUADRANTS[quadrantKey];

  return (
    <div className="mt-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800 animate-fade-in">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h4 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            {app.name}
          </h4>
          <div className="flex items-center gap-2 mt-1">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${config.bgColor} ${config.textColor}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${config.dotColor}`} />
              {config.label}
            </span>
            {app.tier && (
              <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                {app.tier}
              </span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors dark:hover:bg-slate-700 dark:hover:text-slate-300"
          aria-label="Close details"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-700/50">
          <div className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">Business Value</div>
          <div className="text-lg font-bold text-slate-900 dark:text-slate-100">
            {app.businessValue ?? 'N/A'}
          </div>
        </div>
        <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-700/50">
          <div className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">Tech Quality</div>
          <div className="text-lg font-bold text-slate-900 dark:text-slate-100">
            {app.technicalQuality ?? 'N/A'}
          </div>
        </div>
        <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-700/50">
          <div className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">Domain</div>
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
            {app.domain || 'N/A'}
          </div>
        </div>
        <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-700/50">
          <div className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">Team</div>
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
            {app.team || 'N/A'}
          </div>
        </div>
      </div>

      {app.techStack && (
        <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          <span className="font-medium text-slate-600 dark:text-slate-300">Tech Stack:</span>{' '}
          {app.techStack}
        </div>
      )}

      <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-600 dark:bg-slate-700/30">
        <div className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
          Recommendation
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          {config.description}
        </p>
      </div>
    </div>
  );
}

DrillDownPanel.propTypes = {
  app: PropTypes.shape({
    id: PropTypes.string,
    name: PropTypes.string.isRequired,
    domain: PropTypes.string,
    team: PropTypes.string,
    tier: PropTypes.string,
    techStack: PropTypes.string,
    businessValue: PropTypes.number,
    technicalQuality: PropTypes.number,
  }).isRequired,
  quadrantKey: PropTypes.string.isRequired,
  onClose: PropTypes.func.isRequired,
};

/**
 * GartnerTIMEChart — Quadrant chart implementing the Gartner TIME
 * (Tolerate, Invest, Migrate, Eliminate) classification view.
 *
 * Renders a 2×2 grid with applications plotted by their classification.
 * Supports tooltips, legends, and drill-down to application details.
 *
 * @param {Object} props
 * @param {Array<Object>} props.applications - Array of application objects to classify and plot.
 *   Each application should have: { id, name, domain?, team?, tier?, techStack?,
 *   businessValue (0-100), technicalQuality (0-100), classification? }
 *   If `classification` is provided ('Tolerate'|'Invest'|'Migrate'|'Eliminate'),
 *   it overrides the auto-classification from businessValue/technicalQuality.
 * @param {string} [props.title] - Chart title
 * @param {Function} [props.onApplicationClick] - Callback when an application is clicked
 * @param {boolean} [props.showLegend] - Whether to show the legend (default: true)
 * @param {boolean} [props.showDrillDown] - Whether to enable drill-down panel (default: true)
 * @param {string} [props.className] - Additional CSS classes
 */
export function GartnerTIMEChart({
  applications: apps,
  title,
  onApplicationClick,
  showLegend,
  showDrillDown,
  className,
}) {
  const [selectedApp, setSelectedApp] = useState(null);

  const classifiedApps = useMemo(() => {
    if (!Array.isArray(apps)) return {};

    const grouped = {
      TOLERATE: [],
      INVEST: [],
      MIGRATE: [],
      ELIMINATE: [],
    };

    apps.forEach((app) => {
      let quadrant;

      if (app.classification) {
        const normalized = app.classification.trim().toUpperCase();
        if (grouped[normalized] !== undefined) {
          quadrant = normalized;
        } else {
          quadrant = classifyApplication(app);
        }
      } else {
        quadrant = classifyApplication(app);
      }

      grouped[quadrant].push(app);
    });

    return grouped;
  }, [apps]);

  const totalApps = useMemo(() => {
    return Object.values(classifiedApps).reduce((sum, arr) => sum + arr.length, 0);
  }, [classifiedApps]);

  const selectedQuadrant = useMemo(() => {
    if (!selectedApp) return null;
    for (const [key, appList] of Object.entries(classifiedApps)) {
      if (appList.some((a) => (a.id || a.name) === (selectedApp.id || selectedApp.name))) {
        return key;
      }
    }
    return null;
  }, [selectedApp, classifiedApps]);

  const handleAppClick = useCallback(
    (app) => {
      setSelectedApp((prev) => {
        const prevId = prev ? prev.id || prev.name : null;
        const newId = app.id || app.name;
        return prevId === newId ? null : app;
      });

      if (onApplicationClick) {
        onApplicationClick(app);
      }
    },
    [onApplicationClick]
  );

  const handleCloseDrillDown = useCallback(() => {
    setSelectedApp(null);
  }, []);

  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800 ${className || ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            {title || 'Gartner TIME Classification'}
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {totalApps} {totalApps === 1 ? 'application' : 'applications'} classified across quadrants
          </p>
        </div>
      </div>

      {/* Axis Labels + Quadrant Grid */}
      <div className="relative">
        {/* Y-axis label */}
        <div className="absolute -left-1 top-1/2 -translate-y-1/2 -rotate-90 text-xs font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">
          Business Value →
        </div>

        <div className="ml-5">
          {/* Quadrant Grid: 2x2 */}
          <div className="grid grid-cols-2 gap-2">
            {/* Top row: Migrate (top-left), Invest (top-right) */}
            <QuadrantPanel
              quadrantKey="MIGRATE"
              applications={classifiedApps.MIGRATE || []}
              onAppClick={handleAppClick}
              selectedAppId={selectedApp ? selectedApp.id || selectedApp.name : null}
            />
            <QuadrantPanel
              quadrantKey="INVEST"
              applications={classifiedApps.INVEST || []}
              onAppClick={handleAppClick}
              selectedAppId={selectedApp ? selectedApp.id || selectedApp.name : null}
            />
            {/* Bottom row: Eliminate (bottom-left), Tolerate (bottom-right) */}
            <QuadrantPanel
              quadrantKey="ELIMINATE"
              applications={classifiedApps.ELIMINATE || []}
              onAppClick={handleAppClick}
              selectedAppId={selectedApp ? selectedApp.id || selectedApp.name : null}
            />
            <QuadrantPanel
              quadrantKey="TOLERATE"
              applications={classifiedApps.TOLERATE || []}
              onAppClick={handleAppClick}
              selectedAppId={selectedApp ? selectedApp.id || selectedApp.name : null}
            />
          </div>

          {/* X-axis label */}
          <div className="text-center mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">
            Technical Quality →
          </div>
        </div>
      </div>

      {/* Legend */}
      {showLegend && (
        <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-slate-200 pt-4 dark:border-slate-700">
          {QUADRANT_ORDER.map((key) => {
            const config = TIME_QUADRANTS[key];
            const count = (classifiedApps[key] || []).length;
            return (
              <div key={key} className="flex items-center gap-1.5">
                <span className={`inline-block w-3 h-3 rounded-full ${config.dotColor}`} />
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  {config.label}
                </span>
                <span className="text-xs text-slate-400 dark:text-slate-500">
                  ({count})
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Summary Bar */}
      {totalApps > 0 && (
        <div className="mt-3 flex h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
          {QUADRANT_ORDER.map((key) => {
            const count = (classifiedApps[key] || []).length;
            if (count === 0) return null;
            const widthPercent = (count / totalApps) * 100;
            const config = TIME_QUADRANTS[key];
            return (
              <div
                key={key}
                className="h-full transition-all duration-300"
                style={{
                  width: `${widthPercent}%`,
                  backgroundColor: config.color,
                }}
                title={`${config.label}: ${count} (${Math.round(widthPercent)}%)`}
              />
            );
          })}
        </div>
      )}

      {/* Drill-down Panel */}
      {showDrillDown && selectedApp && selectedQuadrant && (
        <DrillDownPanel
          app={selectedApp}
          quadrantKey={selectedQuadrant}
          onClose={handleCloseDrillDown}
        />
      )}
    </div>
  );
}

GartnerTIMEChart.propTypes = {
  applications: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string,
      name: PropTypes.string.isRequired,
      domain: PropTypes.string,
      team: PropTypes.string,
      tier: PropTypes.string,
      techStack: PropTypes.string,
      businessValue: PropTypes.number,
      technicalQuality: PropTypes.number,
      classification: PropTypes.string,
    })
  ).isRequired,
  title: PropTypes.string,
  onApplicationClick: PropTypes.func,
  showLegend: PropTypes.bool,
  showDrillDown: PropTypes.bool,
  className: PropTypes.string,
};

GartnerTIMEChart.defaultProps = {
  title: 'Gartner TIME Classification',
  onApplicationClick: null,
  showLegend: true,
  showDrillDown: true,
  className: '',
};

export default GartnerTIMEChart;