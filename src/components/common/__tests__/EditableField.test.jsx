import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EditableField } from '../EditableField';

// Mock useRoleGuard hook
const mockUseRoleGuard = vi.fn();
vi.mock('@/hooks/useRoleGuard', () => ({
  useRoleGuard: () => mockUseRoleGuard(),
}));

// Mock useAuth hook
const mockUseAuth = vi.fn();
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

// Mock dataService editField
const mockEditField = vi.fn();
vi.mock('@/services/dataService', () => ({
  editField: (...args) => mockEditField(...args),
}));

// Mock formatUtils
vi.mock('@/utils/formatUtils', () => ({
  formatDate: vi.fn((date, options) => {
    if (!date) return 'N/A';
    try {
      const d = new Date(date);
      if (isNaN(d.getTime())) return 'N/A';
      return d.toLocaleDateString('en-US', options);
    } catch {
      return 'N/A';
    }
  }),
}));

/**
 * Helper to set up role guard mock with specific permissions.
 * @param {Object} overrides
 */
function setupRoleGuard(overrides = {}) {
  mockUseRoleGuard.mockReturnValue({
    canEdit: true,
    canImport: false,
    canExport: false,
    canConfigure: false,
    canViewAudit: false,
    isAdmin: false,
    role: 'Admin',
    isAuthenticated: true,
    hasPermission: vi.fn(() => true),
    requireRole: vi.fn(() => true),
    ...overrides,
  });
}

/**
 * Helper to set up auth mock with a specific user.
 * @param {Object} overrides
 */
function setupAuth(overrides = {}) {
  mockUseAuth.mockReturnValue({
    user: {
      id: 'USR-001',
      name: 'Sarah Chen',
      email: 'sarah.chen@horizon-health.com',
      role: 'Admin',
      avatar: 'SC',
      token: 'mock.jwt.token',
    },
    isAuthenticated: true,
    loading: false,
    login: vi.fn(),
    logout: vi.fn(),
    ...overrides,
  });
}

describe('EditableField', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupRoleGuard();
    setupAuth();
    mockEditField.mockResolvedValue({
      success: true,
      updatedRecord: { id: 'REC-001', techStack: 'Go/gRPC' },
      auditEntry: { id: 'AUD-mock-001' },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============================================================
  // Display Mode
  // ============================================================
  describe('display mode', () => {
    it('renders the current value in read mode', () => {
      render(
        <EditableField
          recordId="REC-001"
          field="techStack"
          value="Java/Spring Boot"
        />
      );

      expect(screen.getByText('Java/Spring Boot')).toBeInTheDocument();
    });

    it('renders "—" when value is null', () => {
      render(
        <EditableField
          recordId="REC-001"
          field="techStack"
          value={null}
        />
      );

      expect(screen.getByText('—')).toBeInTheDocument();
    });

    it('renders "—" when value is undefined', () => {
      render(
        <EditableField
          recordId="REC-001"
          field="techStack"
          value={undefined}
        />
      );

      expect(screen.getByText('—')).toBeInTheDocument();
    });

    it('renders "—" when value is empty string', () => {
      render(
        <EditableField
          recordId="REC-001"
          field="techStack"
          value=""
        />
      );

      expect(screen.getByText('—')).toBeInTheDocument();
    });

    it('formats numeric values with locale formatting', () => {
      render(
        <EditableField
          recordId="REC-001"
          field="count"
          value={1500}
          type="number"
        />
      );

      expect(screen.getByText('1,500')).toBeInTheDocument();
    });

    it('shows edit icon when user has edit permission', () => {
      setupRoleGuard({ canEdit: true });

      const { container } = render(
        <EditableField
          recordId="REC-001"
          field="techStack"
          value="Java/Spring Boot"
        />
      );

      const editIcon = container.querySelector('svg');
      expect(editIcon).toBeInTheDocument();
    });

    it('does not show edit icon when user lacks edit permission', () => {
      setupRoleGuard({ canEdit: false });

      render(
        <EditableField
          recordId="REC-001"
          field="techStack"
          value="Java/Spring Boot"
        />
      );

      // The value should still be displayed
      expect(screen.getByText('Java/Spring Boot')).toBeInTheDocument();
    });

    it('renders select value with label from options', () => {
      const options = [
        { label: 'Red', value: 'red' },
        { label: 'Amber', value: 'amber' },
        { label: 'Green', value: 'green' },
      ];

      render(
        <EditableField
          recordId="REC-001"
          field="status"
          value="amber"
          type="select"
          options={options}
        />
      );

      expect(screen.getByText('Amber')).toBeInTheDocument();
    });
  });

  // ============================================================
  // Edit Mode Toggle
  // ============================================================
  describe('edit mode toggle', () => {
    it('enters edit mode when clicked by authorized user', async () => {
      const user = userEvent.setup();

      render(
        <EditableField
          recordId="REC-001"
          field="techStack"
          value="Java/Spring Boot"
        />
      );

      const displayElement = screen.getByRole('button', { name: /click to edit/i });
      await user.click(displayElement);

      const input = screen.getByRole('textbox', { name: /edit techstack/i });
      expect(input).toBeInTheDocument();
      expect(input).toHaveValue('Java/Spring Boot');
    });

    it('does not enter edit mode when user lacks edit permission', async () => {
      setupRoleGuard({ canEdit: false });
      const user = userEvent.setup();

      render(
        <EditableField
          recordId="REC-001"
          field="techStack"
          value="Java/Spring Boot"
        />
      );

      // The text should be present but not as a button
      const textElement = screen.getByText('Java/Spring Boot');
      await user.click(textElement);

      // Should not find an input
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });

    it('enters edit mode via keyboard (Enter key)', async () => {
      const user = userEvent.setup();

      render(
        <EditableField
          recordId="REC-001"
          field="techStack"
          value="Java/Spring Boot"
        />
      );

      const displayElement = screen.getByRole('button', { name: /click to edit/i });
      displayElement.focus();
      await user.keyboard('{Enter}');

      expect(screen.getByRole('textbox', { name: /edit techstack/i })).toBeInTheDocument();
    });

    it('enters edit mode via keyboard (Space key)', async () => {
      const user = userEvent.setup();

      render(
        <EditableField
          recordId="REC-001"
          field="techStack"
          value="Java/Spring Boot"
        />
      );

      const displayElement = screen.getByRole('button', { name: /click to edit/i });
      displayElement.focus();
      await user.keyboard(' ');

      expect(screen.getByRole('textbox', { name: /edit techstack/i })).toBeInTheDocument();
    });

    it('renders a number input when type is number', async () => {
      const user = userEvent.setup();

      render(
        <EditableField
          recordId="REC-001"
          field="count"
          value={42}
          type="number"
        />
      );

      const displayElement = screen.getByRole('button', { name: /click to edit/i });
      await user.click(displayElement);

      const input = screen.getByRole('spinbutton', { name: /edit count/i });
      expect(input).toBeInTheDocument();
      expect(input).toHaveValue(42);
    });

    it('renders a select dropdown when type is select', async () => {
      const user = userEvent.setup();
      const options = [
        { label: 'Red', value: 'red' },
        { label: 'Amber', value: 'amber' },
        { label: 'Green', value: 'green' },
      ];

      render(
        <EditableField
          recordId="REC-001"
          field="status"
          value="amber"
          type="select"
          options={options}
        />
      );

      const displayElement = screen.getByRole('button', { name: /click to edit/i });
      await user.click(displayElement);

      const select = screen.getByRole('combobox', { name: /edit status/i });
      expect(select).toBeInTheDocument();
      expect(select).toHaveValue('amber');
    });
  });

  // ============================================================
  // Save Behavior
  // ============================================================
  describe('save behavior', () => {
    it('saves the edited value when save button is clicked', async () => {
      const user = userEvent.setup();
      const onSave = vi.fn();

      render(
        <EditableField
          recordId="REC-001"
          field="techStack"
          value="Java/Spring Boot"
          onSave={onSave}
          dataType="applications"
        />
      );

      // Enter edit mode
      const displayElement = screen.getByRole('button', { name: /click to edit/i });
      await user.click(displayElement);

      // Clear and type new value
      const input = screen.getByRole('textbox', { name: /edit techstack/i });
      await user.clear(input);
      await user.type(input, 'Go/gRPC');

      // Click save
      const saveButton = screen.getByRole('button', { name: /save changes/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockEditField).toHaveBeenCalledWith(
          'REC-001',
          'techStack',
          'Go/gRPC',
          expect.objectContaining({ name: 'Sarah Chen', role: 'Admin' }),
          expect.objectContaining({ dataType: 'applications' })
        );
      });

      await waitFor(() => {
        expect(onSave).toHaveBeenCalledWith(
          expect.objectContaining({
            recordId: 'REC-001',
            field: 'techStack',
            oldValue: 'Java/Spring Boot',
            newValue: 'Go/gRPC',
          })
        );
      });
    });

    it('saves the edited value when Enter key is pressed', async () => {
      const user = userEvent.setup();

      render(
        <EditableField
          recordId="REC-001"
          field="techStack"
          value="Java/Spring Boot"
          dataType="applications"
        />
      );

      const displayElement = screen.getByRole('button', { name: /click to edit/i });
      await user.click(displayElement);

      const input = screen.getByRole('textbox', { name: /edit techstack/i });
      await user.clear(input);
      await user.type(input, 'Go/gRPC');
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(mockEditField).toHaveBeenCalledTimes(1);
      });
    });

    it('does not call editField when value has not changed', async () => {
      const user = userEvent.setup();

      render(
        <EditableField
          recordId="REC-001"
          field="techStack"
          value="Java/Spring Boot"
        />
      );

      const displayElement = screen.getByRole('button', { name: /click to edit/i });
      await user.click(displayElement);

      // Press Enter without changing value
      await user.keyboard('{Enter}');

      expect(mockEditField).not.toHaveBeenCalled();
    });

    it('trims text values before saving', async () => {
      const user = userEvent.setup();

      render(
        <EditableField
          recordId="REC-001"
          field="techStack"
          value="Java/Spring Boot"
          dataType="applications"
        />
      );

      const displayElement = screen.getByRole('button', { name: /click to edit/i });
      await user.click(displayElement);

      const input = screen.getByRole('textbox', { name: /edit techstack/i });
      await user.clear(input);
      await user.type(input, '  Go/gRPC  ');
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(mockEditField).toHaveBeenCalledWith(
          'REC-001',
          'techStack',
          'Go/gRPC',
          expect.any(Object),
          expect.any(Object)
        );
      });
    });

    it('coerces number type values before saving', async () => {
      const user = userEvent.setup();

      render(
        <EditableField
          recordId="REC-001"
          field="count"
          value={42}
          type="number"
          dataType="applications"
        />
      );

      const displayElement = screen.getByRole('button', { name: /click to edit/i });
      await user.click(displayElement);

      const input = screen.getByRole('spinbutton', { name: /edit count/i });
      await user.clear(input);
      await user.type(input, '100');
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(mockEditField).toHaveBeenCalledWith(
          'REC-001',
          'count',
          100,
          expect.any(Object),
          expect.any(Object)
        );
      });
    });

    it('shows error when number validation fails', async () => {
      const user = userEvent.setup();

      render(
        <EditableField
          recordId="REC-001"
          field="count"
          value={42}
          type="number"
        />
      );

      const displayElement = screen.getByRole('button', { name: /click to edit/i });
      await user.click(displayElement);

      const input = screen.getByRole('spinbutton', { name: /edit count/i });
      await user.clear(input);
      await user.type(input, 'abc');
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByText(/valid number/i)).toBeInTheDocument();
      });

      expect(mockEditField).not.toHaveBeenCalled();
    });

    it('shows error when value is below min', async () => {
      const user = userEvent.setup();

      render(
        <EditableField
          recordId="REC-001"
          field="count"
          value={42}
          type="number"
          min={10}
        />
      );

      const displayElement = screen.getByRole('button', { name: /click to edit/i });
      await user.click(displayElement);

      const input = screen.getByRole('spinbutton', { name: /edit count/i });
      await user.clear(input);
      await user.type(input, '5');
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(screen.getByText(/at least 10/i)).toBeInTheDocument();
      });

      expect(mockEditField).not.toHaveBeenCalled();
    });

    it('shows error when value exceeds max', async () => {
      const user = userEvent.setup();

      render(
        <EditableField
          recordId="REC-001"
          field="count"
          value={42}
          type="number"
          max={50}
        />
      );

      const displayElement = screen.getByRole('button', { name: /click to edit/i });
      await user.click(displayElement);

      const input = screen.getByRole('spinbutton', { name: /edit count/i });
      await user.clear(input);
      await user.type(input, '100');
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(screen.getByText(/no more than 50/i)).toBeInTheDocument();
      });

      expect(mockEditField).not.toHaveBeenCalled();
    });

    it('displays error when editField returns failure', async () => {
      mockEditField.mockResolvedValue({
        success: false,
        error: 'Record not found.',
      });

      const user = userEvent.setup();

      render(
        <EditableField
          recordId="REC-001"
          field="techStack"
          value="Java/Spring Boot"
        />
      );

      const displayElement = screen.getByRole('button', { name: /click to edit/i });
      await user.click(displayElement);

      const input = screen.getByRole('textbox', { name: /edit techstack/i });
      await user.clear(input);
      await user.type(input, 'Go/gRPC');
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(screen.getByText('Record not found.')).toBeInTheDocument();
      });
    });

    it('displays error when editField throws an exception', async () => {
      mockEditField.mockRejectedValue(new Error('Network error'));

      const user = userEvent.setup();

      render(
        <EditableField
          recordId="REC-001"
          field="techStack"
          value="Java/Spring Boot"
        />
      );

      const displayElement = screen.getByRole('button', { name: /click to edit/i });
      await user.click(displayElement);

      const input = screen.getByRole('textbox', { name: /edit techstack/i });
      await user.clear(input);
      await user.type(input, 'Go/gRPC');
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(screen.getByText(/Network error/i)).toBeInTheDocument();
      });
    });

    it('shows error when user is not logged in', async () => {
      setupAuth({ user: null });
      const user = userEvent.setup();

      render(
        <EditableField
          recordId="REC-001"
          field="techStack"
          value="Java/Spring Boot"
        />
      );

      const displayElement = screen.getByRole('button', { name: /click to edit/i });
      await user.click(displayElement);

      const input = screen.getByRole('textbox', { name: /edit techstack/i });
      await user.clear(input);
      await user.type(input, 'Go/gRPC');
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(screen.getByText(/must be logged in/i)).toBeInTheDocument();
      });

      expect(mockEditField).not.toHaveBeenCalled();
    });
  });

  // ============================================================
  // Cancel Behavior
  // ============================================================
  describe('cancel behavior', () => {
    it('cancels editing when cancel button is clicked', async () => {
      const user = userEvent.setup();

      render(
        <EditableField
          recordId="REC-001"
          field="techStack"
          value="Java/Spring Boot"
        />
      );

      const displayElement = screen.getByRole('button', { name: /click to edit/i });
      await user.click(displayElement);

      const input = screen.getByRole('textbox', { name: /edit techstack/i });
      await user.clear(input);
      await user.type(input, 'Go/gRPC');

      const cancelButton = screen.getByRole('button', { name: /cancel editing/i });
      await user.click(cancelButton);

      // Should be back in display mode with original value
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
      expect(screen.getByText('Java/Spring Boot')).toBeInTheDocument();
    });

    it('cancels editing when Escape key is pressed', async () => {
      const user = userEvent.setup();

      render(
        <EditableField
          recordId="REC-001"
          field="techStack"
          value="Java/Spring Boot"
        />
      );

      const displayElement = screen.getByRole('button', { name: /click to edit/i });
      await user.click(displayElement);

      const input = screen.getByRole('textbox', { name: /edit techstack/i });
      await user.clear(input);
      await user.type(input, 'Go/gRPC');
      await user.keyboard('{Escape}');

      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
      expect(screen.getByText('Java/Spring Boot')).toBeInTheDocument();
    });

    it('reverts to original value after cancel', async () => {
      const user = userEvent.setup();

      render(
        <EditableField
          recordId="REC-001"
          field="techStack"
          value="Java/Spring Boot"
        />
      );

      // Enter edit mode, modify, cancel
      const displayElement = screen.getByRole('button', { name: /click to edit/i });
      await user.click(displayElement);

      const input = screen.getByRole('textbox', { name: /edit techstack/i });
      await user.clear(input);
      await user.type(input, 'Modified Value');

      const cancelButton = screen.getByRole('button', { name: /cancel editing/i });
      await user.click(cancelButton);

      // Re-enter edit mode and verify value is original
      const displayElement2 = screen.getByRole('button', { name: /click to edit/i });
      await user.click(displayElement2);

      const input2 = screen.getByRole('textbox', { name: /edit techstack/i });
      expect(input2).toHaveValue('Java/Spring Boot');
    });
  });

  // ============================================================
  // RBAC Permission Checks
  // ============================================================
  describe('RBAC permission checks', () => {
    it('allows editing for Admin role', async () => {
      setupRoleGuard({ canEdit: true, role: 'Admin', isAdmin: true });
      const user = userEvent.setup();

      render(
        <EditableField
          recordId="REC-001"
          field="techStack"
          value="Java/Spring Boot"
        />
      );

      const displayElement = screen.getByRole('button', { name: /click to edit/i });
      await user.click(displayElement);

      expect(screen.getByRole('textbox', { name: /edit techstack/i })).toBeInTheDocument();
    });

    it('allows editing for Developer role', async () => {
      setupRoleGuard({ canEdit: true, role: 'Developer', isAdmin: false });
      setupAuth({
        user: {
          id: 'USR-005',
          name: 'Emily Johnson',
          role: 'Developer',
          avatar: 'EJ',
          token: 'mock.jwt.token',
        },
      });
      const user = userEvent.setup();

      render(
        <EditableField
          recordId="REC-001"
          field="techStack"
          value="Java/Spring Boot"
        />
      );

      const displayElement = screen.getByRole('button', { name: /click to edit/i });
      await user.click(displayElement);

      expect(screen.getByRole('textbox', { name: /edit techstack/i })).toBeInTheDocument();
    });

    it('prevents editing for View-Only role', async () => {
      setupRoleGuard({ canEdit: false, role: 'View-Only', isAdmin: false });
      setupAuth({
        user: {
          id: 'USR-007',
          name: 'Lisa Anderson',
          role: 'View-Only',
          avatar: 'LA',
          token: 'mock.jwt.token',
        },
      });
      const user = userEvent.setup();

      render(
        <EditableField
          recordId="REC-001"
          field="techStack"
          value="Java/Spring Boot"
        />
      );

      // Value should be displayed but not clickable as a button
      expect(screen.getByText('Java/Spring Boot')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /click to edit/i })).not.toBeInTheDocument();
    });

    it('prevents editing for Manager role', async () => {
      setupRoleGuard({ canEdit: false, role: 'Manager', isAdmin: false });
      setupAuth({
        user: {
          id: 'USR-002',
          name: 'James Wilson',
          role: 'Manager',
          avatar: 'JW',
          token: 'mock.jwt.token',
        },
      });

      render(
        <EditableField
          recordId="REC-001"
          field="techStack"
          value="Java/Spring Boot"
        />
      );

      expect(screen.getByText('Java/Spring Boot')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /click to edit/i })).not.toBeInTheDocument();
    });
  });

  // ============================================================
  // Audit Log Integration
  // ============================================================
  describe('audit log integration', () => {
    it('calls editField with correct user info for audit logging', async () => {
      const user = userEvent.setup();

      render(
        <EditableField
          recordId="REC-001"
          field="techStack"
          value="Java/Spring Boot"
          dataType="applications"
        />
      );

      const displayElement = screen.getByRole('button', { name: /click to edit/i });
      await user.click(displayElement);

      const input = screen.getByRole('textbox', { name: /edit techstack/i });
      await user.clear(input);
      await user.type(input, 'Go/gRPC');
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(mockEditField).toHaveBeenCalledWith(
          'REC-001',
          'techStack',
          'Go/gRPC',
          { name: 'Sarah Chen', role: 'Admin' },
          { dataType: 'applications', idField: undefined }
        );
      });
    });

    it('passes audit entry to onSave callback', async () => {
      const onSave = vi.fn();
      const user = userEvent.setup();

      mockEditField.mockResolvedValue({
        success: true,
        updatedRecord: { id: 'REC-001', techStack: 'Go/gRPC' },
        auditEntry: { id: 'AUD-mock-123', action: 'UPDATE' },
      });

      render(
        <EditableField
          recordId="REC-001"
          field="techStack"
          value="Java/Spring Boot"
          dataType="applications"
          onSave={onSave}
        />
      );

      const displayElement = screen.getByRole('button', { name: /click to edit/i });
      await user.click(displayElement);

      const input = screen.getByRole('textbox', { name: /edit techstack/i });
      await user.clear(input);
      await user.type(input, 'Go/gRPC');
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(onSave).toHaveBeenCalledWith(
          expect.objectContaining({
            recordId: 'REC-001',
            field: 'techStack',
            oldValue: 'Java/Spring Boot',
            newValue: 'Go/gRPC',
            auditEntry: { id: 'AUD-mock-123', action: 'UPDATE' },
          })
        );
      });
    });

    it('passes null auditEntry when editField does not return one', async () => {
      const onSave = vi.fn();
      const user = userEvent.setup();

      mockEditField.mockResolvedValue({
        success: true,
        updatedRecord: { id: 'REC-001', techStack: 'Go/gRPC' },
      });

      render(
        <EditableField
          recordId="REC-001"
          field="techStack"
          value="Java/Spring Boot"
          dataType="applications"
          onSave={onSave}
        />
      );

      const displayElement = screen.getByRole('button', { name: /click to edit/i });
      await user.click(displayElement);

      const input = screen.getByRole('textbox', { name: /edit techstack/i });
      await user.clear(input);
      await user.type(input, 'Go/gRPC');
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(onSave).toHaveBeenCalledWith(
          expect.objectContaining({
            auditEntry: null,
          })
        );
      });
    });
  });

  // ============================================================
  // Select Type with RAG Status
  // ============================================================
  describe('select type with RAG status', () => {
    const ragOptions = [
      { label: 'Red', value: 'red' },
      { label: 'Amber', value: 'amber' },
      { label: 'Green', value: 'green' },
    ];

    it('renders RAG dot indicator for RAG select fields', () => {
      const { container } = render(
        <EditableField
          recordId="REC-001"
          field="status"
          value="green"
          type="select"
          options={ragOptions}
        />
      );

      // Should have a colored dot
      const dot = container.querySelector('.rounded-full.bg-green-500');
      expect(dot).toBeInTheDocument();
      expect(screen.getByText('Green')).toBeInTheDocument();
    });

    it('saves select value correctly', async () => {
      const user = userEvent.setup();
      const onSave = vi.fn();

      render(
        <EditableField
          recordId="REC-001"
          field="status"
          value="green"
          type="select"
          options={ragOptions}
          onSave={onSave}
          dataType="applications"
        />
      );

      const displayElement = screen.getByRole('button', { name: /click to edit/i });
      await user.click(displayElement);

      const select = screen.getByRole('combobox', { name: /edit status/i });
      await user.selectOptions(select, 'red');
      
      const saveButton = screen.getByRole('button', { name: /save changes/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockEditField).toHaveBeenCalledWith(
          'REC-001',
          'status',
          'red',
          expect.any(Object),
          expect.any(Object)
        );
      });
    });
  });

  // ============================================================
  // Last Edited Info Tooltip
  // ============================================================
  describe('last edited info tooltip', () => {
    it('shows tooltip with last edited info on hover', async () => {
      const user = userEvent.setup();

      render(
        <EditableField
          recordId="REC-001"
          field="techStack"
          value="Java/Spring Boot"
          lastEditedBy="David Kim"
          lastEditedAt="2024-12-15T10:30:00Z"
        />
      );

      const container = screen.getByRole('button', { name: /click to edit/i }).closest('[class*="relative"]');
      
      await user.hover(container);

      // Wait for tooltip delay
      await waitFor(() => {
        expect(screen.getByRole('tooltip')).toBeInTheDocument();
      }, { timeout: 1000 });

      expect(screen.getByText(/David Kim/)).toBeInTheDocument();
    });
  });

  // ============================================================
  // External Value Sync
  // ============================================================
  describe('external value sync', () => {
    it('updates display when value prop changes while not editing', () => {
      const { rerender } = render(
        <EditableField
          recordId="REC-001"
          field="techStack"
          value="Java/Spring Boot"
        />
      );

      expect(screen.getByText('Java/Spring Boot')).toBeInTheDocument();

      rerender(
        <EditableField
          recordId="REC-001"
          field="techStack"
          value="Go/gRPC"
        />
      );

      expect(screen.getByText('Go/gRPC')).toBeInTheDocument();
    });
  });

  // ============================================================
  // Custom idField and dataType
  // ============================================================
  describe('custom idField and dataType', () => {
    it('passes custom idField and dataType to editField', async () => {
      const user = userEvent.setup();

      render(
        <EditableField
          recordId="SPR-0001"
          field="committed"
          value={30}
          type="number"
          dataType="sprintMetrics"
          idField="sprintId"
        />
      );

      const displayElement = screen.getByRole('button', { name: /click to edit/i });
      await user.click(displayElement);

      const input = screen.getByRole('spinbutton', { name: /edit committed/i });
      await user.clear(input);
      await user.type(input, '40');
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(mockEditField).toHaveBeenCalledWith(
          'SPR-0001',
          'committed',
          40,
          expect.any(Object),
          expect.objectContaining({ dataType: 'sprintMetrics', idField: 'sprintId' })
        );
      });
    });
  });
});