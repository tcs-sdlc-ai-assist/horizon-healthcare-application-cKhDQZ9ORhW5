import { useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { MetricCard } from '@/components/charts/MetricCard';
import { HeatmapChart } from '@/components/charts/HeatmapChart';
import { GartnerTIMEChart } from '@/components/charts/GartnerTIMEChart';
import { FowlerDebtQuadrant } from '@/components/charts/FowlerDebtQuadrant';
import { TrendChart } from '@/components/charts/TrendChart';
import { TimeSeriesChart } from '@/components/charts/TimeSeriesChart';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { useDashboardData } from '@/hooks/useDashboardData';

/**
 * Computes aggregate DORA metrics from the latest month's data.
 * @param {Array<Object>} doraMetrics - DORA metrics array
 * @returns {{ avgDeployFrequency: number, avgLeadTime: number, avgChangeFailureRate: number, avgMTTR: number, deployFrequencyTrend: string, leadTimeTrend: string, changeFailureTrend: string, mttrTrend: string, deployFrequencySparkline: Array<{value: number}>, leadTimeSparkline: Array<{value: number}>, changeFailureSparkline: Array<{value: number}>, mttrSparkline: Array<{value: number}> }}
 */
function computeDoraAggregates(doraMetrics) {
  const defaults = {
    avgDeployFrequency: 0,
    avgLeadTime: 0,
    avgChangeFailureRate: 0,
    avgMTTR: 0,
    deployFrequencyTrend: 'flat',
    leadTimeTrend: 'flat',
    changeFailureTrend: 'flat',
    mttrTrend: 'flat',
    deployFrequencySparkline: [],
    leadTimeSparkline: [],
    changeFailureSparkline: [],
    mttrSparkline: [],
  };

  if (!Array.isArray(doraMetrics) || doraMetrics.length === 0) {
    return defaults;
  }

  const dates = [...new Set(doraMetrics.map((d) => d.date))].sort();
  if (dates.length === 0) return defaults;

  const latestDate = dates[dates.length - 1];
  const latestEntries = doraMetrics.filter((d) => d.date === latestDate);

  if (latestEntries.length === 0) return defaults;

  const avg = (arr, key) => {
    const vals = arr.map((d) => Number(d[key])).filter((v) => !isNaN(v));
    if (vals.length === 0) return 0;
    return parseFloat((vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(1));
  };

  const avgDeployFrequency = avg(latestEntries, 'deployFrequency');
  const avgLeadTime = avg(latestEntries, 'leadTimeHours');
  const avgChangeFailureRate = avg(latestEntries, 'changeFailureRate');
  const avgMTTR = avg(latestEntries, 'mttrHours');

  const monthlyAggregates = dates.map((date) => {
    const entries = doraMetrics.filter((d) => d.date === date);
    return {
      date,
      deployFrequency: avg(entries, 'deployFrequency'),
      leadTime: avg(entries, 'leadTimeHours'),
      changeFailureRate: avg(entries, 'changeFailureRate'),
      mttr: avg(entries, 'mttrHours'),
    };
  });

  const deployFrequencySparkline = monthlyAggregates.map((m) => ({ value: m.deployFrequency }));
  const leadTimeSparkline = monthlyAggregates.map((m) => ({ value: m.leadTime }));
  const changeFailureSparkline = monthlyAggregates.map((m) => ({ value: m.changeFailureRate }));
  const mttrSparkline = monthlyAggregates.map((m) => ({ value: m.mttr }));

  const computeTrend = (sparkline) => {
    if (sparkline.length < 2) return 'flat';
    const last = sparkline[sparkline.length - 1].value;
    const prev = sparkline[sparkline.length - 2].value;
    const diff = last - prev;
    if (Math.abs(diff) < 0.5) return 'flat';
    return diff > 0 ? 'up' : 'down';
  };

  return {
    avgDeployFrequency,
    avgLeadTime,
    avgChangeFailureRate,
    avgMTTR,
    deployFrequencyTrend: computeTrend(deployFrequencySparkline),
    leadTimeTrend: computeTrend(leadTimeSparkline),
    changeFailureTrend: computeTrend(changeFailureSparkline),
    mttrTrend: computeTrend(mttrSparkline),
    deployFrequencySparkline,
    leadTimeSparkline,
    changeFailureSparkline,
    mttrSparkline,
  };
}

/**
 * Computes aggregate reliability metrics from the latest month's data.
 * @param {Array<Object>} reliabilityMetrics - Reliability metrics array
 * @returns {{ avgAvailability: number, avgErrorRate: number, totalIncidents: number, totalSLABreaches: number, availabilityTrend: string, errorRateTrend: string }}
 */
function computeReliabilityAggregates(reliabilityMetrics) {
  const defaults = {
    avgAvailability: 0,
    avgErrorRate: 0,
    totalIncidents: 0,
    totalSLABreaches: 0,
    availabilityTrend: 'flat',
    errorRateTrend: 'flat',
  };

  if (!Array.isArray(reliabilityMetrics) || reliabilityMetrics.length === 0) {
    return defaults;
  }

  const dates = [...new Set(reliabilityMetrics.map((d) => d.date))].sort();
  if (dates.length === 0) return defaults;

  const latestDate = dates[dates.length - 1];
  const latestEntries = reliabilityMetrics.filter((d) => d.date === latestDate);

  if (latestEntries.length === 0) return defaults;

  const avg = (arr, key) => {
    const vals = arr.map((d) => Number(d[key])).filter((v) => !isNaN(v));
    if (vals.length === 0) return 0;
    return parseFloat((vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(2));
  };

  const sum = (arr, key) => {
    return arr.reduce((s, d) => s + (Number(d[key]) || 0), 0);
  };

  const avgAvailability = avg(latestEntries, 'availability');
  const avgErrorRate = avg(latestEntries, 'errorRate');
  const totalIncidents = sum(latestEntries, 'incidentCount');
  const totalSLABreaches = sum(latestEntries, 'slaBreaches');

  let availabilityTrend = 'flat';
  let errorRateTrend = 'flat';

  if (dates.length >= 2) {
    const prevDate = dates[dates.length - 2];
    const prevEntries = reliabilityMetrics.filter((d) => d.date === prevDate);
    const prevAvailability = avg(prevEntries, 'availability');
    const prevErrorRate = avg(prevEntries, 'errorRate');

    const availDiff = avgAvailability - prevAvailability;
    availabilityTrend = Math.abs(availDiff) < 0.05 ? 'flat' : availDiff > 0 ? 'up' : 'down';

    const errorDiff = avgErrorRate - prevErrorRate;
    errorRateTrend = Math.abs(errorDiff) < 0.05 ? 'flat' : errorDiff > 0 ? 'up' : 'down';
  }

  return {
    avgAvailability,
    avgErrorRate,
    totalIncidents,
    totalSLABreaches,
    availabilityTrend,
    errorRateTrend,
  };
}

/**
 * Computes aggregate compliance metrics from the latest month's data.
 * @param {Array<Object>} complianceData - Security compliance snapshots array
 * @returns {{ avgComplianceScore: number, hipaaCount: number, soc2Count: number, pciCount: number, totalCriticalVulns: number, totalHighVulns: number, complianceTrend: string, complianceSparkline: Array<{value: number}> }}
 */
function computeComplianceAggregates(complianceData) {
  const defaults = {
    avgComplianceScore: 0,
    hipaaCount: 0,
    soc2Count: 0,
    pciCount: 0,
    totalCriticalVulns: 0,
    totalHighVulns: 0,
    complianceTrend: 'flat',
    complianceSparkline: [],
  };

  if (!Array.isArray(complianceData) || complianceData.length === 0) {
    return defaults;
  }

  const dates = [...new Set(complianceData.map((d) => d.date))].sort();
  if (dates.length === 0) return defaults;

  const latestDate = dates[dates.length - 1];
  const latestEntries = complianceData.filter((d) => d.date === latestDate);

  if (latestEntries.length === 0) return defaults;

  const avg = (arr, key) => {
    const vals = arr.map((d) => Number(d[key])).filter((v) => !isNaN(v));
    if (vals.length === 0) return 0;
    return parseFloat((vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(1));
  };

  const avgComplianceScore = avg(latestEntries, 'complianceScore');
  const hipaaCount = latestEntries.filter((d) => d.hipaaCompliant).length;
  const soc2Count = latestEntries.filter((d) => d.soc2Compliant).length;
  const pciCount = latestEntries.filter((d) => d.pciCompliant).length;
  const totalCriticalVulns = latestEntries.reduce((s, d) => s + (Number(d.openCriticalVulns) || 0), 0);
  const totalHighVulns = latestEntries.reduce((s, d) => s + (Number(d.openHighVulns) || 0), 0);

  const monthlyAggregates = dates.map((date) => {
    const entries = complianceData.filter((d) => d.date === date);
    return {
      date,
      complianceScore: avg(entries, 'complianceScore'),
    };
  });

  const complianceSparkline = monthlyAggregates.map((m) => ({ value: m.complianceScore }));

  let complianceTrend = 'flat';
  if (complianceSparkline.length >= 2) {
    const last = complianceSparkline[complianceSparkline.length - 1].value;
    const prev = complianceSparkline[complianceSparkline.length - 2].value;
    const diff = last - prev;
    complianceTrend = Math.abs(diff) < 0.5 ? 'flat' : diff > 0 ? 'up' : 'down';
  }

  return {
    avgComplianceScore,
    hipaaCount,
    soc2Count,
    pciCount,
    totalCriticalVulns,
    totalHighVulns,
    complianceTrend,
    complianceSparkline,
  };
}

/**
 * Builds tech debt trend data for the TrendChart (accumulation vs remediation).
 * @param {Array<Object>} techDebtMetrics - Tech debt metrics array
 * @returns {Array<{ date: string, accumulation: number, remediation: number }>}
 */
function buildTechDebtTrendData(techDebtMetrics) {
  if (!Array.isArray(techDebtMetrics) || techDebtMetrics.length === 0) {
    return [];
  }

  const dates = [...new Set(techDebtMetrics.map((d) => d.date))].sort();

  return dates.map((date) => {
    const entries = techDebtMetrics.filter((d) => d.date === date);
    const totalDebt = entries.reduce((s, d) => s + (Number(d.debtIndex) || 0), 0);
    const totalSmells = entries.reduce((s, d) => s + (Number(d.codeSmells) || 0), 0);
    const totalRemediation = entries.reduce((s, d) => {
      const remediationEstimate = (Number(d.estimatedRemediationDays) || 0);
      return s + remediationEstimate;
    }, 0);

    return {
      date,
      accumulation: Math.round(totalSmells / Math.max(entries.length, 1)),
      remediation: Math.round(totalRemediation / Math.max(entries.length, 1)),
    };
  });
}

/**
 * Builds Gartner TIME classification data from applications and tech debt.
 * @param {Array<Object>} apps - Applications array
 * @param {Array<Object>} techDebtMetrics - Tech debt metrics array
 * @param {Array<Object>} reliabilityMetrics - Reliability metrics array
 * @returns {Array<Object>}
 */
function buildGartnerTIMEData(apps, techDebtMetrics, reliabilityMetrics) {
  if (!Array.isArray(apps) || apps.length === 0) {
    return [];
  }

  const latestDebtByApp = {};
  if (Array.isArray(techDebtMetrics)) {
    techDebtMetrics.forEach((entry) => {
      const key = entry.applicationId;
      if (!latestDebtByApp[key] || entry.date > latestDebtByApp[key].date) {
        latestDebtByApp[key] = entry;
      }
    });
  }

  const latestReliabilityByApp = {};
  if (Array.isArray(reliabilityMetrics)) {
    reliabilityMetrics.forEach((entry) => {
      const key = entry.applicationId;
      if (!latestReliabilityByApp[key] || entry.date > latestReliabilityByApp[key].date) {
        latestReliabilityByApp[key] = entry;
      }
    });
  }

  return apps.map((app) => {
    const debt = latestDebtByApp[app.id];
    const reliability = latestReliabilityByApp[app.id];

    const technicalQuality = debt
      ? Math.max(0, Math.min(100, 100 - (debt.debtIndex || 50)))
      : 50;

    const businessValue = reliability
      ? Math.max(0, Math.min(100, reliability.availability || 50))
      : 50;

    return {
      id: app.id,
      name: app.name,
      domain: app.domain,
      team: app.team,
      tier: app.tier,
      techStack: app.techStack,
      businessValue,
      technicalQuality,
    };
  });
}

/**
 * Builds Fowler Debt Quadrant data from applications and tech debt.
 * @param {Array<Object>} apps - Applications array
 * @param {Array<Object>} techDebtMetrics - Tech debt metrics array
 * @returns {Array<Object>}
 */
function buildFowlerDebtData(apps, techDebtMetrics) {
  if (!Array.isArray(apps) || apps.length === 0) {
    return [];
  }

  const latestDebtByApp = {};
  if (Array.isArray(techDebtMetrics)) {
    techDebtMetrics.forEach((entry) => {
      const key = entry.applicationId;
      if (!latestDebtByApp[key] || entry.date > latestDebtByApp[key].date) {
        latestDebtByApp[key] = entry;
      }
    });
  }

  return apps.map((app) => {
    const debt = latestDebtByApp[app.id];

    const deliberateScore = debt
      ? Math.max(0, Math.min(100, 100 - (debt.duplications || 10) * 3))
      : 50;

    const recklessScore = debt
      ? Math.max(0, Math.min(100, (debt.debtIndex || 50)))
      : 50;

    return {
      name: app.name,
      applicationId: app.id,
      domain: app.domain,
      deliberateScore,
      recklessScore,
      debtIndex: debt ? debt.debtIndex : null,
      estimatedRemediationDays: debt ? debt.estimatedRemediationDays : null,
      codeSmells: debt ? debt.codeSmells : null,
      duplications: debt ? debt.duplications : null,
    };
  });
}

/**
 * Builds the latest tech debt entries for the heatmap.
 * @param {Array<Object>} techDebtMetrics - Tech debt metrics array
 * @returns {Array<Object>}
 */
function buildHeatmapData(techDebtMetrics) {
  if (!Array.isArray(techDebtMetrics) || techDebtMetrics.length === 0) {
    return [];
  }

  const latestByApp = {};
  techDebtMetrics.forEach((entry) => {
    const key = entry.applicationId;
    if (!latestByApp[key] || entry.date > latestByApp[key].date) {
      latestByApp[key] = entry;
    }
  });

  return Object.values(latestByApp);
}

/**
 * AppDevDashboard — Main Application Development Dashboard page component.
 *
 * Composes MetricCard grid (Frequency, Lead Time, Change Failure, Reliability),
 * HeatmapChart (Tech Debt Index), GartnerTIMEChart, FowlerDebtQuadrant,
 * TrendChart (debt accumulation vs remediation), and security/compliance MetricCards.
 * Includes linkage indicators to incidents, release velocity, and compliance risk.
 * Uses useDashboardData hook. Wrapped in DashboardLayout.
 *
 * @returns {JSX.Element}
 */
export default function AppDevDashboard() {
  const { data, loading, error, refresh } = useDashboardData('appdev');
  const navigate = useNavigate();

  const applications = data.applications || [];
  const doraMetrics = data.doraMetrics || [];
  const reliabilityMetrics = data.reliabilityMetrics || [];
  const techDebtMetrics = data.techDebtMetrics || [];
  const securityCompliance = data.securityComplianceSnapshots || [];

  const doraAggregates = useMemo(() => computeDoraAggregates(doraMetrics), [doraMetrics]);
  const reliabilityAggregates = useMemo(() => computeReliabilityAggregates(reliabilityMetrics), [reliabilityMetrics]);
  const complianceAggregates = useMemo(() => computeComplianceAggregates(securityCompliance), [securityCompliance]);
  const techDebtTrendData = useMemo(() => buildTechDebtTrendData(techDebtMetrics), [techDebtMetrics]);
  const gartnerData = useMemo(() => buildGartnerTIMEData(applications, techDebtMetrics, reliabilityMetrics), [applications, techDebtMetrics, reliabilityMetrics]);
  const fowlerData = useMemo(() => buildFowlerDebtData(applications, techDebtMetrics), [applications, techDebtMetrics]);
  const heatmapData = useMemo(() => buildHeatmapData(techDebtMetrics), [techDebtMetrics]);

  const handleHeatmapCellClick = useCallback(
    (entry) => {
      if (entry && entry.applicationId) {
        navigate(`/dashboards/appdev/techdebt?applicationId=${encodeURIComponent(entry.applicationId)}`);
      }
    },
    [navigate]
  );

  const handleGartnerAppClick = useCallback(
    (app) => {
      if (app && app.id) {
        navigate(`/dashboards/appdev/reliability?applicationId=${encodeURIComponent(app.id)}`);
      }
    },
    [navigate]
  );

  const handleFowlerDrillDown = useCallback(
    (pointData) => {
      if (pointData && pointData.applicationId) {
        navigate(`/dashboards/appdev/techdebt?applicationId=${encodeURIComponent(pointData.applicationId)}`);
      }
    },
    [navigate]
  );

  if (loading) {
    return (
      <DashboardLayout
        title="Application Development"
        description="DORA metrics, reliability, tech debt, and compliance insights"
        activeDashboard="appdev"
        showFilterBar
        showExport
        exportFilename="appdev-dashboard"
        visibleFilters={['domain', 'application', 'team', 'environment']}
      >
        <div className="flex items-center justify-center py-24">
          <LoadingSpinner message="Loading Application Development dashboard..." size="lg" />
        </div>
      </DashboardLayout>
    );
  }

  if (error && applications.length === 0) {
    return (
      <DashboardLayout
        title="Application Development"
        description="DORA metrics, reliability, tech debt, and compliance insights"
        activeDashboard="appdev"
        showFilterBar
        showExport
        exportFilename="appdev-dashboard"
        visibleFilters={['domain', 'application', 'team', 'environment']}
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
          <p className="mb-2 text-lg font-semibold text-slate-700 dark:text-slate-300">
            Failed to load dashboard data
          </p>
          <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">{error}</p>
          <button
            type="button"
            onClick={refresh}
            className="btn-primary"
          >
            Retry
          </button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Application Development"
      description="DORA metrics, reliability, tech debt, and compliance insights"
      activeDashboard="appdev"
      showFilterBar
      showExport
      exportFilename="appdev-dashboard"
      visibleFilters={['domain', 'application', 'team', 'environment']}
    >
      <div className="space-y-6">
        {/* Error banner (partial data) */}
        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-900/20">
            <svg
              className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            <p className="text-sm text-amber-700 dark:text-amber-300">{error}</p>
          </div>
        )}

        {/* Section: DORA Metrics */}
        <section>
          <h2 className="mb-4 text-lg font-semibold text-slate-800 dark:text-slate-100">
            DORA Metrics
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              title="Deploy Frequency"
              value={doraAggregates.avgDeployFrequency}
              unit="count"
              trend={doraAggregates.deployFrequencyTrend}
              trendValue={doraAggregates.deployFrequencyTrend === 'up' ? '↑' : doraAggregates.deployFrequencyTrend === 'down' ? '↓' : '—'}
              sparklineData={doraAggregates.deployFrequencySparkline}
              sparklineColor="#3B82F6"
              description="Avg deploys per month across applications"
              onClick={() => navigate('/dashboards/appdev/dora')}
            />
            <MetricCard
              title="Lead Time"
              value={doraAggregates.avgLeadTime}
              unit="hours"
              trend={doraAggregates.leadTimeTrend}
              invertTrend
              trendValue={doraAggregates.leadTimeTrend === 'up' ? '↑' : doraAggregates.leadTimeTrend === 'down' ? '↓' : '—'}
              sparklineData={doraAggregates.leadTimeSparkline}
              sparklineColor="#F59E0B"
              description="Avg hours from commit to production"
              onClick={() => navigate('/dashboards/appdev/dora')}
            />
            <MetricCard
              title="Change Failure Rate"
              value={doraAggregates.avgChangeFailureRate}
              unit="percentage"
              trend={doraAggregates.changeFailureTrend}
              invertTrend
              trendValue={doraAggregates.changeFailureTrend === 'up' ? '↑' : doraAggregates.changeFailureTrend === 'down' ? '↓' : '—'}
              sparklineData={doraAggregates.changeFailureSparkline}
              sparklineColor="#EF4444"
              description="Percentage of deployments causing failures"
              onClick={() => navigate('/dashboards/appdev/dora')}
            />
            <MetricCard
              title="MTTR"
              value={doraAggregates.avgMTTR}
              unit="hours"
              trend={doraAggregates.mttrTrend}
              invertTrend
              trendValue={doraAggregates.mttrTrend === 'up' ? '↑' : doraAggregates.mttrTrend === 'down' ? '↓' : '—'}
              sparklineData={doraAggregates.mttrSparkline}
              sparklineColor="#8B5CF6"
              description="Mean time to recovery in hours"
              onClick={() => navigate('/dashboards/appdev/dora')}
            />
          </div>
        </section>

        {/* Section: Reliability & Incidents */}
        <section>
          <h2 className="mb-4 text-lg font-semibold text-slate-800 dark:text-slate-100">
            Reliability & Incidents
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              title="Avg Availability"
              value={reliabilityAggregates.avgAvailability}
              unit="percentage"
              trend={reliabilityAggregates.availabilityTrend}
              description="Average SLA availability across apps"
              onClick={() => navigate('/dashboards/appdev/reliability')}
            />
            <MetricCard
              title="Avg Error Rate"
              value={reliabilityAggregates.avgErrorRate}
              unit="percentage"
              trend={reliabilityAggregates.errorRateTrend}
              invertTrend
              description="Average error rate across applications"
              onClick={() => navigate('/dashboards/appdev/reliability')}
            />
            <MetricCard
              title="Active Incidents"
              value={reliabilityAggregates.totalIncidents}
              unit="count"
              description="Total incidents in the latest period"
              onClick={() => navigate('/dashboards/appdev/reliability')}
            />
            <MetricCard
              title="SLA Breaches"
              value={reliabilityAggregates.totalSLABreaches}
              unit="count"
              trend={reliabilityAggregates.totalSLABreaches > 0 ? 'up' : 'flat'}
              invertTrend
              description="Total SLA breaches in the latest period"
              onClick={() => navigate('/dashboards/appdev/reliability')}
            />
          </div>
        </section>

        {/* Section: Security & Compliance */}
        <section>
          <h2 className="mb-4 text-lg font-semibold text-slate-800 dark:text-slate-100">
            Security & Compliance
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
            <MetricCard
              title="Compliance Score"
              value={complianceAggregates.avgComplianceScore}
              unit="percentage"
              trend={complianceAggregates.complianceTrend}
              sparklineData={complianceAggregates.complianceSparkline}
              sparklineColor="#10B981"
              description="Average compliance score"
              onClick={() => navigate('/dashboards/appdev/compliance')}
            />
            <MetricCard
              title="HIPAA Compliant"
              value={complianceAggregates.hipaaCount}
              unit="count"
              description={`${complianceAggregates.hipaaCount} of ${applications.length} apps`}
              onClick={() => navigate('/dashboards/appdev/compliance')}
            />
            <MetricCard
              title="SOC 2 Compliant"
              value={complianceAggregates.soc2Count}
              unit="count"
              description={`${complianceAggregates.soc2Count} of ${applications.length} apps`}
              onClick={() => navigate('/dashboards/appdev/compliance')}
            />
            <MetricCard
              title="PCI Compliant"
              value={complianceAggregates.pciCount}
              unit="count"
              description={`${complianceAggregates.pciCount} of ${applications.length} apps`}
              onClick={() => navigate('/dashboards/appdev/compliance')}
            />
            <MetricCard
              title="Critical Vulns"
              value={complianceAggregates.totalCriticalVulns}
              unit="count"
              trend={complianceAggregates.totalCriticalVulns > 0 ? 'up' : 'flat'}
              invertTrend
              description="Open critical vulnerabilities"
              onClick={() => navigate('/dashboards/appdev/compliance')}
            />
            <MetricCard
              title="High Vulns"
              value={complianceAggregates.totalHighVulns}
              unit="count"
              trend={complianceAggregates.totalHighVulns > 5 ? 'up' : 'flat'}
              invertTrend
              description="Open high-severity vulnerabilities"
              onClick={() => navigate('/dashboards/appdev/compliance')}
            />
          </div>
        </section>

        {/* Section: Tech Debt Heatmap */}
        <section>
          <HeatmapChart
            data={heatmapData}
            title="Tech Debt Index by Domain & Application"
            onCellClick={handleHeatmapCellClick}
            showLegend
            showValues
          />
        </section>

        {/* Section: Tech Debt Trend */}
        <section>
          <TrendChart
            title="Tech Debt: Accumulation vs Remediation"
            data={techDebtTrendData}
            accumulationLabel="Avg Code Smells"
            remediationLabel="Avg Remediation Days"
            accumulationColor="#EF4444"
            remediationColor="#10B981"
            timeRange="Last 12 Months"
            height={320}
            showTrendIndicators
          />
        </section>

        {/* Section: Gartner TIME & Fowler Debt Quadrant */}
        <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <GartnerTIMEChart
            applications={gartnerData}
            title="Gartner TIME Classification"
            onApplicationClick={handleGartnerAppClick}
            showLegend
            showDrillDown
          />
          <FowlerDebtQuadrant
            data={fowlerData}
            title="Fowler's Technical Debt Quadrant"
            onDrillDown={handleFowlerDrillDown}
            height={400}
            showLegend
          />
        </section>

        {/* Section: Linkage Indicators */}
        <section>
          <h2 className="mb-4 text-lg font-semibold text-slate-800 dark:text-slate-100">
            Linkage Indicators
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="card flex items-start gap-4">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <svg
                  className="h-5 w-5 text-blue-600 dark:text-blue-400"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0"
                  />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  Incident Correlation
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {reliabilityAggregates.totalIncidents} active incidents linked to{' '}
                  {reliabilityAggregates.totalSLABreaches} SLA breaches. Applications with high
                  change failure rates ({doraAggregates.avgChangeFailureRate.toFixed(1)}%) correlate
                  with elevated incident counts.
                </p>
              </div>
            </div>

            <div className="card flex items-start gap-4">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30">
                <svg
                  className="h-5 w-5 text-green-600 dark:text-green-400"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941"
                  />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  Release Velocity
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Average deploy frequency of {doraAggregates.avgDeployFrequency} deploys/month with{' '}
                  {doraAggregates.avgLeadTime.toFixed(1)}h lead time. Teams with lower tech debt
                  indices show 2-3x higher deployment frequency.
                </p>
              </div>
            </div>

            <div className="card flex items-start gap-4">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30">
                <svg
                  className="h-5 w-5 text-amber-600 dark:text-amber-400"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z"
                  />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  Compliance Risk
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {complianceAggregates.totalCriticalVulns} critical and{' '}
                  {complianceAggregates.totalHighVulns} high vulnerabilities open.{' '}
                  {complianceAggregates.hipaaCount}/{applications.length} apps HIPAA compliant,{' '}
                  {complianceAggregates.soc2Count}/{applications.length} SOC 2 compliant.
                  Average compliance score: {complianceAggregates.avgComplianceScore.toFixed(1)}%.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}