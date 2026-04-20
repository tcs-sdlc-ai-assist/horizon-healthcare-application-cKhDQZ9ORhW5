import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { TimeSeriesChart } from '@/components/charts/TimeSeriesChart';
import { BarChart } from '@/components/charts/BarChart';
import { ColumnChart } from '@/components/charts/ColumnChart';
import { StatusMatrix } from '@/components/charts/StatusMatrix';
import { MetricCard } from '@/components/charts/MetricCard';
import { CSVImportModal } from '@/components/common/CSVImportModal';
import { AuditLogPanel } from '@/components/common/AuditLogPanel';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { useDashboardData } from '@/hooks/useDashboardData';
import { useRoleGuard } from '@/hooks/useRoleGuard';
import { DATA_TYPES } from '@/services/dataService';

/**
 * Computes summary KPI metrics from the DevSecOps dashboard data.
 * @param {Object} data - The dashboard data keyed by data type
 * @returns {{ avgReadiness: number|null, avgCoverage: number|null, totalVulnerabilities: number, pipelineSuccessRate: number|null, avgBuildTime: number|null, complianceScore: number|null }}
 */
function computeSummaryMetrics(data) {
  const readiness = data[DATA_TYPES.DEV_READINESS] || [];
  const coverage = data[DATA_TYPES.UNIT_TEST_COVERAGE] || [];
  const scans = data[DATA_TYPES.SECURITY_SCANS] || [];
  const pipelines = data[DATA_TYPES.DEPLOYMENT_PIPELINES] || [];
  const compliance = data[DATA_TYPES.SECURITY_COMPLIANCE] || [];

  // Average readiness score from latest entries per application
  let avgReadiness = null;
  if (readiness.length > 0) {
    const latestByApp = {};
    readiness.forEach((entry) => {
      if (!latestByApp[entry.applicationId] || entry.date > latestByApp[entry.applicationId].date) {
        latestByApp[entry.applicationId] = entry;
      }
    });
    const latestEntries = Object.values(latestByApp);
    if (latestEntries.length > 0) {
      const sum = latestEntries.reduce((acc, e) => acc + (e.readinessScore || 0), 0);
      avgReadiness = parseFloat((sum / latestEntries.length).toFixed(1));
    }
  }

  // Average line coverage from latest entries per application
  let avgCoverage = null;
  if (coverage.length > 0) {
    const latestByApp = {};
    coverage.forEach((entry) => {
      if (!latestByApp[entry.applicationId] || entry.date > latestByApp[entry.applicationId].date) {
        latestByApp[entry.applicationId] = entry;
      }
    });
    const latestEntries = Object.values(latestByApp);
    if (latestEntries.length > 0) {
      const sum = latestEntries.reduce((acc, e) => acc + (e.lineCoverage || 0), 0);
      avgCoverage = parseFloat((sum / latestEntries.length).toFixed(1));
    }
  }

  // Total open vulnerabilities from latest scans
  let totalVulnerabilities = 0;
  if (scans.length > 0) {
    const latestByAppScan = {};
    scans.forEach((entry) => {
      const key = `${entry.applicationId}-${entry.scanType}`;
      if (!latestByAppScan[key] || entry.date > latestByAppScan[key].date) {
        latestByAppScan[key] = entry;
      }
    });
    Object.values(latestByAppScan).forEach((entry) => {
      totalVulnerabilities += (entry.critical || 0) + (entry.high || 0);
    });
  }

  // Pipeline success rate
  let pipelineSuccessRate = null;
  if (pipelines.length > 0) {
    const total = pipelines.length;
    const successful = pipelines.filter((p) => p.status === 'Success').length;
    pipelineSuccessRate = parseFloat(((successful / total) * 100).toFixed(1));
  }

  // Average build time from latest readiness entries
  let avgBuildTime = null;
  if (readiness.length > 0) {
    const latestByApp = {};
    readiness.forEach((entry) => {
      if (!latestByApp[entry.applicationId] || entry.date > latestByApp[entry.applicationId].date) {
        latestByApp[entry.applicationId] = entry;
      }
    });
    const latestEntries = Object.values(latestByApp);
    if (latestEntries.length > 0) {
      const sum = latestEntries.reduce((acc, e) => acc + (e.avgBuildTimeMinutes || 0), 0);
      avgBuildTime = parseFloat((sum / latestEntries.length).toFixed(1));
    }
  }

  // Average compliance score
  let complianceScore = null;
  if (compliance.length > 0) {
    const latestByApp = {};
    compliance.forEach((entry) => {
      if (!latestByApp[entry.applicationId] || entry.date > latestByApp[entry.applicationId].date) {
        latestByApp[entry.applicationId] = entry;
      }
    });
    const latestEntries = Object.values(latestByApp);
    if (latestEntries.length > 0) {
      const sum = latestEntries.reduce((acc, e) => acc + (e.complianceScore || 0), 0);
      complianceScore = parseFloat((sum / latestEntries.length).toFixed(1));
    }
  }

  return {
    avgReadiness,
    avgCoverage,
    totalVulnerabilities,
    pipelineSuccessRate,
    avgBuildTime,
    complianceScore,
  };
}

/**
 * Aggregates development readiness time series data by date for the TimeSeriesChart.
 * Averages readinessScore and buildSuccessRate across all applications per date.
 * @param {Array<Object>} readinessData - Raw dev readiness time series entries
 * @returns {Array<{ date: string, readinessScore: number, buildSuccessRate: number }>}
 */
function aggregateReadinessByDate(readinessData) {
  if (!Array.isArray(readinessData) || readinessData.length === 0) {
    return [];
  }

  const byDate = {};
  readinessData.forEach((entry) => {
    if (!byDate[entry.date]) {
      byDate[entry.date] = { readinessSum: 0, buildSuccessSum: 0, count: 0 };
    }
    byDate[entry.date].readinessSum += entry.readinessScore || 0;
    byDate[entry.date].buildSuccessSum += entry.buildSuccessRate || 0;
    byDate[entry.date].count += 1;
  });

  return Object.entries(byDate)
    .map(([date, agg]) => ({
      date,
      readinessScore: parseFloat((agg.readinessSum / agg.count).toFixed(1)),
      buildSuccessRate: parseFloat((agg.buildSuccessSum / agg.count).toFixed(1)),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Aggregates unit test coverage data by application for the BarChart.
 * Uses the latest entry per application.
 * @param {Array<Object>} coverageData - Raw unit test coverage entries
 * @returns {Array<{ application: string, lineCoverage: number, branchCoverage: number, functionCoverage: number }>}
 */
function aggregateCoverageByApp(coverageData) {
  if (!Array.isArray(coverageData) || coverageData.length === 0) {
    return [];
  }

  const latestByApp = {};
  coverageData.forEach((entry) => {
    if (!latestByApp[entry.applicationId] || entry.date > latestByApp[entry.applicationId].date) {
      latestByApp[entry.applicationId] = entry;
    }
  });

  return Object.values(latestByApp)
    .map((entry) => ({
      application: entry.applicationName,
      lineCoverage: entry.lineCoverage || 0,
      branchCoverage: entry.branchCoverage || 0,
      functionCoverage: entry.functionCoverage || 0,
    }))
    .sort((a, b) => a.application.localeCompare(b.application))
    .slice(0, 15);
}

/**
 * Aggregates security scan results by application for the BarChart.
 * Uses the latest SAST and DAST entries per application.
 * @param {Array<Object>} scanData - Raw security scan result entries
 * @returns {Array<{ application: string, critical: number, high: number, medium: number, low: number }>}
 */
function aggregateScansByApp(scanData) {
  if (!Array.isArray(scanData) || scanData.length === 0) {
    return [];
  }

  const latestByApp = {};
  scanData.forEach((entry) => {
    const key = entry.applicationId;
    if (!latestByApp[key] || entry.date > latestByApp[key].date) {
      latestByApp[key] = entry;
    }
  });

  return Object.values(latestByApp)
    .map((entry) => ({
      application: entry.applicationName,
      critical: entry.critical || 0,
      high: entry.high || 0,
      medium: entry.medium || 0,
      low: entry.low || 0,
    }))
    .sort((a, b) => (b.critical + b.high) - (a.critical + a.high))
    .slice(0, 15);
}

/**
 * Aggregates deployment pipeline data by stage for the ColumnChart.
 * Counts success and failure per pipeline stage.
 * @param {Array<Object>} pipelineData - Raw deployment pipeline entries
 * @returns {Array<{ stage: string, success: number, failed: number }>}
 */
function aggregatePipelineByStage(pipelineData) {
  if (!Array.isArray(pipelineData) || pipelineData.length === 0) {
    return [];
  }

  const byStage = {};
  pipelineData.forEach((entry) => {
    if (!byStage[entry.stage]) {
      byStage[entry.stage] = { success: 0, failed: 0 };
    }
    if (entry.status === 'Success') {
      byStage[entry.stage].success += 1;
    } else if (entry.status === 'Failed') {
      byStage[entry.stage].failed += 1;
    }
  });

  const stageOrder = ['Source', 'Build', 'Unit Test', 'SAST', 'DAST', 'Integration Test', 'Deploy', 'Smoke Test'];

  return stageOrder
    .filter((stage) => byStage[stage])
    .map((stage) => ({
      stage,
      success: byStage[stage].success,
      failed: byStage[stage].failed,
    }));
}

/**
 * Builds the status matrix data from application status entries.
 * Maps each application to its pipeline stage statuses.
 * @param {Array<Object>} statusData - Raw application status matrix entries
 * @param {Array<Object>} scanData - Raw security scan result entries
 * @param {Array<Object>} pipelineData - Raw deployment pipeline entries
 * @param {Array<Object>} coverageData - Raw unit test coverage entries
 * @returns {Array<Object>} Status matrix rows for the StatusMatrix component
 */
function buildStatusMatrixData(statusData, scanData, pipelineData, coverageData) {
  if (!Array.isArray(statusData) || statusData.length === 0) {
    return [];
  }

  // Get unique applications from status data
  const appMap = {};
  statusData.forEach((entry) => {
    if (!appMap[entry.applicationId]) {
      appMap[entry.applicationId] = {
        applicationId: entry.applicationId,
        applicationName: entry.applicationName,
        domain: entry.domain,
        unitTesting: 'pending',
        sonarQubeSCA: 'pending',
        nexusScans: 'pending',
        ocpDeployment: 'pending',
        sastScan: 'pending',
        dastScan: 'pending',
        automationTestExecution: 'pending',
      };
    }
  });

  // Determine unit testing status from coverage data
  if (Array.isArray(coverageData)) {
    const latestCoverage = {};
    coverageData.forEach((entry) => {
      if (!latestCoverage[entry.applicationId] || entry.date > latestCoverage[entry.applicationId].date) {
        latestCoverage[entry.applicationId] = entry;
      }
    });
    Object.entries(latestCoverage).forEach(([appId, entry]) => {
      if (appMap[appId]) {
        const passRate = entry.totalTests > 0
          ? (entry.passingTests / entry.totalTests) * 100
          : 0;
        appMap[appId].unitTesting = passRate >= 95 ? 'success' : passRate >= 80 ? 'warning' : 'failure';
      }
    });
  }

  // Determine SAST/DAST status from scan data
  if (Array.isArray(scanData)) {
    const latestScans = {};
    scanData.forEach((entry) => {
      const key = `${entry.applicationId}-${entry.scanType}`;
      if (!latestScans[key] || entry.date > latestScans[key].date) {
        latestScans[key] = entry;
      }
    });
    Object.values(latestScans).forEach((entry) => {
      if (appMap[entry.applicationId]) {
        const status = entry.passed ? 'success' : entry.critical > 0 ? 'failure' : 'warning';
        if (entry.scanType === 'SAST') {
          appMap[entry.applicationId].sastScan = status;
        } else if (entry.scanType === 'DAST') {
          appMap[entry.applicationId].dastScan = status;
        }
      }
    });
  }

  // Determine deployment status from pipeline data
  if (Array.isArray(pipelineData)) {
    const latestDeploy = {};
    pipelineData.forEach((entry) => {
      if (entry.stage === 'Deploy') {
        if (!latestDeploy[entry.applicationId] || entry.date > latestDeploy[entry.applicationId].date) {
          latestDeploy[entry.applicationId] = entry;
        }
      }
    });
    Object.entries(latestDeploy).forEach(([appId, entry]) => {
      if (appMap[appId]) {
        appMap[appId].ocpDeployment = entry.status === 'Success' ? 'success' : entry.status === 'Failed' ? 'failure' : 'pending';
      }
    });

    // SonarQube SCA and Nexus Scans from pipeline stages
    const latestSonar = {};
    const latestNexus = {};
    const latestAutoTest = {};
    pipelineData.forEach((entry) => {
      if (entry.stage === 'Unit Test') {
        if (!latestSonar[entry.applicationId] || entry.date > latestSonar[entry.applicationId].date) {
          latestSonar[entry.applicationId] = entry;
        }
      }
      if (entry.stage === 'Integration Test') {
        if (!latestNexus[entry.applicationId] || entry.date > latestNexus[entry.applicationId].date) {
          latestNexus[entry.applicationId] = entry;
        }
      }
      if (entry.stage === 'Smoke Test') {
        if (!latestAutoTest[entry.applicationId] || entry.date > latestAutoTest[entry.applicationId].date) {
          latestAutoTest[entry.applicationId] = entry;
        }
      }
    });

    Object.entries(latestSonar).forEach(([appId, entry]) => {
      if (appMap[appId]) {
        appMap[appId].sonarQubeSCA = entry.status === 'Success' ? 'success' : entry.status === 'Failed' ? 'failure' : 'pending';
      }
    });
    Object.entries(latestNexus).forEach(([appId, entry]) => {
      if (appMap[appId]) {
        appMap[appId].nexusScans = entry.status === 'Success' ? 'success' : entry.status === 'Failed' ? 'failure' : 'pending';
      }
    });
    Object.entries(latestAutoTest).forEach(([appId, entry]) => {
      if (appMap[appId]) {
        appMap[appId].automationTestExecution = entry.status === 'Success' ? 'success' : entry.status === 'Failed' ? 'failure' : 'pending';
      }
    });
  }

  return Object.values(appMap).sort((a, b) => a.applicationName.localeCompare(b.applicationName));
}

/**
 * DevSecOpsDashboard — Main DevSecOps Maturity Dashboard page component.
 *
 * Composes TimeSeriesChart (Development Readiness), BarChart (Unit Testing, SAST/DAST),
 * ColumnChart (Deployment Pipeline), and StatusMatrix. Includes CSVImportModal trigger,
 * ExportButton, and AuditLogPanel trigger. Uses useDashboardData hook for filtered data.
 * Wrapped in DashboardLayout with ref for export capture.
 *
 * @returns {JSX.Element}
 */
export default function DevSecOpsDashboard() {
  const { data, loading, error, refresh } = useDashboardData('devsecops');
  const { canImport, canViewAudit } = useRoleGuard();
  const location = useLocation();

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

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isAuditPanelOpen, setIsAuditPanelOpen] = useState(false);
  const [importDataType, setImportDataType] = useState(DATA_TYPES.APPLICATIONS);

  const dashboardRef = useRef(null);

  // Handlers
  const handleOpenImportModal = useCallback((dataType) => {
    setImportDataType(dataType || DATA_TYPES.APPLICATIONS);
    setIsImportModalOpen(true);
  }, []);

  const handleCloseImportModal = useCallback(() => {
    setIsImportModalOpen(false);
  }, []);

  const handleImportComplete = useCallback(() => {
    setIsImportModalOpen(false);
    refresh();
  }, [refresh]);

  const handleOpenAuditPanel = useCallback(() => {
    setIsAuditPanelOpen(true);
  }, []);

  const handleCloseAuditPanel = useCallback(() => {
    setIsAuditPanelOpen(false);
  }, []);

  // Computed data for charts
  const summaryMetrics = useMemo(() => computeSummaryMetrics(data), [data]);

  const readinessChartData = useMemo(
    () => aggregateReadinessByDate(data[DATA_TYPES.DEV_READINESS] || []),
    [data]
  );

  const coverageChartData = useMemo(
    () => aggregateCoverageByApp(data[DATA_TYPES.UNIT_TEST_COVERAGE] || []),
    [data]
  );

  const scanChartData = useMemo(
    () => aggregateScansByApp(data[DATA_TYPES.SECURITY_SCANS] || []),
    [data]
  );

  const pipelineChartData = useMemo(
    () => aggregatePipelineByStage(data[DATA_TYPES.DEPLOYMENT_PIPELINES] || []),
    [data]
  );

  const statusMatrixData = useMemo(
    () =>
      buildStatusMatrixData(
        data[DATA_TYPES.APPLICATION_STATUS] || [],
        data[DATA_TYPES.SECURITY_SCANS] || [],
        data[DATA_TYPES.DEPLOYMENT_PIPELINES] || [],
        data[DATA_TYPES.UNIT_TEST_COVERAGE] || []
      ),
    [data]
  );

  // Readiness sparkline data for metric card
  const readinessSparkline = useMemo(() => {
    return readinessChartData.map((d) => ({ value: d.readinessScore }));
  }, [readinessChartData]);

  const coverageSparkline = useMemo(() => {
    if (!Array.isArray(data[DATA_TYPES.UNIT_TEST_COVERAGE]) || data[DATA_TYPES.UNIT_TEST_COVERAGE].length === 0) {
      return [];
    }
    const byDate = {};
    data[DATA_TYPES.UNIT_TEST_COVERAGE].forEach((entry) => {
      if (!byDate[entry.date]) {
        byDate[entry.date] = { sum: 0, count: 0 };
      }
      byDate[entry.date].sum += entry.lineCoverage || 0;
      byDate[entry.date].count += 1;
    });
    return Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, agg]) => ({ value: parseFloat((agg.sum / agg.count).toFixed(1)) }));
  }, [data]);

  // Readiness trend direction
  const readinessTrend = useMemo(() => {
    if (readinessChartData.length < 2) return 'flat';
    const first = readinessChartData[0].readinessScore;
    const last = readinessChartData[readinessChartData.length - 1].readinessScore;
    if (last - first > 2) return 'up';
    if (first - last > 2) return 'down';
    return 'flat';
  }, [readinessChartData]);

  if (loading) {
    return (
      <DashboardLayout
        title="DevSecOps Maturity Dashboard"
        activeDashboard="devsecops"
        showFilterBar
        showSidebar
        visibleFilters={['domain', 'application', 'team', 'environment']}
      >
        <div className="flex items-center justify-center py-24">
          <LoadingSpinner message="Loading DevSecOps dashboard data…" size="lg" />
        </div>
      </DashboardLayout>
    );
  }

  if (error && Object.keys(data).length === 0) {
    return (
      <DashboardLayout
        title="DevSecOps Maturity Dashboard"
        activeDashboard="devsecops"
        showFilterBar
        showSidebar
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
      title="DevSecOps Maturity Dashboard"
      description="Security, quality, and deployment readiness across the application portfolio"
      activeDashboard="devsecops"
      showFilterBar
      showSidebar
      showExport
      exportFilename="devsecops-maturity-dashboard"
      visibleFilters={['domain', 'application', 'team', 'environment']}
    >
      <div ref={dashboardRef} className="space-y-6">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {canImport && (
              <button
                type="button"
                onClick={() => handleOpenImportModal(DATA_TYPES.APPLICATIONS)}
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
            {canViewAudit && (
              <button
                type="button"
                onClick={handleOpenAuditPanel}
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
                    d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
                  />
                </svg>
                Audit Trail
              </button>
            )}
          </div>
          {error && (
            <div className="flex items-center gap-1.5 rounded-md bg-amber-50 px-3 py-1.5 text-xs text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
              <svg
                className="h-3.5 w-3.5"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
                  clipRule="evenodd"
                />
              </svg>
              {error}
            </div>
          )}
        </div>

        {/* Summary KPI Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <MetricCard
            title="Avg Readiness Score"
            value={summaryMetrics.avgReadiness}
            unit="percentage"
            trend={readinessTrend}
            trendValue={readinessTrend === 'up' ? '+' : readinessTrend === 'down' ? '-' : ''}
            sparklineData={readinessSparkline}
            sparklineColor="#3B82F6"
          />
          <MetricCard
            title="Avg Test Coverage"
            value={summaryMetrics.avgCoverage}
            unit="percentage"
            trend={summaryMetrics.avgCoverage !== null && summaryMetrics.avgCoverage >= 80 ? 'up' : summaryMetrics.avgCoverage !== null && summaryMetrics.avgCoverage >= 60 ? 'flat' : 'down'}
            sparklineData={coverageSparkline}
            sparklineColor="#10B981"
          />
          <MetricCard
            title="Critical + High Vulns"
            value={summaryMetrics.totalVulnerabilities}
            unit="count"
            trend={summaryMetrics.totalVulnerabilities <= 10 ? 'down' : summaryMetrics.totalVulnerabilities <= 30 ? 'flat' : 'up'}
            invertTrend
            description="Open critical & high severity"
          />
          <MetricCard
            title="Pipeline Success Rate"
            value={summaryMetrics.pipelineSuccessRate}
            unit="percentage"
            trend={summaryMetrics.pipelineSuccessRate !== null && summaryMetrics.pipelineSuccessRate >= 90 ? 'up' : 'flat'}
            description="All pipeline stages"
          />
          <MetricCard
            title="Avg Build Time"
            value={summaryMetrics.avgBuildTime}
            unit="minutes"
            trend={summaryMetrics.avgBuildTime !== null && summaryMetrics.avgBuildTime <= 10 ? 'down' : 'flat'}
            invertTrend
            description="Minutes per build"
          />
          <MetricCard
            title="Compliance Score"
            value={summaryMetrics.complianceScore}
            unit="percentage"
            trend={summaryMetrics.complianceScore !== null && summaryMetrics.complianceScore >= 90 ? 'up' : summaryMetrics.complianceScore !== null && summaryMetrics.complianceScore >= 75 ? 'flat' : 'down'}
            description="HIPAA, SOC2, PCI"
          />
        </div>

        {/* Development Readiness Trend */}
        <div id="maturity">
          <TimeSeriesChart
            data={readinessChartData}
            title="Development Readiness Trend"
            series={[
              { key: 'readinessScore', name: 'Readiness Score', color: '#3B82F6' },
              { key: 'buildSuccessRate', name: 'Build Success Rate', color: '#10B981' },
            ]}
            config={{
              valueUnit: 'percentage',
              yAxisMin: 0,
              yAxisMax: 100,
              showGrid: true,
              showLegend: true,
              showDots: true,
              strokeWidth: 2,
              curveType: 'monotone',
              referenceLines: [
                { value: 90, label: 'Target (90%)', color: '#94a3b8' },
              ],
            }}
            height={350}
          />
        </div>

        {/* Charts Row: Unit Testing Coverage + Security Scan Findings */}
        <div id="security" className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <BarChart
            data={coverageChartData}
            title="Unit Test Coverage by Application"
            xKey="application"
            yKeys={['lineCoverage', 'branchCoverage', 'functionCoverage']}
            labels={['Line Coverage', 'Branch Coverage', 'Function Coverage']}
            colors={['#3B82F6', '#8B5CF6', '#06B6D4']}
            orientation="horizontal"
            mode="grouped"
            valueSuffix="%"
            height={400}
            showGrid
            showLegend
            showTooltip
            yAxisLabel="Coverage %"
          />
          <BarChart
            data={scanChartData}
            title="Security Scan Findings by Application"
            xKey="application"
            yKeys={['critical', 'high', 'medium', 'low']}
            labels={['Critical', 'High', 'Medium', 'Low']}
            colors={['#DC2626', '#EF4444', '#F59E0B', '#10B981']}
            orientation="horizontal"
            mode="stacked"
            height={400}
            showGrid
            showLegend
            showTooltip
            yAxisLabel="Findings"
          />
        </div>

        {/* Deployment Pipeline Stages */}
        <div id="pipeline">
          <ColumnChart
            data={pipelineChartData}
            title="Deployment Pipeline Stage Results"
            categoryKey="stage"
            series={[
              { dataKey: 'success', name: 'Success', color: '#10B981' },
              { dataKey: 'failed', name: 'Failed', color: '#EF4444' },
            ]}
            valueFormat="number"
            yAxisLabel="Executions"
            height={350}
            showGrid
            showLegend
            emptyMessage="No pipeline data available for the selected filters."
          />
        </div>

        {/* Application Status Matrix */}
        <StatusMatrix
          data={statusMatrixData}
          title="Application DevSecOps Status Matrix"
          showFilter
          showOverallStatus
          showDomain
          emptyMessage="No application status data available for the selected filters."
        />
      </div>

      {/* CSV Import Modal */}
      <CSVImportModal
        isOpen={isImportModalOpen}
        onClose={handleCloseImportModal}
        dataType={importDataType}
        onImportComplete={handleImportComplete}
        title={`Import ${importDataType} Data`}
      />

      {/* Audit Log Panel */}
      <AuditLogPanel
        isOpen={isAuditPanelOpen}
        onClose={handleCloseAuditPanel}
      />
    </DashboardLayout>
  );
}