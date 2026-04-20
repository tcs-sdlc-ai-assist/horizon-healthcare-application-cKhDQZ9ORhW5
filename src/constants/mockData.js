/**
 * Comprehensive mock dataset for Horizon Healthcare Dashboards
 * Covers DevSecOps, Application Development, and Agile Flow metrics
 * 20+ applications across 5+ domains with realistic data
 */

const DOMAINS = [
  'Claims Processing',
  'Member Services',
  'Provider Network',
  'Pharmacy Benefits',
  'Care Management',
  'Billing & Revenue',
  'Enrollment',
  'Telehealth',
];

const APPLICATION_NAMES = [
  'ClaimsEngine',
  'ClaimsAdjudicator',
  'ClaimsPortal',
  'ClaimsAnalytics',
  'MemberPortal',
  'MemberAPI',
  'MemberNotifications',
  'MemberEligibility',
  'ProviderDirectory',
  'ProviderCredentialing',
  'ProviderPayments',
  'PharmacyPOS',
  'PharmacyFormulary',
  'PharmacyMailOrder',
  'CareCoordinator',
  'CarePathways',
  'CareAlerts',
  'BillingEngine',
  'RevenueReconciler',
  'BillingPortal',
  'EnrollmentGateway',
  'EnrollmentVerifier',
  'TelehealthConnect',
  'TelehealthScheduler',
  'TelehealthVideo',
];

const ENVIRONMENTS = ['DEV', 'QA', 'STAGING', 'PROD'];
const PIPELINE_STAGES = ['Source', 'Build', 'Unit Test', 'SAST', 'DAST', 'Integration Test', 'Deploy', 'Smoke Test'];
const STATUSES = ['Healthy', 'Warning', 'Critical', 'Degraded'];
const SEVERITY_LEVELS = ['Critical', 'High', 'Medium', 'Low', 'Info'];
const SPRINT_NAMES_PREFIX = 'Sprint';

/**
 * Deterministic pseudo-random number generator for consistent mock data
 * @param {number} seed
 * @returns {function(): number}
 */
function seededRandom(seed) {
  let s = seed;
  return function () {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const rand = seededRandom(42);

/**
 * Generate a random integer between min and max (inclusive)
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function randInt(min, max) {
  return Math.floor(rand() * (max - min + 1)) + min;
}

/**
 * Generate a random float between min and max with given decimal places
 * @param {number} min
 * @param {number} max
 * @param {number} [decimals=2]
 * @returns {number}
 */
function randFloat(min, max, decimals = 2) {
  const val = rand() * (max - min) + min;
  return parseFloat(val.toFixed(decimals));
}

/**
 * Pick a random element from an array
 * @param {Array} arr
 * @returns {*}
 */
function pickRandom(arr) {
  return arr[Math.floor(rand() * arr.length)];
}

/**
 * Generate ISO date strings for the last N months
 * @param {number} months
 * @returns {string[]}
 */
function generateMonthlyDates(months) {
  const dates = [];
  const now = new Date(2025, 0, 15);
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 15);
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
}

/**
 * Generate ISO date strings for the last N weeks
 * @param {number} weeks
 * @returns {string[]}
 */
function generateWeeklyDates(weeks) {
  const dates = [];
  const now = new Date(2025, 0, 13);
  for (let i = weeks - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
}

// ============================================================
// Application Registry
// ============================================================

/**
 * @typedef {Object} Application
 * @property {string} id
 * @property {string} name
 * @property {string} domain
 * @property {string} team
 * @property {string} techStack
 * @property {string} tier
 */

const TECH_STACKS = ['Java/Spring Boot', 'Node.js/Express', '.NET Core', 'Python/FastAPI', 'React/Node', 'Go/gRPC', 'Kotlin/Ktor'];
const TIERS = ['Tier 1', 'Tier 2', 'Tier 3'];
const TEAMS = [
  'Alpha Squad',
  'Beta Force',
  'Gamma Team',
  'Delta Ops',
  'Epsilon Dev',
  'Zeta Engineering',
  'Theta Builders',
  'Iota Platform',
  'Kappa Services',
  'Lambda Cloud',
];

/** @type {Application[]} */
export const applications = APPLICATION_NAMES.map((name, index) => ({
  id: `APP-${String(index + 1).padStart(4, '0')}`,
  name,
  domain: DOMAINS[index % DOMAINS.length],
  team: TEAMS[index % TEAMS.length],
  techStack: TECH_STACKS[index % TECH_STACKS.length],
  tier: TIERS[index % TIERS.length],
}));

// ============================================================
// DevSecOps Maturity Metrics
// ============================================================

const monthlyDates = generateMonthlyDates(12);
const weeklyDates = generateWeeklyDates(26);

/**
 * Development readiness time series per application
 * @typedef {Object} DevReadinessEntry
 * @property {string} applicationId
 * @property {string} applicationName
 * @property {string} date
 * @property {number} readinessScore - 0-100
 * @property {number} buildSuccessRate - 0-100
 * @property {number} avgBuildTimeMinutes
 * @property {number} environmentsReady - count of ready environments
 */

/** @type {DevReadinessEntry[]} */
export const devReadinessTimeSeries = [];

applications.forEach((app) => {
  const baseReadiness = randInt(55, 95);
  const baseBuildSuccess = randInt(70, 99);
  const baseBuildTime = randFloat(2, 25, 1);

  monthlyDates.forEach((date, idx) => {
    const trend = idx * randFloat(0.2, 0.8, 1);
    devReadinessTimeSeries.push({
      applicationId: app.id,
      applicationName: app.name,
      domain: app.domain,
      date,
      readinessScore: Math.min(100, parseFloat((baseReadiness + trend).toFixed(1))),
      buildSuccessRate: Math.min(100, parseFloat((baseBuildSuccess + trend * 0.5).toFixed(1))),
      avgBuildTimeMinutes: Math.max(1, parseFloat((baseBuildTime - trend * 0.3).toFixed(1))),
      environmentsReady: randInt(2, 4),
    });
  });
});

/**
 * Unit testing coverage per application over time
 * @typedef {Object} UnitTestCoverageEntry
 * @property {string} applicationId
 * @property {string} applicationName
 * @property {string} date
 * @property {number} lineCoverage - 0-100
 * @property {number} branchCoverage - 0-100
 * @property {number} functionCoverage - 0-100
 * @property {number} totalTests
 * @property {number} passingTests
 * @property {number} failingTests
 * @property {number} skippedTests
 */

/** @type {UnitTestCoverageEntry[]} */
export const unitTestCoverage = [];

applications.forEach((app) => {
  const baseLineCov = randFloat(40, 92, 1);
  const baseBranchCov = randFloat(30, 85, 1);
  const baseFuncCov = randFloat(50, 95, 1);
  const baseTotalTests = randInt(120, 2500);

  monthlyDates.forEach((date, idx) => {
    const growth = idx * randFloat(0.3, 1.2, 1);
    const totalTests = baseTotalTests + randInt(5, 30) * idx;
    const failingTests = randInt(0, Math.max(1, Math.floor(totalTests * 0.03)));
    const skippedTests = randInt(0, Math.max(1, Math.floor(totalTests * 0.02)));
    const passingTests = totalTests - failingTests - skippedTests;

    unitTestCoverage.push({
      applicationId: app.id,
      applicationName: app.name,
      domain: app.domain,
      date,
      lineCoverage: Math.min(100, parseFloat((baseLineCov + growth).toFixed(1))),
      branchCoverage: Math.min(100, parseFloat((baseBranchCov + growth * 0.8).toFixed(1))),
      functionCoverage: Math.min(100, parseFloat((baseFuncCov + growth * 0.6).toFixed(1))),
      totalTests,
      passingTests,
      failingTests,
      skippedTests,
    });
  });
});

/**
 * SAST/DAST scan results per application
 * @typedef {Object} SecurityScanResult
 * @property {string} applicationId
 * @property {string} applicationName
 * @property {string} scanType - 'SAST' | 'DAST'
 * @property {string} date
 * @property {number} critical
 * @property {number} high
 * @property {number} medium
 * @property {number} low
 * @property {number} info
 * @property {number} totalFindings
 * @property {number} fixedSinceLastScan
 * @property {number} newSinceLastScan
 * @property {number} scanDurationMinutes
 * @property {boolean} passed
 */

/** @type {SecurityScanResult[]} */
export const securityScanResults = [];

applications.forEach((app) => {
  ['SAST', 'DAST'].forEach((scanType) => {
    const baseCritical = randInt(0, 5);
    const baseHigh = randInt(1, 15);
    const baseMedium = randInt(5, 40);
    const baseLow = randInt(10, 60);
    const baseInfo = randInt(5, 30);

    monthlyDates.forEach((date, idx) => {
      const reduction = Math.floor(idx * randFloat(0.2, 0.6, 1));
      const critical = Math.max(0, baseCritical - reduction);
      const high = Math.max(0, baseHigh - reduction);
      const medium = Math.max(0, baseMedium - Math.floor(reduction * 1.5));
      const low = Math.max(0, baseLow - Math.floor(reduction * 0.5));
      const info = Math.max(0, baseInfo);
      const totalFindings = critical + high + medium + low + info;

      securityScanResults.push({
        applicationId: app.id,
        applicationName: app.name,
        domain: app.domain,
        scanType,
        date,
        critical,
        high,
        medium,
        low,
        info,
        totalFindings,
        fixedSinceLastScan: randInt(0, Math.max(1, Math.floor(totalFindings * 0.2))),
        newSinceLastScan: randInt(0, Math.max(1, Math.floor(totalFindings * 0.05))),
        scanDurationMinutes: randFloat(2, scanType === 'DAST' ? 45 : 15, 1),
        passed: critical === 0 && high <= 2,
      });
    });
  });
});

/**
 * Deployment pipeline stages per application
 * @typedef {Object} PipelineStageEntry
 * @property {string} applicationId
 * @property {string} applicationName
 * @property {string} pipelineRunId
 * @property {string} date
 * @property {string} environment
 * @property {string} stage
 * @property {string} status - 'Success' | 'Failed' | 'Skipped' | 'Running'
 * @property {number} durationSeconds
 * @property {string} triggeredBy
 */

/** @type {PipelineStageEntry[]} */
export const deploymentPipelines = [];

let pipelineRunCounter = 1;

applications.forEach((app) => {
  weeklyDates.forEach((date) => {
    const runsThisWeek = randInt(1, 5);
    for (let r = 0; r < runsThisWeek; r++) {
      const runId = `RUN-${String(pipelineRunCounter++).padStart(6, '0')}`;
      const env = pickRandom(ENVIRONMENTS);
      let failed = false;

      PIPELINE_STAGES.forEach((stage) => {
        let status = 'Success';
        if (failed) {
          status = 'Skipped';
        } else if (rand() < 0.06) {
          status = 'Failed';
          failed = true;
        }

        deploymentPipelines.push({
          applicationId: app.id,
          applicationName: app.name,
          domain: app.domain,
          pipelineRunId: runId,
          date,
          environment: env,
          stage,
          status,
          durationSeconds: status === 'Skipped' ? 0 : randInt(5, 600),
          triggeredBy: rand() > 0.3 ? 'CI/CD Auto' : pickRandom(TEAMS),
        });
      });
    }
  });
});

/**
 * Application status matrix
 * @typedef {Object} AppStatusEntry
 * @property {string} applicationId
 * @property {string} applicationName
 * @property {string} domain
 * @property {string} environment
 * @property {string} status
 * @property {number} uptime - percentage
 * @property {string} lastDeployDate
 * @property {string} version
 * @property {number} activeIncidents
 * @property {number} openVulnerabilities
 */

/** @type {AppStatusEntry[]} */
export const applicationStatusMatrix = [];

applications.forEach((app) => {
  ENVIRONMENTS.forEach((env) => {
    const status = pickRandom(STATUSES);
    applicationStatusMatrix.push({
      applicationId: app.id,
      applicationName: app.name,
      domain: app.domain,
      environment: env,
      status,
      uptime: status === 'Critical' ? randFloat(85, 95, 2) : status === 'Warning' ? randFloat(95, 99, 2) : randFloat(99, 99.99, 2),
      lastDeployDate: pickRandom(weeklyDates),
      version: `${randInt(1, 5)}.${randInt(0, 20)}.${randInt(0, 100)}`,
      activeIncidents: status === 'Critical' ? randInt(1, 5) : status === 'Warning' ? randInt(0, 2) : 0,
      openVulnerabilities: randInt(0, 15),
    });
  });
});

// ============================================================
// Application Development Metrics
// ============================================================

/**
 * DORA-style metrics per application per month
 * @typedef {Object} DoraMetricsEntry
 * @property {string} applicationId
 * @property {string} applicationName
 * @property {string} domain
 * @property {string} date
 * @property {number} deployFrequency - deploys per month
 * @property {number} leadTimeHours - hours from commit to production
 * @property {number} changeFailureRate - percentage
 * @property {number} mttrHours - mean time to recovery in hours
 */

/** @type {DoraMetricsEntry[]} */
export const doraMetrics = [];

applications.forEach((app) => {
  const baseDeployFreq = randInt(4, 60);
  const baseLeadTime = randFloat(2, 168, 1);
  const baseCFR = randFloat(1, 25, 1);
  const baseMTTR = randFloat(0.5, 48, 1);

  monthlyDates.forEach((date, idx) => {
    const improvement = idx * randFloat(0.1, 0.5, 2);
    doraMetrics.push({
      applicationId: app.id,
      applicationName: app.name,
      domain: app.domain,
      date,
      deployFrequency: Math.max(1, Math.round(baseDeployFreq + improvement * 2)),
      leadTimeHours: Math.max(0.5, parseFloat((baseLeadTime - improvement * 3).toFixed(1))),
      changeFailureRate: Math.max(0, parseFloat((baseCFR - improvement * 0.5).toFixed(1))),
      mttrHours: Math.max(0.1, parseFloat((baseMTTR - improvement * 0.8).toFixed(1))),
    });
  });
});

/**
 * Reliability metrics per application
 * @typedef {Object} ReliabilityEntry
 * @property {string} applicationId
 * @property {string} applicationName
 * @property {string} domain
 * @property {string} date
 * @property {number} availability - percentage (SLA)
 * @property {number} errorRate - percentage
 * @property {number} p50LatencyMs
 * @property {number} p95LatencyMs
 * @property {number} p99LatencyMs
 * @property {number} incidentCount
 * @property {number} slaBreaches
 */

/** @type {ReliabilityEntry[]} */
export const reliabilityMetrics = [];

applications.forEach((app) => {
  const baseAvailability = randFloat(98.5, 99.99, 2);
  const baseErrorRate = randFloat(0.01, 3, 2);
  const baseP50 = randInt(5, 200);
  const baseP95 = baseP50 * randFloat(2, 5, 1);
  const baseP99 = baseP95 * randFloat(1.5, 3, 1);

  monthlyDates.forEach((date) => {
    const availability = Math.min(100, baseAvailability + randFloat(-0.5, 0.5, 2));
    const errorRate = Math.max(0, baseErrorRate + randFloat(-0.5, 0.5, 2));

    reliabilityMetrics.push({
      applicationId: app.id,
      applicationName: app.name,
      domain: app.domain,
      date,
      availability: parseFloat(availability.toFixed(2)),
      errorRate: parseFloat(errorRate.toFixed(2)),
      p50LatencyMs: Math.max(1, baseP50 + randInt(-20, 20)),
      p95LatencyMs: Math.max(5, Math.round(baseP95 + randInt(-50, 50))),
      p99LatencyMs: Math.max(10, Math.round(baseP99 + randInt(-100, 100))),
      incidentCount: randInt(0, 5),
      slaBreaches: availability < 99.5 ? randInt(1, 3) : 0,
    });
  });
});

/**
 * Tech debt index per application
 * @typedef {Object} TechDebtEntry
 * @property {string} applicationId
 * @property {string} applicationName
 * @property {string} domain
 * @property {string} date
 * @property {number} debtIndex - 0-100 (higher = more debt)
 * @property {number} codeSmells
 * @property {number} duplications - percentage
 * @property {number} complexityScore
 * @property {number} outdatedDependencies
 * @property {number} estimatedRemediationDays
 */

/** @type {TechDebtEntry[]} */
export const techDebtMetrics = [];

applications.forEach((app) => {
  const baseDebt = randFloat(15, 80, 1);
  const baseSmells = randInt(20, 500);
  const baseDuplications = randFloat(1, 20, 1);
  const baseComplexity = randInt(10, 200);
  const baseOutdated = randInt(2, 40);

  monthlyDates.forEach((date, idx) => {
    const reduction = idx * randFloat(0.2, 0.8, 1);
    const debtIndex = Math.max(5, parseFloat((baseDebt - reduction).toFixed(1)));

    techDebtMetrics.push({
      applicationId: app.id,
      applicationName: app.name,
      domain: app.domain,
      date,
      debtIndex,
      codeSmells: Math.max(0, baseSmells - Math.floor(reduction * 5)),
      duplications: Math.max(0, parseFloat((baseDuplications - reduction * 0.3).toFixed(1))),
      complexityScore: Math.max(5, baseComplexity - Math.floor(reduction * 2)),
      outdatedDependencies: Math.max(0, baseOutdated - Math.floor(reduction * 0.5)),
      estimatedRemediationDays: Math.max(1, Math.round(debtIndex * randFloat(0.5, 2, 1))),
    });
  });
});

/**
 * Security and compliance snapshots per application
 * @typedef {Object} SecurityComplianceEntry
 * @property {string} applicationId
 * @property {string} applicationName
 * @property {string} domain
 * @property {string} date
 * @property {number} complianceScore - 0-100
 * @property {boolean} hipaaCompliant
 * @property {boolean} soc2Compliant
 * @property {boolean} pciCompliant
 * @property {number} openCriticalVulns
 * @property {number} openHighVulns
 * @property {number} patchesPending
 * @property {number} daysSinceLastPenTest
 * @property {string} riskRating - 'Low' | 'Medium' | 'High' | 'Critical'
 */

/** @type {SecurityComplianceEntry[]} */
export const securityComplianceSnapshots = [];

applications.forEach((app) => {
  const baseCompliance = randFloat(60, 98, 1);
  const hipaa = rand() > 0.15;
  const soc2 = rand() > 0.2;
  const pci = rand() > 0.4;

  monthlyDates.forEach((date, idx) => {
    const improvement = idx * randFloat(0.1, 0.5, 1);
    const complianceScore = Math.min(100, parseFloat((baseCompliance + improvement).toFixed(1)));
    const openCritical = Math.max(0, randInt(0, 3) - Math.floor(improvement * 0.3));
    const openHigh = Math.max(0, randInt(0, 10) - Math.floor(improvement * 0.5));

    let riskRating = 'Low';
    if (openCritical > 2) riskRating = 'Critical';
    else if (openCritical > 0 || openHigh > 5) riskRating = 'High';
    else if (openHigh > 2 || complianceScore < 80) riskRating = 'Medium';

    securityComplianceSnapshots.push({
      applicationId: app.id,
      applicationName: app.name,
      domain: app.domain,
      date,
      complianceScore,
      hipaaCompliant: hipaa,
      soc2Compliant: soc2,
      pciCompliant: pci,
      openCriticalVulns: openCritical,
      openHighVulns: openHigh,
      patchesPending: randInt(0, 20),
      daysSinceLastPenTest: randInt(10, 180),
      riskRating,
    });
  });
});

// ============================================================
// Agile Flow Metrics
// ============================================================

/**
 * Sprint metrics per team
 * @typedef {Object} SprintMetricsEntry
 * @property {string} sprintId
 * @property {string} sprintName
 * @property {string} team
 * @property {string} domain
 * @property {string} startDate
 * @property {string} endDate
 * @property {number} committed - story points committed
 * @property {number} done - story points completed
 * @property {number} deployed - story points deployed to production
 * @property {number} predictability - percentage (done/committed * 100)
 * @property {number} velocity
 * @property {number} carryOver - story points carried to next sprint
 * @property {number} storiesCommitted
 * @property {number} storiesDone
 * @property {number} storiesDeployed
 * @property {number} defectsFound
 * @property {number} defectsFixed
 */

/** @type {SprintMetricsEntry[]} */
export const sprintMetrics = [];

let sprintCounter = 1;

TEAMS.forEach((team, teamIdx) => {
  const domain = DOMAINS[teamIdx % DOMAINS.length];
  const baseVelocity = randInt(20, 60);

  for (let s = 0; s < 12; s++) {
    const sprintId = `SPR-${String(sprintCounter++).padStart(4, '0')}`;
    const startDate = new Date(2024, 1 + s, 1 + (s % 2) * 14);
    const endDate = new Date(startDate.getTime() + 13 * 24 * 60 * 60 * 1000);

    const committed = baseVelocity + randInt(-8, 8);
    const done = Math.min(committed, committed - randInt(-3, Math.max(1, Math.floor(committed * 0.15))));
    const deployed = Math.min(done, done - randInt(0, Math.max(1, Math.floor(done * 0.1))));
    const carryOver = Math.max(0, committed - done);
    const predictability = committed > 0 ? parseFloat(((done / committed) * 100).toFixed(1)) : 0;

    const storiesCommitted = randInt(8, 25);
    const storiesDone = Math.min(storiesCommitted, storiesCommitted - randInt(0, 4));
    const storiesDeployed = Math.min(storiesDone, storiesDone - randInt(0, 2));

    sprintMetrics.push({
      sprintId,
      sprintName: `${SPRINT_NAMES_PREFIX} ${s + 1}`,
      team,
      domain,
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      committed,
      done: Math.max(0, done),
      deployed: Math.max(0, deployed),
      predictability: Math.min(100, Math.max(0, predictability)),
      velocity: Math.max(0, done),
      carryOver,
      storiesCommitted,
      storiesDone,
      storiesDeployed,
      defectsFound: randInt(0, 8),
      defectsFixed: randInt(0, 6),
    });
  }
});

/**
 * Flow distribution per team per sprint
 * @typedef {Object} FlowDistributionEntry
 * @property {string} sprintId
 * @property {string} team
 * @property {string} domain
 * @property {string} date
 * @property {number} features - percentage
 * @property {number} defects - percentage
 * @property {number} risks - percentage
 * @property {number} debt - percentage
 * @property {number} totalItems
 */

/** @type {FlowDistributionEntry[]} */
export const flowDistribution = [];

sprintMetrics.forEach((sprint) => {
  const features = randInt(35, 65);
  const defects = randInt(10, 25);
  const risks = randInt(5, 15);
  const debt = 100 - features - defects - risks;

  flowDistribution.push({
    sprintId: sprint.sprintId,
    team: sprint.team,
    domain: sprint.domain,
    date: sprint.startDate,
    features,
    defects,
    risks,
    debt: Math.max(0, debt),
    totalItems: sprint.storiesCommitted + randInt(0, 5),
  });
});

/**
 * Carry-over tracking per team
 * @typedef {Object} CarryOverEntry
 * @property {string} sprintId
 * @property {string} sprintName
 * @property {string} team
 * @property {string} domain
 * @property {number} carryOverPoints
 * @property {number} carryOverStories
 * @property {number} carryOverPercentage
 * @property {string[]} reasons
 */

const CARRY_OVER_REASONS = [
  'Scope creep',
  'Dependency blocked',
  'Resource unavailable',
  'Underestimated complexity',
  'Requirement change',
  'Environment issues',
  'Code review delays',
  'Testing bottleneck',
];

/** @type {CarryOverEntry[]} */
export const carryOverTracking = [];

sprintMetrics.forEach((sprint) => {
  if (sprint.carryOver > 0) {
    const reasonCount = randInt(1, 3);
    const reasons = [];
    for (let r = 0; r < reasonCount; r++) {
      const reason = pickRandom(CARRY_OVER_REASONS);
      if (!reasons.includes(reason)) {
        reasons.push(reason);
      }
    }

    carryOverTracking.push({
      sprintId: sprint.sprintId,
      sprintName: sprint.sprintName,
      team: sprint.team,
      domain: sprint.domain,
      carryOverPoints: sprint.carryOver,
      carryOverStories: randInt(1, Math.max(1, Math.floor(sprint.carryOver / 3))),
      carryOverPercentage: sprint.committed > 0
        ? parseFloat(((sprint.carryOver / sprint.committed) * 100).toFixed(1))
        : 0,
      reasons,
    });
  }
});

// ============================================================
// Scalability Testing: Generate additional services to reach 1000+
// ============================================================

/**
 * Extended service registry for scalability testing
 * @typedef {Object} ScalabilityService
 * @property {string} id
 * @property {string} name
 * @property {string} domain
 * @property {string} parentApplication
 * @property {string} type - 'microservice' | 'api' | 'worker' | 'gateway' | 'scheduler'
 * @property {string} status
 * @property {number} healthScore
 */

const SERVICE_TYPES = ['microservice', 'api', 'worker', 'gateway', 'scheduler'];

/** @type {ScalabilityService[]} */
export const scalabilityServices = [];

applications.forEach((app, appIdx) => {
  const serviceCount = randInt(30, 55);
  for (let s = 0; s < serviceCount; s++) {
    const globalIdx = appIdx * 55 + s;
    scalabilityServices.push({
      id: `SVC-${String(globalIdx + 1).padStart(5, '0')}`,
      name: `${app.name}-svc-${String(s + 1).padStart(3, '0')}`,
      domain: app.domain,
      parentApplication: app.id,
      type: pickRandom(SERVICE_TYPES),
      status: pickRandom(STATUSES),
      healthScore: randInt(50, 100),
    });
  }
});

// ============================================================
// Aggregated / Summary Data
// ============================================================

/**
 * Domain-level summary
 * @typedef {Object} DomainSummary
 * @property {string} domain
 * @property {number} applicationCount
 * @property {number} avgReadinessScore
 * @property {number} avgTestCoverage
 * @property {number} avgDeployFrequency
 * @property {number} avgLeadTimeHours
 * @property {number} avgChangeFailureRate
 * @property {number} avgComplianceScore
 * @property {number} avgPredictability
 * @property {number} totalOpenVulnerabilities
 */

/** @type {DomainSummary[]} */
export const domainSummaries = DOMAINS.map((domain) => {
  const domainApps = applications.filter((a) => a.domain === domain);
  const domainAppIds = domainApps.map((a) => a.id);

  const latestReadiness = devReadinessTimeSeries
    .filter((d) => domainAppIds.includes(d.applicationId) && d.date === monthlyDates[monthlyDates.length - 1]);
  const latestCoverage = unitTestCoverage
    .filter((d) => domainAppIds.includes(d.applicationId) && d.date === monthlyDates[monthlyDates.length - 1]);
  const latestDora = doraMetrics
    .filter((d) => domainAppIds.includes(d.applicationId) && d.date === monthlyDates[monthlyDates.length - 1]);
  const latestCompliance = securityComplianceSnapshots
    .filter((d) => domainAppIds.includes(d.applicationId) && d.date === monthlyDates[monthlyDates.length - 1]);
  const domainSprints = sprintMetrics.filter((s) => s.domain === domain);
  const latestStatus = applicationStatusMatrix.filter((s) => domainAppIds.includes(s.applicationId));

  const avg = (arr, key) => {
    if (arr.length === 0) return 0;
    return parseFloat((arr.reduce((sum, item) => sum + item[key], 0) / arr.length).toFixed(1));
  };

  return {
    domain,
    applicationCount: domainApps.length,
    avgReadinessScore: avg(latestReadiness, 'readinessScore'),
    avgTestCoverage: avg(latestCoverage, 'lineCoverage'),
    avgDeployFrequency: avg(latestDora, 'deployFrequency'),
    avgLeadTimeHours: avg(latestDora, 'leadTimeHours'),
    avgChangeFailureRate: avg(latestDora, 'changeFailureRate'),
    avgComplianceScore: avg(latestCompliance, 'complianceScore'),
    avgPredictability: avg(domainSprints, 'predictability'),
    totalOpenVulnerabilities: latestStatus.reduce((sum, s) => sum + s.openVulnerabilities, 0),
  };
});

// ============================================================
// Constants Export
// ============================================================

export const constants = {
  DOMAINS,
  ENVIRONMENTS,
  PIPELINE_STAGES,
  STATUSES,
  SEVERITY_LEVELS,
  TECH_STACKS,
  TIERS,
  TEAMS,
  SERVICE_TYPES,
  CARRY_OVER_REASONS,
};

// ============================================================
// Default Export: All Data
// ============================================================

const mockData = {
  applications,
  devReadinessTimeSeries,
  unitTestCoverage,
  securityScanResults,
  deploymentPipelines,
  applicationStatusMatrix,
  doraMetrics,
  reliabilityMetrics,
  techDebtMetrics,
  securityComplianceSnapshots,
  sprintMetrics,
  flowDistribution,
  carryOverTracking,
  scalabilityServices,
  domainSummaries,
  constants,
};

export default mockData;