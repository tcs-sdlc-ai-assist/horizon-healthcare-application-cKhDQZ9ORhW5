import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { useRoleGuard } from '@/hooks/useRoleGuard';
import { useAuditLog } from '@/hooks/useAuditLog';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { StatusBadge } from '@/components/common/StatusBadge';
import { AUDIT_ACTIONS, LOCAL_STORAGE_KEYS, METRIC_DEFINITIONS, DEFAULT_DOMAINS } from '@/constants/constants';
import { getItem, setItem } from '@/services/storageService';

/**
 * Storage key for admin configuration data.
 * @type {string}
 */
const ADMIN_CONFIG_KEY = LOCAL_STORAGE_KEYS.HORIZON_ADMIN_CONFIG;

/**
 * Default admin configuration structure.
 * @returns {Object}
 */
function getDefaultConfig() {
  return {
    metrics: Object.values(METRIC_DEFINITIONS).map((m) => ({ ...m })),
    domains: DEFAULT_DOMAINS.map((d) => ({
      id: d.id,
      name: d.name,
      applications: d.applications.map((a) => ({ ...a })),
    })),
    editableFields: [
      { id: 'ef-001', entityType: 'sprintMetrics', field: 'committed', label: 'Committed Points', type: 'number', min: 0, max: 999, roles: ['Admin', 'QE Lead', 'Developer'] },
      { id: 'ef-002', entityType: 'sprintMetrics', field: 'done', label: 'Done Points', type: 'number', min: 0, max: 999, roles: ['Admin', 'QE Lead'] },
      { id: 'ef-003', entityType: 'applications', field: 'techStack', label: 'Tech Stack', type: 'text', roles: ['Admin', 'Developer'] },
      { id: 'ef-004', entityType: 'applications', field: 'tier', label: 'Application Tier', type: 'select', options: ['Tier 1', 'Tier 2', 'Tier 3'], roles: ['Admin'] },
      { id: 'ef-005', entityType: 'securityScanResults', field: 'passed', label: 'Scan Passed', type: 'select', options: ['true', 'false'], roles: ['Admin', 'QE Lead'] },
    ],
    containers: [
      { id: 'ctr-001', name: 'DevSecOps Overview', dashboard: 'devsecops', widgets: ['status-matrix', 'security-scans', 'pipeline-metrics'], layout: 'grid-3' },
      { id: 'ctr-002', name: 'App Development Overview', dashboard: 'appdev', widgets: ['dora-metrics', 'tech-debt-heatmap', 'reliability-chart'], layout: 'grid-3' },
      { id: 'ctr-003', name: 'Agile Flow Overview', dashboard: 'agile', widgets: ['sprint-summary', 'velocity-chart', 'flow-distribution'], layout: 'grid-3' },
    ],
  };
}

/**
 * Reads admin config from localStorage, falling back to defaults.
 * @returns {Object}
 */
function readConfig() {
  const stored = getItem(ADMIN_CONFIG_KEY, null);
  if (stored && typeof stored === 'object' && stored.metrics) {
    return stored;
  }
  return getDefaultConfig();
}

/**
 * Writes admin config to localStorage.
 * @param {Object} config
 */
function writeConfig(config) {
  setItem(ADMIN_CONFIG_KEY, config);
}

/**
 * Generates a unique ID for a new entity.
 * @param {string} prefix
 * @returns {string}
 */
function generateId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`;
}

/**
 * Tab configuration for the admin page.
 * @type {Array<{ key: string, label: string, icon: JSX.Element }>}
 */
const TABS = [
  {
    key: 'metrics',
    label: 'Metrics',
    icon: (
      <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
      </svg>
    ),
  },
  {
    key: 'domains',
    label: 'Domains & Apps',
    icon: (
      <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3H21m-3.75 3H21" />
      </svg>
    ),
  },
  {
    key: 'editableFields',
    label: 'Editable Fields',
    icon: (
      <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
      </svg>
    ),
  },
  {
    key: 'containers',
    label: 'Containers',
    icon: (
      <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25a2.25 2.25 0 0 1-2.25-2.25v-2.25Z" />
      </svg>
    ),
  },
];

/**
 * Inline confirmation dialog component.
 */
function ConfirmDialog({ message, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-lg dark:border-slate-700 dark:bg-slate-800">
        <div className="mb-4 flex items-start gap-3">
          <svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
          </svg>
          <div>
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Confirm Action</h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{message}</p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2">
          <button type="button" onClick={onCancel} className="btn-secondary text-xs">
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="inline-flex items-center justify-center rounded-lg bg-red-600 px-4 py-2 text-xs font-medium text-white shadow-sm transition-all duration-200 hover:bg-red-700"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * MetricsTab — Manage metric definitions.
 */
function MetricsTab({ config, onUpdate, logChange }) {
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ key: '', label: '', description: '', unit: 'count' });
  const [isAdding, setIsAdding] = useState(false);
  const [deleteId, setDeleteId] = useState(null);

  const handleStartAdd = useCallback(() => {
    setFormData({ key: '', label: '', description: '', unit: 'count' });
    setIsAdding(true);
    setEditingId(null);
  }, []);

  const handleStartEdit = useCallback((metric) => {
    setFormData({ key: metric.key, label: metric.label, description: metric.description || '', unit: metric.unit || 'count' });
    setEditingId(metric.key);
    setIsAdding(false);
  }, []);

  const handleCancel = useCallback(() => {
    setIsAdding(false);
    setEditingId(null);
    setFormData({ key: '', label: '', description: '', unit: 'count' });
  }, []);

  const handleSave = useCallback(() => {
    if (!formData.key.trim() || !formData.label.trim()) return;

    const updated = { ...config };
    if (isAdding) {
      const exists = updated.metrics.some((m) => m.key === formData.key.trim());
      if (exists) return;
      updated.metrics = [...updated.metrics, { key: formData.key.trim(), label: formData.label.trim(), description: formData.description.trim(), unit: formData.unit }];
      logChange(AUDIT_ACTIONS.CREATE, {
        fieldName: 'metrics',
        oldValue: null,
        newValue: formData.key.trim(),
        entityType: 'admin_config',
        entityId: formData.key.trim(),
        description: `Added metric definition "${formData.label.trim()}"`,
      });
    } else if (editingId) {
      const idx = updated.metrics.findIndex((m) => m.key === editingId);
      if (idx !== -1) {
        const oldMetric = updated.metrics[idx];
        updated.metrics = [...updated.metrics];
        updated.metrics[idx] = { key: formData.key.trim(), label: formData.label.trim(), description: formData.description.trim(), unit: formData.unit };
        logChange(AUDIT_ACTIONS.UPDATE, {
          fieldName: 'metrics',
          oldValue: oldMetric,
          newValue: updated.metrics[idx],
          entityType: 'admin_config',
          entityId: editingId,
          description: `Updated metric definition "${formData.label.trim()}"`,
        });
      }
    }
    onUpdate(updated);
    handleCancel();
  }, [config, formData, isAdding, editingId, onUpdate, logChange, handleCancel]);

  const handleDelete = useCallback((key) => {
    const updated = { ...config };
    const metric = updated.metrics.find((m) => m.key === key);
    updated.metrics = updated.metrics.filter((m) => m.key !== key);
    onUpdate(updated);
    logChange(AUDIT_ACTIONS.DELETE, {
      fieldName: 'metrics',
      oldValue: metric,
      newValue: null,
      entityType: 'admin_config',
      entityId: key,
      description: `Deleted metric definition "${metric?.label || key}"`,
    });
    setDeleteId(null);
  }, [config, onUpdate, logChange]);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">Metric Definitions</h3>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{config.metrics.length} metrics configured</p>
        </div>
        <button type="button" onClick={handleStartAdd} className="btn-primary text-xs" disabled={isAdding}>
          <svg className="mr-1 h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add Metric
        </button>
      </div>

      {(isAdding || editingId) && (
        <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
          <h4 className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-100">
            {isAdding ? 'Add New Metric' : 'Edit Metric'}
          </h4>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Key *</label>
              <input
                type="text"
                value={formData.key}
                onChange={(e) => setFormData((prev) => ({ ...prev, key: e.target.value }))}
                placeholder="e.g. passRate"
                disabled={!!editingId}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Label *</label>
              <input
                type="text"
                value={formData.label}
                onChange={(e) => setFormData((prev) => ({ ...prev, label: e.target.value }))}
                placeholder="e.g. Pass Rate"
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Unit</label>
              <select
                value={formData.unit}
                onChange={(e) => setFormData((prev) => ({ ...prev, unit: e.target.value }))}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="count">Count</option>
                <option value="percentage">Percentage</option>
                <option value="hours">Hours</option>
                <option value="days">Days</option>
                <option value="ms">Milliseconds</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Description</label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Brief description"
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button type="button" onClick={handleSave} disabled={!formData.key.trim() || !formData.label.trim()} className="btn-primary text-xs disabled:cursor-not-allowed disabled:opacity-50">
              Save
            </button>
            <button type="button" onClick={handleCancel} className="btn-secondary text-xs">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full min-w-[600px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700">
              <th className="px-4 py-2.5 text-left font-semibold text-slate-700 dark:text-slate-300">Key</th>
              <th className="px-4 py-2.5 text-left font-semibold text-slate-700 dark:text-slate-300">Label</th>
              <th className="px-4 py-2.5 text-left font-semibold text-slate-700 dark:text-slate-300">Unit</th>
              <th className="px-4 py-2.5 text-left font-semibold text-slate-700 dark:text-slate-300">Description</th>
              <th className="px-4 py-2.5 text-right font-semibold text-slate-700 dark:text-slate-300">Actions</th>
            </tr>
          </thead>
          <tbody>
            {config.metrics.map((metric) => (
              <tr key={metric.key} className="border-b border-slate-100 transition-colors hover:bg-slate-50 dark:border-slate-700/50 dark:hover:bg-slate-700/20">
                <td className="px-4 py-2.5 font-mono text-xs text-slate-800 dark:text-slate-200">{metric.key}</td>
                <td className="px-4 py-2.5 text-slate-800 dark:text-slate-200">{metric.label}</td>
                <td className="px-4 py-2.5">
                  <StatusBadge status={metric.unit === 'percentage' ? 'success' : metric.unit === 'count' ? 'pending' : 'warning'} label={metric.unit} size="sm" showIcon={false} showDot />
                </td>
                <td className="px-4 py-2.5 text-xs text-slate-500 dark:text-slate-400">{metric.description || '—'}</td>
                <td className="px-4 py-2.5 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button type="button" onClick={() => handleStartEdit(metric)} className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-blue-600 dark:hover:bg-slate-700 dark:hover:text-blue-400" title="Edit">
                      <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
                      </svg>
                    </button>
                    <button type="button" onClick={() => setDeleteId(metric.key)} className="rounded p-1 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400" title="Delete">
                      <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {config.metrics.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">No metrics defined.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {deleteId && (
        <ConfirmDialog
          message={`Are you sure you want to delete the metric "${deleteId}"? This action cannot be undone.`}
          onConfirm={() => handleDelete(deleteId)}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  );
}

/**
 * DomainsTab — Manage domains and their applications.
 */
function DomainsTab({ config, onUpdate, logChange }) {
  const [editingDomainId, setEditingDomainId] = useState(null);
  const [domainForm, setDomainForm] = useState({ name: '' });
  const [isAddingDomain, setIsAddingDomain] = useState(false);
  const [deleteDomainId, setDeleteDomainId] = useState(null);
  const [addingAppToDomain, setAddingAppToDomain] = useState(null);
  const [appForm, setAppForm] = useState({ name: '' });
  const [deleteAppInfo, setDeleteAppInfo] = useState(null);

  const handleStartAddDomain = useCallback(() => {
    setDomainForm({ name: '' });
    setIsAddingDomain(true);
    setEditingDomainId(null);
  }, []);

  const handleStartEditDomain = useCallback((domain) => {
    setDomainForm({ name: domain.name });
    setEditingDomainId(domain.id);
    setIsAddingDomain(false);
  }, []);

  const handleCancelDomain = useCallback(() => {
    setIsAddingDomain(false);
    setEditingDomainId(null);
    setDomainForm({ name: '' });
  }, []);

  const handleSaveDomain = useCallback(() => {
    if (!domainForm.name.trim()) return;
    const updated = { ...config };

    if (isAddingDomain) {
      const newId = generateId('dom');
      updated.domains = [...updated.domains, { id: newId, name: domainForm.name.trim(), applications: [] }];
      logChange(AUDIT_ACTIONS.CREATE, {
        fieldName: 'domains',
        oldValue: null,
        newValue: domainForm.name.trim(),
        entityType: 'admin_config',
        entityId: newId,
        description: `Added domain "${domainForm.name.trim()}"`,
      });
    } else if (editingDomainId) {
      const idx = updated.domains.findIndex((d) => d.id === editingDomainId);
      if (idx !== -1) {
        const oldName = updated.domains[idx].name;
        updated.domains = [...updated.domains];
        updated.domains[idx] = { ...updated.domains[idx], name: domainForm.name.trim() };
        logChange(AUDIT_ACTIONS.UPDATE, {
          fieldName: 'domains',
          oldValue: oldName,
          newValue: domainForm.name.trim(),
          entityType: 'admin_config',
          entityId: editingDomainId,
          description: `Renamed domain from "${oldName}" to "${domainForm.name.trim()}"`,
        });
      }
    }
    onUpdate(updated);
    handleCancelDomain();
  }, [config, domainForm, isAddingDomain, editingDomainId, onUpdate, logChange, handleCancelDomain]);

  const handleDeleteDomain = useCallback((domainId) => {
    const updated = { ...config };
    const domain = updated.domains.find((d) => d.id === domainId);
    updated.domains = updated.domains.filter((d) => d.id !== domainId);
    onUpdate(updated);
    logChange(AUDIT_ACTIONS.DELETE, {
      fieldName: 'domains',
      oldValue: domain,
      newValue: null,
      entityType: 'admin_config',
      entityId: domainId,
      description: `Deleted domain "${domain?.name || domainId}"`,
    });
    setDeleteDomainId(null);
  }, [config, onUpdate, logChange]);

  const handleAddApp = useCallback((domainId) => {
    if (!appForm.name.trim()) return;
    const updated = { ...config };
    const idx = updated.domains.findIndex((d) => d.id === domainId);
    if (idx === -1) return;
    const newAppId = generateId('app');
    updated.domains = [...updated.domains];
    updated.domains[idx] = {
      ...updated.domains[idx],
      applications: [...updated.domains[idx].applications, { id: newAppId, name: appForm.name.trim() }],
    };
    onUpdate(updated);
    logChange(AUDIT_ACTIONS.CREATE, {
      fieldName: 'applications',
      oldValue: null,
      newValue: appForm.name.trim(),
      entityType: 'admin_config',
      entityId: newAppId,
      description: `Added application "${appForm.name.trim()}" to domain "${updated.domains[idx].name}"`,
    });
    setAppForm({ name: '' });
    setAddingAppToDomain(null);
  }, [config, appForm, onUpdate, logChange]);

  const handleDeleteApp = useCallback((domainId, appId) => {
    const updated = { ...config };
    const domIdx = updated.domains.findIndex((d) => d.id === domainId);
    if (domIdx === -1) return;
    const app = updated.domains[domIdx].applications.find((a) => a.id === appId);
    updated.domains = [...updated.domains];
    updated.domains[domIdx] = {
      ...updated.domains[domIdx],
      applications: updated.domains[domIdx].applications.filter((a) => a.id !== appId),
    };
    onUpdate(updated);
    logChange(AUDIT_ACTIONS.DELETE, {
      fieldName: 'applications',
      oldValue: app,
      newValue: null,
      entityType: 'admin_config',
      entityId: appId,
      description: `Deleted application "${app?.name || appId}" from domain "${updated.domains[domIdx].name}"`,
    });
    setDeleteAppInfo(null);
  }, [config, onUpdate, logChange]);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">Domains & Applications</h3>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            {config.domains.length} domains, {config.domains.reduce((sum, d) => sum + d.applications.length, 0)} applications
          </p>
        </div>
        <button type="button" onClick={handleStartAddDomain} className="btn-primary text-xs" disabled={isAddingDomain}>
          <svg className="mr-1 h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add Domain
        </button>
      </div>

      {(isAddingDomain || editingDomainId) && (
        <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
          <h4 className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-100">
            {isAddingDomain ? 'Add New Domain' : 'Edit Domain'}
          </h4>
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Domain Name *</label>
              <input
                type="text"
                value={domainForm.name}
                onChange={(e) => setDomainForm({ name: e.target.value })}
                placeholder="e.g. Pharmacy Benefits"
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
            <button type="button" onClick={handleSaveDomain} disabled={!domainForm.name.trim()} className="btn-primary text-xs disabled:cursor-not-allowed disabled:opacity-50">
              Save
            </button>
            <button type="button" onClick={handleCancelDomain} className="btn-secondary text-xs">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {config.domains.map((domain) => (
          <div key={domain.id} className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-blue-500" />
                <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{domain.name}</h4>
                <span className="text-xs text-slate-400 dark:text-slate-500">({domain.applications.length} apps)</span>
              </div>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => setAddingAppToDomain(addingAppToDomain === domain.id ? null : domain.id)} className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-green-600 dark:hover:bg-slate-700 dark:hover:text-green-400" title="Add application">
                  <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                </button>
                <button type="button" onClick={() => handleStartEditDomain(domain)} className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-blue-600 dark:hover:bg-slate-700 dark:hover:text-blue-400" title="Edit domain">
                  <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
                  </svg>
                </button>
                <button type="button" onClick={() => setDeleteDomainId(domain.id)} className="rounded p-1 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400" title="Delete domain">
                  <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                  </svg>
                </button>
              </div>
            </div>

            {addingAppToDomain === domain.id && (
              <div className="mb-3 flex items-end gap-2 rounded-md border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-900/20">
                <div className="flex-1">
                  <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Application Name *</label>
                  <input
                    type="text"
                    value={appForm.name}
                    onChange={(e) => setAppForm({ name: e.target.value })}
                    placeholder="e.g. ClaimsEngine"
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
                <button type="button" onClick={() => handleAddApp(domain.id)} disabled={!appForm.name.trim()} className="btn-primary text-xs disabled:cursor-not-allowed disabled:opacity-50">
                  Add
                </button>
                <button type="button" onClick={() => { setAddingAppToDomain(null); setAppForm({ name: '' }); }} className="btn-secondary text-xs">
                  Cancel
                </button>
              </div>
            )}

            {domain.applications.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {domain.applications.map((app) => (
                  <div key={app.id} className="group flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300">
                    <span>{app.name}</span>
                    <button
                      type="button"
                      onClick={() => setDeleteAppInfo({ domainId: domain.id, appId: app.id, appName: app.name, domainName: domain.name })}
                      className="hidden rounded-full p-0.5 text-slate-400 transition-colors hover:bg-red-100 hover:text-red-600 group-hover:inline-flex dark:hover:bg-red-900/30 dark:hover:text-red-400"
                      title={`Remove ${app.name}`}
                    >
                      <svg className="h-3 w-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 dark:text-slate-500">No applications in this domain.</p>
            )}
          </div>
        ))}
        {config.domains.length === 0 && (
          <div className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">No domains configured.</div>
        )}
      </div>

      {deleteDomainId && (
        <ConfirmDialog
          message={`Are you sure you want to delete this domain and all its applications? This action cannot be undone.`}
          onConfirm={() => handleDeleteDomain(deleteDomainId)}
          onCancel={() => setDeleteDomainId(null)}
        />
      )}
      {deleteAppInfo && (
        <ConfirmDialog
          message={`Remove "${deleteAppInfo.appName}" from "${deleteAppInfo.domainName}"?`}
          onConfirm={() => handleDeleteApp(deleteAppInfo.domainId, deleteAppInfo.appId)}
          onCancel={() => setDeleteAppInfo(null)}
        />
      )}
    </div>
  );
}

/**
 * EditableFieldsTab — Manage editable field configurations.
 */
function EditableFieldsTab({ config, onUpdate, logChange }) {
  const [editingId, setEditingId] = useState(null);
  const [isAdding, setIsAdding] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [formData, setFormData] = useState({
    entityType: 'applications',
    field: '',
    label: '',
    type: 'text',
    min: '',
    max: '',
    options: '',
    roles: '',
  });

  const handleStartAdd = useCallback(() => {
    setFormData({ entityType: 'applications', field: '', label: '', type: 'text', min: '', max: '', options: '', roles: 'Admin' });
    setIsAdding(true);
    setEditingId(null);
  }, []);

  const handleStartEdit = useCallback((ef) => {
    setFormData({
      entityType: ef.entityType || '',
      field: ef.field || '',
      label: ef.label || '',
      type: ef.type || 'text',
      min: ef.min !== undefined ? String(ef.min) : '',
      max: ef.max !== undefined ? String(ef.max) : '',
      options: Array.isArray(ef.options) ? ef.options.join(', ') : '',
      roles: Array.isArray(ef.roles) ? ef.roles.join(', ') : '',
    });
    setEditingId(ef.id);
    setIsAdding(false);
  }, []);

  const handleCancel = useCallback(() => {
    setIsAdding(false);
    setEditingId(null);
  }, []);

  const handleSave = useCallback(() => {
    if (!formData.field.trim() || !formData.label.trim()) return;

    const updated = { ...config };
    const entry = {
      entityType: formData.entityType.trim(),
      field: formData.field.trim(),
      label: formData.label.trim(),
      type: formData.type,
      roles: formData.roles.split(',').map((r) => r.trim()).filter(Boolean),
    };
    if (formData.type === 'number') {
      if (formData.min !== '') entry.min = Number(formData.min);
      if (formData.max !== '') entry.max = Number(formData.max);
    }
    if (formData.type === 'select' && formData.options.trim()) {
      entry.options = formData.options.split(',').map((o) => o.trim()).filter(Boolean);
    }

    if (isAdding) {
      const newId = generateId('ef');
      updated.editableFields = [...(updated.editableFields || []), { id: newId, ...entry }];
      logChange(AUDIT_ACTIONS.CREATE, {
        fieldName: 'editableFields',
        oldValue: null,
        newValue: entry,
        entityType: 'admin_config',
        entityId: newId,
        description: `Added editable field config "${formData.label.trim()}"`,
      });
    } else if (editingId) {
      const idx = (updated.editableFields || []).findIndex((ef) => ef.id === editingId);
      if (idx !== -1) {
        const old = updated.editableFields[idx];
        updated.editableFields = [...updated.editableFields];
        updated.editableFields[idx] = { id: editingId, ...entry };
        logChange(AUDIT_ACTIONS.UPDATE, {
          fieldName: 'editableFields',
          oldValue: old,
          newValue: updated.editableFields[idx],
          entityType: 'admin_config',
          entityId: editingId,
          description: `Updated editable field config "${formData.label.trim()}"`,
        });
      }
    }
    onUpdate(updated);
    handleCancel();
  }, [config, formData, isAdding, editingId, onUpdate, logChange, handleCancel]);

  const handleDelete = useCallback((id) => {
    const updated = { ...config };
    const ef = (updated.editableFields || []).find((e) => e.id === id);
    updated.editableFields = (updated.editableFields || []).filter((e) => e.id !== id);
    onUpdate(updated);
    logChange(AUDIT_ACTIONS.DELETE, {
      fieldName: 'editableFields',
      oldValue: ef,
      newValue: null,
      entityType: 'admin_config',
      entityId: id,
      description: `Deleted editable field config "${ef?.label || id}"`,
    });
    setDeleteId(null);
  }, [config, onUpdate, logChange]);

  const editableFields = config.editableFields || [];

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">Editable Field Configurations</h3>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{editableFields.length} field configs</p>
        </div>
        <button type="button" onClick={handleStartAdd} className="btn-primary text-xs" disabled={isAdding}>
          <svg className="mr-1 h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add Field Config
        </button>
      </div>

      {(isAdding || editingId) && (
        <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
          <h4 className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-100">
            {isAdding ? 'Add Editable Field Config' : 'Edit Field Config'}
          </h4>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Entity Type *</label>
              <select
                value={formData.entityType}
                onChange={(e) => setFormData((prev) => ({ ...prev, entityType: e.target.value }))}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="applications">Applications</option>
                <option value="sprintMetrics">Sprint Metrics</option>
                <option value="doraMetrics">DORA Metrics</option>
                <option value="techDebtMetrics">Tech Debt</option>
                <option value="securityScanResults">Security Scans</option>
                <option value="reliabilityMetrics">Reliability</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Field Name *</label>
              <input
                type="text"
                value={formData.field}
                onChange={(e) => setFormData((prev) => ({ ...prev, field: e.target.value }))}
                placeholder="e.g. techStack"
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Display Label *</label>
              <input
                type="text"
                value={formData.label}
                onChange={(e) => setFormData((prev) => ({ ...prev, label: e.target.value }))}
                placeholder="e.g. Tech Stack"
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Input Type</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData((prev) => ({ ...prev, type: e.target.value }))}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="text">Text</option>
                <option value="number">Number</option>
                <option value="select">Select</option>
              </select>
            </div>
            {formData.type === 'number' && (
              <>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Min</label>
                  <input
                    type="number"
                    value={formData.min}
                    onChange={(e) => setFormData((prev) => ({ ...prev, min: e.target.value }))}
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Max</label>
                  <input
                    type="number"
                    value={formData.max}
                    onChange={(e) => setFormData((prev) => ({ ...prev, max: e.target.value }))}
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
              </>
            )}
            {formData.type === 'select' && (
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Options (comma-separated)</label>
                <input
                  type="text"
                  value={formData.options}
                  onChange={(e) => setFormData((prev) => ({ ...prev, options: e.target.value }))}
                  placeholder="e.g. Tier 1, Tier 2, Tier 3"
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
            )}
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Allowed Roles (comma-separated)</label>
              <input
                type="text"
                value={formData.roles}
                onChange={(e) => setFormData((prev) => ({ ...prev, roles: e.target.value }))}
                placeholder="e.g. Admin, QE Lead, Developer"
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button type="button" onClick={handleSave} disabled={!formData.field.trim() || !formData.label.trim()} className="btn-primary text-xs disabled:cursor-not-allowed disabled:opacity-50">
              Save
            </button>
            <button type="button" onClick={handleCancel} className="btn-secondary text-xs">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full min-w-[700px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700">
              <th className="px-4 py-2.5 text-left font-semibold text-slate-700 dark:text-slate-300">Entity Type</th>
              <th className="px-4 py-2.5 text-left font-semibold text-slate-700 dark:text-slate-300">Field</th>
              <th className="px-4 py-2.5 text-left font-semibold text-slate-700 dark:text-slate-300">Label</th>
              <th className="px-4 py-2.5 text-left font-semibold text-slate-700 dark:text-slate-300">Type</th>
              <th className="px-4 py-2.5 text-left font-semibold text-slate-700 dark:text-slate-300">Roles</th>
              <th className="px-4 py-2.5 text-right font-semibold text-slate-700 dark:text-slate-300">Actions</th>
            </tr>
          </thead>
          <tbody>
            {editableFields.map((ef) => (
              <tr key={ef.id} className="border-b border-slate-100 transition-colors hover:bg-slate-50 dark:border-slate-700/50 dark:hover:bg-slate-700/20">
                <td className="px-4 py-2.5 font-mono text-xs text-slate-600 dark:text-slate-400">{ef.entityType}</td>
                <td className="px-4 py-2.5 font-mono text-xs text-slate-800 dark:text-slate-200">{ef.field}</td>
                <td className="px-4 py-2.5 text-slate-800 dark:text-slate-200">{ef.label}</td>
                <td className="px-4 py-2.5">
                  <StatusBadge status={ef.type === 'number' ? 'warning' : ef.type === 'select' ? 'success' : 'pending'} label={ef.type} size="sm" showIcon={false} showDot />
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex flex-wrap gap-1">
                    {(ef.roles || []).map((role) => (
                      <span key={role} className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-2xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                        {role}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button type="button" onClick={() => handleStartEdit(ef)} className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-blue-600 dark:hover:bg-slate-700 dark:hover:text-blue-400" title="Edit">
                      <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
                      </svg>
                    </button>
                    <button type="button" onClick={() => setDeleteId(ef.id)} className="rounded p-1 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400" title="Delete">
                      <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {editableFields.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">No editable field configurations.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {deleteId && (
        <ConfirmDialog
          message="Are you sure you want to delete this editable field configuration?"
          onConfirm={() => handleDelete(deleteId)}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  );
}

/**
 * ContainersTab — Manage container/widget layout definitions.
 */
function ContainersTab({ config, onUpdate, logChange }) {
  const [editingId, setEditingId] = useState(null);
  const [isAdding, setIsAdding] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [formData, setFormData] = useState({ name: '', dashboard: 'devsecops', widgets: '', layout: 'grid-3' });

  const handleStartAdd = useCallback(() => {
    setFormData({ name: '', dashboard: 'devsecops', widgets: '', layout: 'grid-3' });
    setIsAdding(true);
    setEditingId(null);
  }, []);

  const handleStartEdit = useCallback((ctr) => {
    setFormData({
      name: ctr.name || '',
      dashboard: ctr.dashboard || 'devsecops',
      widgets: Array.isArray(ctr.widgets) ? ctr.widgets.join(', ') : '',
      layout: ctr.layout || 'grid-3',
    });
    setEditingId(ctr.id);
    setIsAdding(false);
  }, []);

  const handleCancel = useCallback(() => {
    setIsAdding(false);
    setEditingId(null);
  }, []);

  const handleSave = useCallback(() => {
    if (!formData.name.trim()) return;
    const updated = { ...config };
    const entry = {
      name: formData.name.trim(),
      dashboard: formData.dashboard,
      widgets: formData.widgets.split(',').map((w) => w.trim()).filter(Boolean),
      layout: formData.layout,
    };

    if (isAdding) {
      const newId = generateId('ctr');
      updated.containers = [...(updated.containers || []), { id: newId, ...entry }];
      logChange(AUDIT_ACTIONS.CREATE, {
        fieldName: 'containers',
        oldValue: null,
        newValue: entry,
        entityType: 'admin_config',
        entityId: newId,
        description: `Added container "${formData.name.trim()}"`,
      });
    } else if (editingId) {
      const idx = (updated.containers || []).findIndex((c) => c.id === editingId);
      if (idx !== -1) {
        const old = updated.containers[idx];
        updated.containers = [...updated.containers];
        updated.containers[idx] = { id: editingId, ...entry };
        logChange(AUDIT_ACTIONS.UPDATE, {
          fieldName: 'containers',
          oldValue: old,
          newValue: updated.containers[idx],
          entityType: 'admin_config',
          entityId: editingId,
          description: `Updated container "${formData.name.trim()}"`,
        });
      }
    }
    onUpdate(updated);
    handleCancel();
  }, [config, formData, isAdding, editingId, onUpdate, logChange, handleCancel]);

  const handleDelete = useCallback((id) => {
    const updated = { ...config };
    const ctr = (updated.containers || []).find((c) => c.id === id);
    updated.containers = (updated.containers || []).filter((c) => c.id !== id);
    onUpdate(updated);
    logChange(AUDIT_ACTIONS.DELETE, {
      fieldName: 'containers',
      oldValue: ctr,
      newValue: null,
      entityType: 'admin_config',
      entityId: id,
      description: `Deleted container "${ctr?.name || id}"`,
    });
    setDeleteId(null);
  }, [config, onUpdate, logChange]);

  const containers = config.containers || [];

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">Container Definitions</h3>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{containers.length} containers configured</p>
        </div>
        <button type="button" onClick={handleStartAdd} className="btn-primary text-xs" disabled={isAdding}>
          <svg className="mr-1 h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add Container
        </button>
      </div>

      {(isAdding || editingId) && (
        <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
          <h4 className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-100">
            {isAdding ? 'Add New Container' : 'Edit Container'}
          </h4>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. DevSecOps Overview"
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Dashboard</label>
              <select
                value={formData.dashboard}
                onChange={(e) => setFormData((prev) => ({ ...prev, dashboard: e.target.value }))}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="devsecops">DevSecOps</option>
                <option value="appdev">App Development</option>
                <option value="agile">Agile Flow</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Layout</label>
              <select
                value={formData.layout}
                onChange={(e) => setFormData((prev) => ({ ...prev, layout: e.target.value }))}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="grid-2">2-Column Grid</option>
                <option value="grid-3">3-Column Grid</option>
                <option value="grid-4">4-Column Grid</option>
                <option value="stack">Stacked</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Widgets (comma-separated)</label>
              <input
                type="text"
                value={formData.widgets}
                onChange={(e) => setFormData((prev) => ({ ...prev, widgets: e.target.value }))}
                placeholder="e.g. status-matrix, security-scans"
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button type="button" onClick={handleSave} disabled={!formData.name.trim()} className="btn-primary text-xs disabled:cursor-not-allowed disabled:opacity-50">
              Save
            </button>
            <button type="button" onClick={handleCancel} className="btn-secondary text-xs">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {containers.map((ctr) => (
          <div key={ctr.id} className="rounded-lg border border-slate-200 bg-white p-4 transition-shadow hover:shadow-md dark:border-slate-700 dark:bg-slate-800">
            <div className="mb-2 flex items-start justify-between">
              <div>
                <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{ctr.name}</h4>
                <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-2xs font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-400">
                  {ctr.dashboard}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => handleStartEdit(ctr)} className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-blue-600 dark:hover:bg-slate-700 dark:hover:text-blue-400" title="Edit">
                  <svg className="h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
                  </svg>
                </button>
                <button type="button" onClick={() => setDeleteId(ctr.id)} className="rounded p-1 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400" title="Delete">
                  <svg className="h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="mb-2 text-xs text-slate-500 dark:text-slate-400">
              Layout: <span className="font-medium text-slate-700 dark:text-slate-300">{ctr.layout}</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {(ctr.widgets || []).map((widget) => (
                <span key={widget} className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-2xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                  {widget}
                </span>
              ))}
              {(!ctr.widgets || ctr.widgets.length === 0) && (
                <span className="text-2xs text-slate-400">No widgets</span>
              )}
            </div>
          </div>
        ))}
        {containers.length === 0 && (
          <div className="col-span-full py-8 text-center text-sm text-slate-500 dark:text-slate-400">No containers configured.</div>
        )}
      </div>

      {deleteId && (
        <ConfirmDialog
          message="Are you sure you want to delete this container definition?"
          onConfirm={() => handleDelete(deleteId)}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  );
}

/**
 * AdminConfigPage — Admin configuration page for managing metrics definitions,
 * editable field configurations, application/domain mappings, and container definitions.
 * RBAC-gated to Admin role only.
 *
 * @returns {JSX.Element}
 */
export default function AdminConfigPage() {
  const { user } = useAuth();
  const { isAdmin, canConfigure, isAuthenticated } = useRoleGuard();
  const { logChange } = useAuditLog();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('metrics');
  const [config, setConfig] = useState(() => readConfig());
  const [saveStatus, setSaveStatus] = useState(null);
  const saveTimeoutRef = useRef(null);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  const handleUpdateConfig = useCallback((updatedConfig) => {
    setConfig(updatedConfig);
    writeConfig(updatedConfig);
    setSaveStatus('saved');
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      setSaveStatus(null);
    }, 2000);
  }, []);

  const handleResetToDefaults = useCallback(() => {
    const defaults = getDefaultConfig();
    setConfig(defaults);
    writeConfig(defaults);
    logChange(AUDIT_ACTIONS.CONFIG_CHANGE, {
      fieldName: 'admin_config',
      oldValue: 'custom',
      newValue: 'defaults',
      entityType: 'admin_config',
      entityId: 'all',
      description: 'Reset admin configuration to defaults',
    });
    setSaveStatus('reset');
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      setSaveStatus(null);
    }, 2000);
  }, [logChange]);

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-900">
        <LoadingSpinner message="Checking authentication..." size="lg" />
      </div>
    );
  }

  if (!isAdmin && !canConfigure) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 dark:bg-slate-900">
        <div className="max-w-md w-full text-center space-y-6">
          <svg className="mx-auto h-16 w-16 text-red-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Access Denied</h1>
            <p className="text-base text-slate-600 dark:text-slate-400">
              Only administrators can access the configuration page.
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-slate-700 dark:text-slate-300">Your Role:</span>
              <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                {user?.role || 'Unknown'}
              </span>
            </div>
          </div>
          <div className="flex items-center justify-center gap-3">
            <button type="button" onClick={() => navigate(-1)} className="btn-secondary">
              Go Back
            </button>
            <button type="button" onClick={() => navigate('/')} className="btn-primary">
              Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <DashboardLayout
      title="Admin Configuration"
      description="Manage metrics, domains, editable fields, and container definitions"
      showFilterBar={false}
      showSidebar={false}
      showExport={false}
    >
      <div className="space-y-6">
        {/* Header Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {saveStatus === 'saved' && (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                <svg className="h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Changes saved
              </span>
            )}
            {saveStatus === 'reset' && (
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                <svg className="h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                </svg>
                Reset to defaults
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={handleResetToDefaults}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            <svg className="h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
            </svg>
            Reset to Defaults
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-slate-200 dark:border-slate-700">
          <nav className="-mb-px flex space-x-1 overflow-x-auto" aria-label="Admin configuration tabs">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                    isActive
                      ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                      : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:text-slate-300'
                  }`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="card">
          {activeTab === 'metrics' && (
            <MetricsTab config={config} onUpdate={handleUpdateConfig} logChange={logChange} />
          )}
          {activeTab === 'domains' && (
            <DomainsTab config={config} onUpdate={handleUpdateConfig} logChange={logChange} />
          )}
          {activeTab === 'editableFields' && (
            <EditableFieldsTab config={config} onUpdate={handleUpdateConfig} logChange={logChange} />
          )}
          {activeTab === 'containers' && (
            <ContainersTab config={config} onUpdate={handleUpdateConfig} logChange={logChange} />
          )}
        </div>

        {/* Summary Footer */}
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <p className="text-2xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Metrics</p>
              <p className="mt-0.5 text-lg font-bold text-slate-800 dark:text-slate-100">{config.metrics.length}</p>
            </div>
            <div>
              <p className="text-2xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Domains</p>
              <p className="mt-0.5 text-lg font-bold text-slate-800 dark:text-slate-100">{config.domains.length}</p>
            </div>
            <div>
              <p className="text-2xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Editable Fields</p>
              <p className="mt-0.5 text-lg font-bold text-slate-800 dark:text-slate-100">{(config.editableFields || []).length}</p>
            </div>
            <div>
              <p className="text-2xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Containers</p>
              <p className="mt-0.5 text-lg font-bold text-slate-800 dark:text-slate-100">{(config.containers || []).length}</p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}