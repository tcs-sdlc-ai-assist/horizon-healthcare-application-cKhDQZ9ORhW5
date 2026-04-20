export const LOCAL_STORAGE_KEYS = {
  HORIZON_DATA_RECORDS: 'HORIZON_DATA_RECORDS',
  HORIZON_FILTER_STATE: 'HORIZON_FILTER_STATE',
  HORIZON_AUDIT_TRAIL: 'HORIZON_AUDIT_TRAIL',
  HORIZON_AUTH_USER: 'HORIZON_AUTH_USER',
  HORIZON_ADMIN_CONFIG: 'HORIZON_ADMIN_CONFIG',
};

export const ROLES = {
  VIEW_ONLY: 'VIEW_ONLY',
  MANAGER: 'MANAGER',
  DELIVERY_MANAGER: 'DELIVERY_MANAGER',
  QE_LEAD: 'QE_LEAD',
  DEVELOPER: 'DEVELOPER',
  ADMIN: 'ADMIN',
  TEST_LEAD: 'TEST_LEAD',
};

export const ROLE_LABELS = {
  [ROLES.VIEW_ONLY]: 'View Only',
  [ROLES.MANAGER]: 'Manager',
  [ROLES.DELIVERY_MANAGER]: 'Delivery Manager',
  [ROLES.QE_LEAD]: 'QE Lead',
  [ROLES.DEVELOPER]: 'Developer',
  [ROLES.ADMIN]: 'Admin',
  [ROLES.TEST_LEAD]: 'Test Lead',
};

export const ROLE_PERMISSIONS = {
  [ROLES.VIEW_ONLY]: {
    canEdit: false,
    canDelete: false,
    canCreate: false,
    canManageUsers: false,
    canViewReports: true,
    canExport: false,
    canManageConfig: false,
  },
  [ROLES.MANAGER]: {
    canEdit: true,
    canDelete: false,
    canCreate: true,
    canManageUsers: false,
    canViewReports: true,
    canExport: true,
    canManageConfig: false,
  },
  [ROLES.DELIVERY_MANAGER]: {
    canEdit: true,
    canDelete: true,
    canCreate: true,
    canManageUsers: false,
    canViewReports: true,
    canExport: true,
    canManageConfig: false,
  },
  [ROLES.QE_LEAD]: {
    canEdit: true,
    canDelete: false,
    canCreate: true,
    canManageUsers: false,
    canViewReports: true,
    canExport: true,
    canManageConfig: false,
  },
  [ROLES.DEVELOPER]: {
    canEdit: true,
    canDelete: false,
    canCreate: true,
    canManageUsers: false,
    canViewReports: true,
    canExport: false,
    canManageConfig: false,
  },
  [ROLES.ADMIN]: {
    canEdit: true,
    canDelete: true,
    canCreate: true,
    canManageUsers: true,
    canViewReports: true,
    canExport: true,
    canManageConfig: true,
  },
  [ROLES.TEST_LEAD]: {
    canEdit: true,
    canDelete: false,
    canCreate: true,
    canManageUsers: false,
    canViewReports: true,
    canExport: true,
    canManageConfig: false,
  },
};

export const DEFAULT_DOMAINS = [
  {
    id: 'healthcare-claims',
    name: 'Healthcare Claims',
    applications: [
      { id: 'claims-processing', name: 'Claims Processing' },
      { id: 'claims-adjudication', name: 'Claims Adjudication' },
      { id: 'claims-analytics', name: 'Claims Analytics' },
    ],
  },
  {
    id: 'member-services',
    name: 'Member Services',
    applications: [
      { id: 'member-portal', name: 'Member Portal' },
      { id: 'enrollment', name: 'Enrollment' },
      { id: 'eligibility', name: 'Eligibility Verification' },
    ],
  },
  {
    id: 'provider-management',
    name: 'Provider Management',
    applications: [
      { id: 'provider-portal', name: 'Provider Portal' },
      { id: 'credentialing', name: 'Credentialing' },
      { id: 'network-management', name: 'Network Management' },
    ],
  },
  {
    id: 'pharmacy',
    name: 'Pharmacy',
    applications: [
      { id: 'pharmacy-benefits', name: 'Pharmacy Benefits' },
      { id: 'formulary-management', name: 'Formulary Management' },
      { id: 'prior-authorization', name: 'Prior Authorization' },
    ],
  },
  {
    id: 'clinical',
    name: 'Clinical',
    applications: [
      { id: 'care-management', name: 'Care Management' },
      { id: 'utilization-review', name: 'Utilization Review' },
      { id: 'clinical-analytics', name: 'Clinical Analytics' },
    ],
  },
];

export const METRIC_DEFINITIONS = {
  testCasesTotal: {
    key: 'testCasesTotal',
    label: 'Total Test Cases',
    description: 'Total number of test cases in the suite',
    unit: 'count',
  },
  testCasesPassed: {
    key: 'testCasesPassed',
    label: 'Test Cases Passed',
    description: 'Number of test cases that passed execution',
    unit: 'count',
  },
  testCasesFailed: {
    key: 'testCasesFailed',
    label: 'Test Cases Failed',
    description: 'Number of test cases that failed execution',
    unit: 'count',
  },
  testCasesBlocked: {
    key: 'testCasesBlocked',
    label: 'Test Cases Blocked',
    description: 'Number of test cases blocked due to dependencies or environment issues',
    unit: 'count',
  },
  testCasesNotExecuted: {
    key: 'testCasesNotExecuted',
    label: 'Test Cases Not Executed',
    description: 'Number of test cases pending execution',
    unit: 'count',
  },
  defectsOpen: {
    key: 'defectsOpen',
    label: 'Open Defects',
    description: 'Number of currently open defects',
    unit: 'count',
  },
  defectsCritical: {
    key: 'defectsCritical',
    label: 'Critical Defects',
    description: 'Number of critical severity defects',
    unit: 'count',
  },
  defectsResolved: {
    key: 'defectsResolved',
    label: 'Resolved Defects',
    description: 'Number of defects resolved in the current cycle',
    unit: 'count',
  },
  automationCoverage: {
    key: 'automationCoverage',
    label: 'Automation Coverage',
    description: 'Percentage of test cases automated',
    unit: 'percentage',
  },
  executionProgress: {
    key: 'executionProgress',
    label: 'Execution Progress',
    description: 'Percentage of test execution completed',
    unit: 'percentage',
  },
  passRate: {
    key: 'passRate',
    label: 'Pass Rate',
    description: 'Percentage of executed test cases that passed',
    unit: 'percentage',
  },
  defectLeakage: {
    key: 'defectLeakage',
    label: 'Defect Leakage',
    description: 'Percentage of defects found in production vs total defects',
    unit: 'percentage',
  },
  environmentUptime: {
    key: 'environmentUptime',
    label: 'Environment Uptime',
    description: 'Percentage of time the test environment was available',
    unit: 'percentage',
  },
};

export const RAG_STATUS = {
  RED: 'RED',
  AMBER: 'AMBER',
  GREEN: 'GREEN',
  NOT_AVAILABLE: 'NOT_AVAILABLE',
};

export const RAG_STATUS_LABELS = {
  [RAG_STATUS.RED]: 'Red',
  [RAG_STATUS.AMBER]: 'Amber',
  [RAG_STATUS.GREEN]: 'Green',
  [RAG_STATUS.NOT_AVAILABLE]: 'N/A',
};

export const RAG_STATUS_COLORS = {
  [RAG_STATUS.RED]: '#EF4444',
  [RAG_STATUS.AMBER]: '#F59E0B',
  [RAG_STATUS.GREEN]: '#10B981',
  [RAG_STATUS.NOT_AVAILABLE]: '#9CA3AF',
};

export const RAG_THRESHOLDS = {
  passRate: {
    green: { min: 95 },
    amber: { min: 85, max: 94.99 },
    red: { max: 84.99 },
  },
  executionProgress: {
    green: { min: 90 },
    amber: { min: 70, max: 89.99 },
    red: { max: 69.99 },
  },
  automationCoverage: {
    green: { min: 80 },
    amber: { min: 60, max: 79.99 },
    red: { max: 59.99 },
  },
  defectLeakage: {
    green: { max: 5 },
    amber: { min: 5.01, max: 15 },
    red: { min: 15.01 },
  },
  environmentUptime: {
    green: { min: 99 },
    amber: { min: 95, max: 98.99 },
    red: { max: 94.99 },
  },
};

export const CHART_COLORS = {
  primary: [
    '#3B82F6',
    '#10B981',
    '#F59E0B',
    '#EF4444',
    '#8B5CF6',
    '#EC4899',
    '#06B6D4',
    '#F97316',
    '#14B8A6',
    '#6366F1',
  ],
  pastel: [
    '#93C5FD',
    '#6EE7B7',
    '#FCD34D',
    '#FCA5A5',
    '#C4B5FD',
    '#F9A8D4',
    '#67E8F9',
    '#FDBA74',
    '#5EEAD4',
    '#A5B4FC',
  ],
  status: {
    passed: '#10B981',
    failed: '#EF4444',
    blocked: '#F59E0B',
    notExecuted: '#9CA3AF',
    inProgress: '#3B82F6',
  },
  severity: {
    critical: '#DC2626',
    high: '#EF4444',
    medium: '#F59E0B',
    low: '#10B981',
    trivial: '#6B7280',
  },
  trend: {
    positive: '#10B981',
    negative: '#EF4444',
    neutral: '#6B7280',
  },
};

export const DATE_FORMATS = {
  display: 'MM/DD/YYYY',
  input: 'YYYY-MM-DD',
  timestamp: 'YYYY-MM-DD HH:mm:ss',
  shortDisplay: 'MMM DD',
  monthYear: 'MMM YYYY',
};

export const PAGINATION_DEFAULTS = {
  pageSize: 10,
  pageSizeOptions: [10, 25, 50, 100],
};

export const AUDIT_ACTIONS = {
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',
  EXPORT: 'EXPORT',
  IMPORT: 'IMPORT',
  CONFIG_CHANGE: 'CONFIG_CHANGE',
};