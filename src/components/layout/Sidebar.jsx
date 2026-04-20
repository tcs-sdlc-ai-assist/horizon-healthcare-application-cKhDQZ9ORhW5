import { useState, useCallback, useMemo } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import PropTypes from 'prop-types';
import { useAuth } from '@/context/AuthContext';
import { useRoleGuard } from '@/hooks/useRoleGuard';
import { getExternalLink, EXTERNAL_SYSTEMS } from '@/utils/drillDownUtils';

/**
 * Navigation section configuration for each dashboard.
 * @type {Record<string, Array<{ label: string, path: string, icon: JSX.Element, requiredPermission?: string }>>}
 */
const DASHBOARD_SECTIONS = {
  devsecops: [
    {
      label: 'Overview',
      path: '/dashboards/devsecops',
      icon: (
        <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25a2.25 2.25 0 0 1-2.25-2.25v-2.25Z" />
        </svg>
      ),
    },
    {
      label: 'Maturity Assessment',
      path: '/dashboards/devsecops/maturity',
      icon: (
        <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
        </svg>
      ),
    },
    {
      label: 'Security Scans',
      path: '/dashboards/devsecops/security',
      icon: (
        <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
        </svg>
      ),
    },
    {
      label: 'Pipeline Metrics',
      path: '/dashboards/devsecops/pipeline',
      icon: (
        <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5" />
        </svg>
      ),
    },
  ],
  appdev: [
    {
      label: 'Overview',
      path: '/dashboards/appdev',
      icon: (
        <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25a2.25 2.25 0 0 1-2.25-2.25v-2.25Z" />
        </svg>
      ),
    },
    {
      label: 'DORA Metrics',
      path: '/dashboards/appdev/dora',
      icon: (
        <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5" />
        </svg>
      ),
    },
    {
      label: 'Reliability',
      path: '/dashboards/appdev/reliability',
      icon: (
        <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 0 1-1.043 3.296 3.745 3.745 0 0 1-3.296 1.043A3.745 3.745 0 0 1 12 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 0 1-3.296-1.043 3.745 3.745 0 0 1-1.043-3.296A3.745 3.745 0 0 1 3 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 0 1 1.043-3.296 3.746 3.746 0 0 1 3.296-1.043A3.746 3.746 0 0 1 12 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 0 1 3.296 1.043 3.746 3.746 0 0 1 1.043 3.296A3.745 3.745 0 0 1 21 12Z" />
        </svg>
      ),
    },
    {
      label: 'Tech Debt',
      path: '/dashboards/appdev/techdebt',
      icon: (
        <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
        </svg>
      ),
    },
    {
      label: 'Compliance',
      path: '/dashboards/appdev/compliance',
      icon: (
        <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.125 2.25h-4.5c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125v-9M10.125 2.25h.375a9 9 0 0 1 9 9v.375M10.125 2.25A3.375 3.375 0 0 1 13.5 5.625v1.5c0 .621.504 1.125 1.125 1.125h1.5a3.375 3.375 0 0 1 3.375 3.375M9 15l2.25 2.25L15 12" />
        </svg>
      ),
    },
  ],
  agile: [
    {
      label: 'Overview',
      path: '/dashboards/agile',
      icon: (
        <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25a2.25 2.25 0 0 1-2.25-2.25v-2.25Z" />
        </svg>
      ),
    },
    {
      label: 'Sprint Details',
      path: '/dashboards/agile/sprint',
      icon: (
        <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 0 1-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 0 0 6.16-12.12A14.98 14.98 0 0 0 9.631 8.41m5.96 5.96a14.926 14.926 0 0 1-5.841 2.58m-.119-8.54a6 6 0 0 0-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 0 0-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 0 1-2.448-2.448 14.9 14.9 0 0 1 .06-.312m-2.24 2.39a4.493 4.493 0 0 0-1.757 4.306 4.493 4.493 0 0 0 4.306-1.758M16.5 9a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z" />
        </svg>
      ),
    },
    {
      label: 'Velocity',
      path: '/dashboards/agile/velocity',
      icon: (
        <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941" />
        </svg>
      ),
    },
    {
      label: 'Flow Distribution',
      path: '/dashboards/agile/flow',
      icon: (
        <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6a7.5 7.5 0 1 0 7.5 7.5h-7.5V6Z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5H21A7.5 7.5 0 0 0 13.5 3v7.5Z" />
        </svg>
      ),
    },
    {
      label: 'Carry-Over',
      path: '/dashboards/agile/carryover',
      icon: (
        <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 0 0-3.7-3.7 48.678 48.678 0 0 0-7.324 0 4.006 4.006 0 0 0-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 0 0 3.7 3.7 48.656 48.656 0 0 0 7.324 0 4.006 4.006 0 0 0 3.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3-3 3" />
        </svg>
      ),
    },
  ],
};

/**
 * External tool links configuration.
 * @type {Array<{ label: string, system: string, icon: JSX.Element, description: string, requiresPermission?: string }>}
 */
const EXTERNAL_TOOLS = [
  {
    label: 'Jira Board',
    system: EXTERNAL_SYSTEMS.JIRA,
    resourceId: 'SCRUM',
    description: 'Sprint backlog & issues',
    icon: (
      <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
      </svg>
    ),
  },
  {
    label: 'qTest Manager',
    system: EXTERNAL_SYSTEMS.QTEST,
    resourceId: 'project',
    description: 'Test execution & results',
    icon: (
      <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
    ),
  },
  {
    label: 'SonarQube',
    system: EXTERNAL_SYSTEMS.SONARQUBE,
    resourceId: 'horizon-healthcare',
    description: 'Code quality & analysis',
    icon: (
      <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5" />
      </svg>
    ),
  },
  {
    label: 'Jenkins',
    system: EXTERNAL_SYSTEMS.JENKINS,
    resourceId: 'horizon-pipelines',
    description: 'CI/CD pipelines',
    icon: (
      <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 14.25h13.5m-13.5 0a3 3 0 0 1-3-3m3 3a3 3 0 1 0 0 6h13.5a3 3 0 1 0 0-6m-16.5-3a3 3 0 0 1 3-3h13.5a3 3 0 0 1 3 3m-19.5 0a4.5 4.5 0 0 1 .9-2.7L5.737 5.1a3.375 3.375 0 0 1 2.7-1.35h7.126c1.062 0 2.062.5 2.7 1.35l2.587 3.45a4.5 4.5 0 0 1 .9 2.7m0 0a3 3 0 0 1-3 3m0 3h.008v.008h-.008v-.008Zm0-6h.008v.008h-.008v-.008Zm-3 6h.008v.008h-.008v-.008Zm0-6h.008v.008h-.008v-.008Z" />
      </svg>
    ),
  },
  {
    label: 'GitHub',
    system: EXTERNAL_SYSTEMS.GITHUB,
    resourceId: 'horizon-healthcare-dashboards',
    description: 'Source code repository',
    icon: (
      <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 9.75 16.5 12l-2.25 2.25m-4.5 0L7.5 12l2.25-2.25M6 20.25h12A2.25 2.25 0 0 0 20.25 18V6A2.25 2.25 0 0 0 18 3.75H6A2.25 2.25 0 0 0 3.75 6v12A2.25 2.25 0 0 0 6 20.25Z" />
      </svg>
    ),
  },
  {
    label: 'ServiceNow',
    system: EXTERNAL_SYSTEMS.SERVICENOW,
    resourceId: 'incidents',
    description: 'Incident management',
    icon: (
      <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
      </svg>
    ),
  },
];

/**
 * Mock recent activity entries for the sidebar.
 * @type {Array<{ id: string, action: string, target: string, user: string, time: string }>}
 */
const RECENT_ACTIVITY = [
  {
    id: 'act-1',
    action: 'Updated',
    target: 'Sprint 12 metrics',
    user: 'Sarah Chen',
    time: '5 min ago',
  },
  {
    id: 'act-2',
    action: 'Imported',
    target: 'DORA metrics CSV',
    user: 'David Kim',
    time: '23 min ago',
  },
  {
    id: 'act-3',
    action: 'Exported',
    target: 'Security scan report',
    user: 'James Wilson',
    time: '1 hr ago',
  },
  {
    id: 'act-4',
    action: 'Edited',
    target: 'ClaimsEngine pass rate',
    user: 'Emily Johnson',
    time: '2 hrs ago',
  },
  {
    id: 'act-5',
    action: 'Deployed',
    target: 'MemberPortal v3.2.1',
    user: 'CI/CD Auto',
    time: '3 hrs ago',
  },
];

/**
 * Detects the active dashboard from the current URL path.
 * @param {string} pathname - The current URL pathname
 * @returns {string|null} The dashboard key or null
 */
function detectActiveDashboard(pathname) {
  if (!pathname || typeof pathname !== 'string') {
    return null;
  }

  const lower = pathname.toLowerCase();

  if (lower.includes('/dashboards/devsecops')) return 'devsecops';
  if (lower.includes('/dashboards/appdev')) return 'appdev';
  if (lower.includes('/dashboards/agile')) return 'agile';

  return null;
}

/**
 * SidebarNavLink — Individual navigation link with active state styling.
 * @param {object} props
 * @param {string} props.to - Route path
 * @param {JSX.Element} props.icon - Icon element
 * @param {string} props.label - Link label
 * @param {boolean} props.collapsed - Whether sidebar is collapsed
 * @returns {JSX.Element}
 */
function SidebarNavLink({ to, icon, label, collapsed }) {
  return (
    <NavLink
      to={to}
      end={to.split('/').length <= 3}
      className={({ isActive }) =>
        `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150 ${
          isActive
            ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-700/50 dark:hover:text-slate-200'
        }`
      }
      title={collapsed ? label : undefined}
    >
      <span className="flex-shrink-0">{icon}</span>
      {!collapsed && <span className="truncate">{label}</span>}
    </NavLink>
  );
}

SidebarNavLink.propTypes = {
  to: PropTypes.string.isRequired,
  icon: PropTypes.node.isRequired,
  label: PropTypes.string.isRequired,
  collapsed: PropTypes.bool.isRequired,
};

/**
 * ExternalToolLink — External link that opens in a new tab.
 * @param {object} props
 * @param {string} props.href - External URL
 * @param {JSX.Element} props.icon - Icon element
 * @param {string} props.label - Link label
 * @param {string} props.description - Short description
 * @param {boolean} props.collapsed - Whether sidebar is collapsed
 * @returns {JSX.Element}
 */
function ExternalToolLink({ href, icon, label, description, collapsed }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-600 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-700/50 dark:hover:text-slate-200"
      title={collapsed ? `${label} — ${description}` : description}
    >
      <span className="flex-shrink-0">{icon}</span>
      {!collapsed && (
        <span className="flex flex-1 items-center justify-between truncate">
          <span className="truncate">{label}</span>
          <svg
            className="ml-1 h-3 w-3 flex-shrink-0 text-slate-400 dark:text-slate-500"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
          </svg>
        </span>
      )}
    </a>
  );
}

ExternalToolLink.propTypes = {
  href: PropTypes.string.isRequired,
  icon: PropTypes.node.isRequired,
  label: PropTypes.string.isRequired,
  description: PropTypes.string.isRequired,
  collapsed: PropTypes.bool.isRequired,
};

/**
 * Sidebar — Optional sidebar navigation component for secondary navigation
 * within dashboards. Shows dashboard sub-sections, quick links to external
 * tools (Jira, qTest), and recent activity. Collapsible on tablet.
 * Consumes AuthContext for role-based link visibility.
 *
 * @param {object} props
 * @param {string} [props.activeDashboard] - Override for the active dashboard key ('devsecops', 'appdev', 'agile')
 * @param {string} [props.className] - Additional CSS classes for the wrapper
 * @returns {JSX.Element}
 */
export function Sidebar({ activeDashboard: activeDashboardProp, className }) {
  const [collapsed, setCollapsed] = useState(false);
  const [externalToolsExpanded, setExternalToolsExpanded] = useState(true);
  const [activityExpanded, setActivityExpanded] = useState(true);

  const { user } = useAuth();
  const { canExport, canViewAudit, isAuthenticated } = useRoleGuard();
  const location = useLocation();

  const activeDashboard = useMemo(() => {
    if (activeDashboardProp) {
      return activeDashboardProp;
    }
    return detectActiveDashboard(location.pathname);
  }, [activeDashboardProp, location.pathname]);

  const navSections = useMemo(() => {
    if (!activeDashboard || !DASHBOARD_SECTIONS[activeDashboard]) {
      return [];
    }
    return DASHBOARD_SECTIONS[activeDashboard];
  }, [activeDashboard]);

  const externalLinks = useMemo(() => {
    return EXTERNAL_TOOLS.map((tool) => {
      const href = getExternalLink(tool.system, tool.resourceId);
      return {
        ...tool,
        href: href || '#',
      };
    }).filter((tool) => tool.href !== '#');
  }, []);

  const visibleActivity = useMemo(() => {
    if (!canViewAudit) {
      return RECENT_ACTIVITY.slice(0, 3);
    }
    return RECENT_ACTIVITY;
  }, [canViewAudit]);

  const handleToggleCollapse = useCallback(() => {
    setCollapsed((prev) => !prev);
  }, []);

  const handleToggleExternalTools = useCallback(() => {
    setExternalToolsExpanded((prev) => !prev);
  }, []);

  const handleToggleActivity = useCallback(() => {
    setActivityExpanded((prev) => !prev);
  }, []);

  if (!isAuthenticated) {
    return null;
  }

  const dashboardLabel = activeDashboard
    ? {
        devsecops: 'DevSecOps',
        appdev: 'App Development',
        agile: 'Agile Flow',
      }[activeDashboard] || 'Dashboard'
    : 'Dashboard';

  return (
    <aside
      className={`flex flex-col border-r border-slate-200 bg-white transition-all duration-200 dark:border-slate-700 dark:bg-slate-800 ${
        collapsed ? 'w-16' : 'w-64'
      } ${className || ''}`}
    >
      {/* Sidebar Header */}
      <div className="flex items-center justify-between border-b border-slate-200 px-3 py-3 dark:border-slate-700">
        {!collapsed && (
          <div className="flex items-center gap-2 overflow-hidden">
            <svg
              className="h-5 w-5 flex-shrink-0 text-blue-600 dark:text-blue-400"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z"
              />
            </svg>
            <span className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
              {dashboardLabel}
            </span>
          </div>
        )}
        <button
          type="button"
          onClick={handleToggleCollapse}
          className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-300"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            </svg>
          ) : (
            <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
          )}
        </button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {/* Dashboard Navigation */}
        {navSections.length > 0 && (
          <nav className="px-2 py-3" aria-label="Dashboard navigation">
            {!collapsed && (
              <p className="mb-2 px-3 text-2xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Navigation
              </p>
            )}
            <div className="space-y-0.5">
              {navSections.map((section) => (
                <SidebarNavLink
                  key={section.path}
                  to={section.path}
                  icon={section.icon}
                  label={section.label}
                  collapsed={collapsed}
                />
              ))}
            </div>
          </nav>
        )}

        {/* Divider */}
        {navSections.length > 0 && (
          <div className="mx-3 border-t border-slate-200 dark:border-slate-700" />
        )}

        {/* External Tools */}
        <div className="px-2 py-3">
          {!collapsed ? (
            <button
              type="button"
              onClick={handleToggleExternalTools}
              className="mb-2 flex w-full items-center justify-between px-3"
            >
              <p className="text-2xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                External Tools
              </p>
              <svg
                className={`h-3 w-3 text-slate-400 transition-transform duration-200 dark:text-slate-500 ${
                  externalToolsExpanded ? 'rotate-0' : '-rotate-90'
                }`}
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
              </svg>
            </button>
          ) : null}
          {(collapsed || externalToolsExpanded) && (
            <div className="space-y-0.5">
              {externalLinks.map((tool) => (
                <ExternalToolLink
                  key={tool.system}
                  href={tool.href}
                  icon={tool.icon}
                  label={tool.label}
                  description={tool.description}
                  collapsed={collapsed}
                />
              ))}
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="mx-3 border-t border-slate-200 dark:border-slate-700" />

        {/* Recent Activity */}
        {!collapsed && (
          <div className="px-2 py-3">
            <button
              type="button"
              onClick={handleToggleActivity}
              className="mb-2 flex w-full items-center justify-between px-3"
            >
              <p className="text-2xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Recent Activity
              </p>
              <svg
                className={`h-3 w-3 text-slate-400 transition-transform duration-200 dark:text-slate-500 ${
                  activityExpanded ? 'rotate-0' : '-rotate-90'
                }`}
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
              </svg>
            </button>
            {activityExpanded && (
              <div className="space-y-1">
                {visibleActivity.map((activity) => (
                  <div
                    key={activity.id}
                    className="rounded-lg px-3 py-2 transition-colors duration-150 hover:bg-slate-50 dark:hover:bg-slate-700/30"
                  >
                    <div className="flex items-start gap-2">
                      <span className="mt-1 flex h-1.5 w-1.5 flex-shrink-0 rounded-full bg-blue-500" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs text-slate-700 dark:text-slate-300">
                          <span className="font-medium">{activity.action}</span>{' '}
                          {activity.target}
                        </p>
                        <p className="mt-0.5 text-2xs text-slate-400 dark:text-slate-500">
                          {activity.user} · {activity.time}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sidebar Footer — User Info */}
      {user && (
        <div className="border-t border-slate-200 px-3 py-3 dark:border-slate-700">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
              {user.avatar || user.name?.charAt(0) || '?'}
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                  {user.name}
                </p>
                <p className="truncate text-2xs text-slate-400 dark:text-slate-500">
                  {user.role}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}

Sidebar.propTypes = {
  activeDashboard: PropTypes.oneOf(['devsecops', 'appdev', 'agile']),
  className: PropTypes.string,
};

Sidebar.defaultProps = {
  activeDashboard: null,
  className: '',
};

export default Sidebar;