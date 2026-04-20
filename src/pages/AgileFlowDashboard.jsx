import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DrillDownWrapper } from '@/components/common/DrillDownWrapper';
import { ColumnChart } from '@/components/charts/ColumnChart';
import { BarChart } from '@/components/charts/BarChart';
import { SprintSummaryTable } from '@/components/charts/SprintSummaryTable';
import { MetricCard } from '@/components/charts/MetricCard';
import { CSVImportModal } from '@/components/common/CSVImportModal';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { useDashboardData } from '@/hooks/useDashboardData';
import { useRoleGuard } from '@/hooks/useRoleGuard';
import { useFilters } from '@/context/FilterContext';
import { formatNumber, formatPercentage } from '@/utils/formatUtils';
import { CHART_COLORS } from '@/constants/constants';

/**
 * Computes summary KPI metrics from sprint data.
 * @param {Array<Object>} sprints - Sprint metrics array
 * @returns {{ avgVelocity: number, avgPredictability: number, totalCarryOver: number, totalSprints: number, totalCommitted: number, totalDone: number, totalDeployed: number }}
 */
function computeSprintSummary(sprints) {
  if (!Array.isArray(sprints) || sprints.length === 0) {
    return {
      avgVelocity: 0,
      avgPredictability: 0,
      totalCarryOver: 0,
      totalSprints: 0,
      totalCommitted: 0,
      totalDone: 0,
      totalDeployed: 0,
    };
  }

  const totalCommitted = sprints.reduce((sum, s) => sum + (Number(s.committed) || 0), 0);
  const totalDone = sprints.reduce((sum, s) => sum + (Number(s.done) || 0), 0);
  const totalDeployed = sprints.reduce((sum, s) => sum + (Number(s.deployed) || 0), 0);
  const totalCarryOver = sprints.reduce((sum, s) => sum + (Number(s.carryOver) || 0), 0);

  const velocities = sprints.map((s) => Number(s.velocity) || 0);
  const avgVelocity = velocities.length > 0
    ? velocities.reduce((sum, v) => sum + v, 0) / velocities.length
    : 0;

  const predictabilities = sprints
    .map((s) => Number(s.predictability))
    .filter((v) => !isNaN(v));
  const avgPredictability = predictabilities.length > 0
    ? predictabilities.reduce((sum, v) => sum + v, 0) / predictabilities.length
    : 0;

  return {
    avgVelocity: parseFloat(avgVelocity.toFixed(1)),
    avgPredictability: parseFloat(avgPredictability.toFixed(1)),
    totalCarryOver,
    totalSprints: sprints.length,
    totalCommitted,
    totalDone,
    totalDeployed,
  };
}

/**
 * Prepares column chart data from sprint metrics for Committed/Done/Deployed visualization.
 * @param {Array<Object>} sprints - Sprint metrics array
 * @returns {Array<Object>} Chart-ready data with predictability annotations
 */
function prepareSprintColumnData(sprints) {
  if (!Array.isArray(sprints) || sprints.length === 0) {
    return [];
  }

  return sprints.map((sprint) => ({
    sprintName: sprint.sprintName || 'Unknown',
    committed: Number(sprint.committed) || 0,
    done: Number(sprint.done) || 0,
    deployed: Number(sprint.deployed) || 0,
    predictability: Number(sprint.predictability) || 0,
    team: sprint.team || '',
    sprintId: sprint.sprintId || '',
  }));
}

/**
 * Builds predictability annotations keyed by sprint name.
 * @param {Array<Object>} sprints - Sprint metrics array
 * @returns {Object} Annotations keyed by sprintName
 */
function buildPredictabilityAnnotations(sprints) {
  if (!Array.isArray(sprints) || sprints.length === 0) {
    return null;
  }

  const annotations = {};
  sprints.forEach((sprint) => {
    const name = sprint.sprintName || 'Unknown';
    const predictability = Number(sprint.predictability);
    if (!isNaN(predictability)) {
      annotations[name] = {
        label: 'Predictability',
        value: predictability,
        format: 'percentage',
      };
    }
  });

  return Object.keys(annotations).length > 0 ? annotations : null;
}

/**
 * Prepares flow distribution data for the bar chart.
 * @param {Array<Object>} flowData - Flow distribution array
 * @returns {Array<Object>} Chart-ready data
 */
function prepareFlowDistributionData(flowData) {
  if (!Array.isArray(flowData) || flowData.length === 0) {
    return [];
  }

  return flowData.map((entry) => ({
    team: entry.team || 'Unknown',
    features: Number(entry.features) || 0,
    defects: Number(entry.defects) || 0,
    risks: Number(entry.risks) || 0,
    debt: Number(entry.debt) || 0,
  }));
}

/**
 * AgileFlowDashboard — Main Agile Flow & Sprint Analytics Dashboard page.
 *
 * Composes ColumnChart (Committed/Done/Deployed with Predictability % annotation),
 * BarChart (Flow Distribution), and SprintSummaryTable. Includes navigation to
 * sprint/application details and linked Jira/qTest views via DrillDownWrapper.
 * Uses useDashboardData hook. Wrapped in DashboardLayout.
 *
 * @returns {JSX.Element}
 */
export default function AgileFlowDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { canImport } = useRoleGuard();

  useEffect(() => {
    const parts = location.pathname.split('/');
    if (parts.length > 3) {
      const sectionId = parts[3];
      const element = document.getElementById(sectionId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } else {
      const mainElement = document.querySelector('main');
      if (mainElement) {
        mainElement.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  }, [location.pathname]);
  const { filters } = useFilters();
  const { data, loading, error, refresh } = useDashboardData('agileflow');

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const contentRef = useRef(null);

  const sprintMetrics = useMemo(() => {
    return data.sprintMetrics || [];
  }, [data.sprintMetrics]);

  const flowDistribution = useMemo(() => {
    return data.flowDistribution || [];
  }, [data.flowDistribution]);

  const summary = useMemo(() => {
    return computeSprintSummary(sprintMetrics);
  }, [sprintMetrics]);

  const columnChartData = useMemo(() => {
    return prepareSprintColumnData(sprintMetrics);
  }, [sprintMetrics]);

  const predictabilityAnnotations = useMemo(() => {
    return buildPredictabilityAnnotations(sprintMetrics);
  }, [sprintMetrics]);

  const flowChartData = useMemo(() => {
    return prepareFlowDistributionData(flowDistribution);
  }, [flowDistribution]);

  const velocitySparkline = useMemo(() => {
    if (!Array.isArray(sprintMetrics) || sprintMetrics.length === 0) {
      return null;
    }
    return sprintMetrics.map((s) => ({ value: Number(s.velocity) || 0 }));
  }, [sprintMetrics]);

  const predictabilitySparkline = useMemo(() => {
    if (!Array.isArray(sprintMetrics) || sprintMetrics.length === 0) {
      return null;
    }
    return sprintMetrics.map((s) => ({ value: Number(s.predictability) || 0 }));
  }, [sprintMetrics]);

  const handleSprintRowClick = useCallback(
    (row) => {
      if (row && row.sprintId) {
        navigate(
          `/dashboards/agile/sprint?sprintId=${encodeURIComponent(row.sprintId)}&team=${encodeURIComponent(row.team || '')}`
        );
      }
    },
    [navigate]
  );

  const handleColumnBarClick = useCallback(
    ({ category, dataKey, value, data: barData }) => {
      if (barData && barData.sprintId) {
        navigate(
          `/dashboards/agile/sprint?sprintId=${encodeURIComponent(barData.sprintId)}&team=${encodeURIComponent(barData.team || '')}`
        );
      }
    },
    [navigate]
  );

  const handleDrillDown = useCallback(
    (drillDownData) => {
      if (drillDownData && drillDownData.sprintId) {
        navigate(
          `/dashboards/agile/sprint?sprintId=${encodeURIComponent(drillDownData.sprintId)}&team=${encodeURIComponent(drillDownData.team || '')}`
        );
      }
    },
    [navigate]
  );

  const handleFieldSave = useCallback(
    (saveResult) => {
      if (saveResult) {
        refresh();
      }
    },
    [refresh]
  );

  const handleOpenImport = useCallback(() => {
    setIsImportModalOpen(true);
  }, []);

  const handleCloseImport = useCallback(() => {
    setIsImportModalOpen(false);
  }, []);

  const handleImportComplete = useCallback(
    (result) => {
      if (result && result.success) {
        refresh();
      }
    },
    [refresh]
  );

  const velocityTrend = useMemo(() => {
    if (!Array.isArray(sprintMetrics) || sprintMetrics.length < 2) {
      return 'flat';
    }
    const recent = sprintMetrics.slice(-3);
    const older = sprintMetrics.slice(-6, -3);
    if (recent.length === 0 || older.length === 0) return 'flat';

    const recentAvg = recent.reduce((s, r) => s + (Number(r.velocity) || 0), 0) / recent.length;
    const olderAvg = older.reduce((s, r) => s + (Number(r.velocity) || 0), 0) / older.length;

    if (recentAvg > olderAvg * 1.05) return 'up';
    if (recentAvg < olderAvg * 0.95) return 'down';
    return 'flat';
  }, [sprintMetrics]);

  const predictabilityTrend = useMemo(() => {
    if (!Array.isArray(sprintMetrics) || sprintMetrics.length < 2) {
      return 'flat';
    }
    const recent = sprintMetrics.slice(-3);
    const older = sprintMetrics.slice(-6, -3);
    if (recent.length === 0 || older.length === 0) return 'flat';

    const recentAvg = recent.reduce((s, r) => s + (Number(r.predictability) || 0), 0) / recent.length;
    const olderAvg = older.reduce((s, r) => s + (Number(r.predictability) || 0), 0) / older.length;

    if (recentAvg > olderAvg * 1.02) return 'up';
    if (recentAvg < olderAvg * 0.98) return 'down';
    return 'flat';
  }, [sprintMetrics]);

  if (loading) {
    return (
      <DashboardLayout
        title="Agile Flow & Sprint Analytics"
        activeDashboard="agile"
        showFilterBar
        showSidebar
        visibleFilters={['domain', 'team', 'sprint']}
      >
        <div className="flex items-center justify-center py-24">
          <LoadingSpinner message="Loading sprint analytics..." size="lg" />
        </div>
      </DashboardLayout>
    );
  }

  if (error && sprintMetrics.length === 0) {
    return (
      <DashboardLayout
        title="Agile Flow & Sprint Analytics"
        activeDashboard="agile"
        showFilterBar
        showSidebar
        visibleFilters={['domain', 'team', 'sprint']}
      >
        <div className="flex flex-col items-center justify-center py-24">
          <svg
            className="mb-4 h-12 w-12 text-red-400"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
            />
          </svg>
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          <button
            type="button"
            onClick={refresh}
            className="btn-primary mt-4"
          >
            Retry
          </button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Agile Flow & Sprint Analytics"
      description="Sprint velocity, predictability, flow distribution, and carry-over tracking"
      activeDashboard="agile"
      showFilterBar
      showSidebar
      showExport
      visibleFilters={['domain', 'team', 'sprint']}
      exportFilename="agile-flow-dashboard"
    >
      <DrillDownWrapper
        context={{ dashboard: 'agile' }}
        onDrillDown={handleDrillDown}
        showBreadcrumb={false}
        showBackButton={false}
      >
        <div ref={contentRef} className="space-y-6">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {error && (
                <span className="text-xs text-amber-600 dark:text-amber-400">
                  ⚠ {error}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {canImport && (
                <button
                  type="button"
                  onClick={handleOpenImport}
                  className="btn-secondary inline-flex items-center gap-1.5 text-sm"
                >
                  <svg
                    className="h-4 w-4"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"
                    />
                  </svg>
                  Import Data
                </button>
              )}
              <button
                type="button"
                onClick={refresh}
                className="btn-secondary inline-flex items-center gap-1.5 text-sm"
              >
                <svg
                  className="h-4 w-4"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182"
                  />
                </svg>
                Refresh
              </button>
            </div>
          </div>

          {/* KPI Summary Cards */}
          <div id="velocity" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              title="Avg Velocity"
              value={summary.avgVelocity}
              unit="count"
              trend={velocityTrend}
              trendValue={
                velocityTrend === 'up'
                  ? '+improving'
                  : velocityTrend === 'down'
                    ? '-declining'
                    : ''
              }
              sparklineData={velocitySparkline}
              sparklineColor={CHART_COLORS.primary[0]}
              description={`Across ${summary.totalSprints} sprints`}
            />
            <MetricCard
              title="Avg Predictability"
              value={summary.avgPredictability}
              unit="percentage"
              trend={predictabilityTrend}
              trendValue={
                predictabilityTrend === 'up'
                  ? '+improving'
                  : predictabilityTrend === 'down'
                    ? '-declining'
                    : ''
              }
              sparklineData={predictabilitySparkline}
              sparklineColor={CHART_COLORS.primary[1]}
              description="Done / Committed ratio"
            />
            <MetricCard
              title="Total Carry-Over"
              value={summary.totalCarryOver}
              unit="count"
              trend={summary.totalCarryOver > 0 ? 'up' : 'flat'}
              invertTrend
              description="Story points carried forward"
            />
            <MetricCard
              title="Delivery Rate"
              value={
                summary.totalCommitted > 0
                  ? parseFloat(
                      ((summary.totalDeployed / summary.totalCommitted) * 100).toFixed(1)
                    )
                  : 0
              }
              unit="percentage"
              description={`${formatNumber(summary.totalDeployed, { maximumFractionDigits: 0 })} / ${formatNumber(summary.totalCommitted, { maximumFractionDigits: 0 })} pts deployed`}
            />
          </div>

          {/* Sprint Committed / Done / Deployed Column Chart */}
          <div id="sprint">
            <ColumnChart
              data={columnChartData}
              title="Sprint Commitment vs Delivery"
              categoryKey="sprintName"
              series={[
                {
                  dataKey: 'committed',
                  name: 'Committed',
                  color: CHART_COLORS.primary[0],
                },
                {
                  dataKey: 'done',
                  name: 'Done',
                  color: CHART_COLORS.primary[1],
                },
                {
                  dataKey: 'deployed',
                  name: 'Deployed',
                  color: CHART_COLORS.primary[2],
                },
              ]}
              annotations={predictabilityAnnotations}
              valueFormat="number"
              yAxisLabel="Story Points"
              height={380}
              showGrid
              showLegend
              onBarClick={handleColumnBarClick}
              emptyMessage="No sprint data available for the selected filters."
            />
          </div>

          {/* Flow Distribution Bar Chart */}
          <div id="flow">
            <BarChart
              data={flowChartData}
              title="Flow Distribution by Team"
              xKey="team"
              yKeys={['features', 'defects', 'risks', 'debt']}
              labels={['Features', 'Defects', 'Risks', 'Tech Debt']}
              colors={[
                CHART_COLORS.primary[0],
                CHART_COLORS.severity.high,
                CHART_COLORS.severity.medium,
                CHART_COLORS.severity.low,
              ]}
              mode="stacked"
              orientation="vertical"
              height={350}
              showGrid
              showLegend
              showTooltip
              valueSuffix="%"
              yAxisLabel="Percentage"
            />
          </div>

          {/* Sprint Summary Table */}
          <div id="carryover">
            <SprintSummaryTable
              data={sprintMetrics}
              title="Sprint Summary"
              onRowClick={handleSprintRowClick}
              onFieldSave={handleFieldSave}
              showTeam
              showActions
              showFilter
              compact={false}
              emptyMessage="No sprint data available for the selected filters."
            />
          </div>
        </div>
      </DrillDownWrapper>

      {/* CSV Import Modal */}
      <CSVImportModal
        isOpen={isImportModalOpen}
        onClose={handleCloseImport}
        dataType="sprintMetrics"
        onImportComplete={handleImportComplete}
        title="Import Sprint Metrics"
      />
    </DashboardLayout>
  );
}