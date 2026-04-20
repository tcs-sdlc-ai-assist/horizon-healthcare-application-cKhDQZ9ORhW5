import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FilterBar } from '../FilterBar';

// Mock the FilterContext
const mockSetFilter = vi.fn();
const mockResetFilters = vi.fn();
const mockGetFilterOptions = vi.fn();
const mockFilters = {
  domain: '',
  application: '',
  release: '',
  sprint: '',
  team: '',
  environment: '',
  dateFrom: '',
  dateTo: '',
};

vi.mock('@/context/FilterContext', () => ({
  useFilters: vi.fn(() => ({
    filters: mockFilters,
    setFilter: mockSetFilter,
    resetFilters: mockResetFilters,
    getFilterOptions: mockGetFilterOptions,
  })),
  FilterProvider: ({ children }) => children,
}));

// We need to import useFilters after the mock is set up so we can change return values per test
import { useFilters } from '@/context/FilterContext';

/**
 * Helper to set up mock filter options for all filter keys.
 */
function setupDefaultFilterOptions() {
  mockGetFilterOptions.mockImplementation((key) => {
    switch (key) {
      case 'domain':
        return [
          { label: 'Claims Processing', value: 'Claims Processing' },
          { label: 'Member Services', value: 'Member Services' },
          { label: 'Provider Network', value: 'Provider Network' },
        ];
      case 'application':
        return [
          { label: 'ClaimsEngine', value: 'ClaimsEngine' },
          { label: 'MemberPortal', value: 'MemberPortal' },
        ];
      case 'team':
        return [
          { label: 'Alpha Squad', value: 'Alpha Squad' },
          { label: 'Beta Force', value: 'Beta Force' },
        ];
      case 'sprint':
        return [
          { label: 'Sprint 1', value: 'Sprint 1' },
          { label: 'Sprint 2', value: 'Sprint 2' },
        ];
      case 'environment':
        return [
          { label: 'DEV', value: 'DEV' },
          { label: 'QA', value: 'QA' },
          { label: 'PROD', value: 'PROD' },
        ];
      case 'release':
        return [
          { label: '2024.1', value: '2024.1' },
          { label: '2024.2', value: '2024.2' },
        ];
      default:
        return [];
    }
  });
}

describe('FilterBar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultFilterOptions();

    // Reset the mock to default filters
    useFilters.mockReturnValue({
      filters: { ...mockFilters },
      setFilter: mockSetFilter,
      resetFilters: mockResetFilters,
      getFilterOptions: mockGetFilterOptions,
    });
  });

  describe('rendering', () => {
    it('renders the filter bar with title and filter icon', () => {
      render(<FilterBar />);

      expect(screen.getByText('Filters')).toBeInTheDocument();
    });

    it('renders all default filter dropdowns', () => {
      render(<FilterBar />);

      expect(screen.getByText('Domain')).toBeInTheDocument();
      expect(screen.getByText('Application')).toBeInTheDocument();
      expect(screen.getByText('Team')).toBeInTheDocument();
      expect(screen.getByText('Sprint')).toBeInTheDocument();
      expect(screen.getByText('Environment')).toBeInTheDocument();
      expect(screen.getByText('Release')).toBeInTheDocument();
    });

    it('renders only specified visible filters', () => {
      render(<FilterBar visibleFilters={['domain', 'team']} />);

      expect(screen.getByText('Domain')).toBeInTheDocument();
      expect(screen.getByText('Team')).toBeInTheDocument();
      expect(screen.queryByText('Application')).not.toBeInTheDocument();
      expect(screen.queryByText('Sprint')).not.toBeInTheDocument();
      expect(screen.queryByText('Environment')).not.toBeInTheDocument();
      expect(screen.queryByText('Release')).not.toBeInTheDocument();
    });

    it('renders the Reset button by default', () => {
      render(<FilterBar />);

      expect(screen.getByRole('button', { name: /reset/i })).toBeInTheDocument();
    });

    it('hides the Reset button when showReset is false', () => {
      render(<FilterBar showReset={false} />);

      expect(screen.queryByRole('button', { name: /reset/i })).not.toBeInTheDocument();
    });

    it('renders date range inputs when showDateRange is true', () => {
      render(<FilterBar showDateRange />);

      expect(screen.getByLabelText('Filter start date')).toBeInTheDocument();
      expect(screen.getByLabelText('Filter end date')).toBeInTheDocument();
    });

    it('does not render date range inputs by default', () => {
      render(<FilterBar />);

      expect(screen.queryByLabelText('Filter start date')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Filter end date')).not.toBeInTheDocument();
    });

    it('applies additional className to the wrapper', () => {
      const { container } = render(<FilterBar className="mt-4" />);

      const wrapper = container.firstChild;
      expect(wrapper.className).toContain('mt-4');
    });
  });

  describe('filter selection', () => {
    it('calls setFilter when a domain filter is selected', async () => {
      const user = userEvent.setup();
      render(<FilterBar visibleFilters={['domain']} />);

      // Click the dropdown button to open it
      const domainButton = screen.getByRole('button', { name: /all domains/i });
      await user.click(domainButton);

      // Click an option
      const option = screen.getByRole('option', { name: /claims processing/i });
      await user.click(option);

      expect(mockSetFilter).toHaveBeenCalledWith('domain', 'Claims Processing');
    });

    it('calls setFilter when a team filter is selected', async () => {
      const user = userEvent.setup();
      render(<FilterBar visibleFilters={['team']} />);

      const teamButton = screen.getByRole('button', { name: /all teams/i });
      await user.click(teamButton);

      const option = screen.getByRole('option', { name: /alpha squad/i });
      await user.click(option);

      expect(mockSetFilter).toHaveBeenCalledWith('team', 'Alpha Squad');
    });

    it('calls setFilter when a date from value is changed', async () => {
      const user = userEvent.setup();
      render(<FilterBar showDateRange visibleFilters={[]} />);

      const dateFromInput = screen.getByLabelText('Filter start date');
      await user.type(dateFromInput, '2024-06-01');

      expect(mockSetFilter).toHaveBeenCalledWith('dateFrom', expect.any(String));
    });

    it('calls setFilter when a date to value is changed', async () => {
      const user = userEvent.setup();
      render(<FilterBar showDateRange visibleFilters={[]} />);

      const dateToInput = screen.getByLabelText('Filter end date');
      await user.type(dateToInput, '2024-12-31');

      expect(mockSetFilter).toHaveBeenCalledWith('dateTo', expect.any(String));
    });
  });

  describe('reset functionality', () => {
    it('calls resetFilters when the Reset button is clicked', async () => {
      const user = userEvent.setup();

      useFilters.mockReturnValue({
        filters: { ...mockFilters, domain: 'Claims Processing' },
        setFilter: mockSetFilter,
        resetFilters: mockResetFilters,
        getFilterOptions: mockGetFilterOptions,
      });

      render(<FilterBar />);

      const resetButton = screen.getByRole('button', { name: /reset all filters/i });
      await user.click(resetButton);

      expect(mockResetFilters).toHaveBeenCalledTimes(1);
    });

    it('disables the Reset button when no filters are active', () => {
      render(<FilterBar />);

      const resetButton = screen.getByRole('button', { name: /reset all filters/i });
      expect(resetButton).toBeDisabled();
    });

    it('enables the Reset button when at least one filter is active', () => {
      useFilters.mockReturnValue({
        filters: { ...mockFilters, domain: 'Claims Processing' },
        setFilter: mockSetFilter,
        resetFilters: mockResetFilters,
        getFilterOptions: mockGetFilterOptions,
      });

      render(<FilterBar />);

      const resetButton = screen.getByRole('button', { name: /reset all filters/i });
      expect(resetButton).not.toBeDisabled();
    });
  });

  describe('active filter count', () => {
    it('does not show active filter count when no filters are set', () => {
      render(<FilterBar />);

      expect(screen.queryByText(/active/i)).not.toBeInTheDocument();
    });

    it('shows active filter count when filters are set', () => {
      useFilters.mockReturnValue({
        filters: { ...mockFilters, domain: 'Claims Processing', team: 'Alpha Squad' },
        setFilter: mockSetFilter,
        resetFilters: mockResetFilters,
        getFilterOptions: mockGetFilterOptions,
      });

      render(<FilterBar />);

      expect(screen.getByText('2 active')).toBeInTheDocument();
    });

    it('shows correct count with a single active filter', () => {
      useFilters.mockReturnValue({
        filters: { ...mockFilters, environment: 'PROD' },
        setFilter: mockSetFilter,
        resetFilters: mockResetFilters,
        getFilterOptions: mockGetFilterOptions,
      });

      render(<FilterBar />);

      expect(screen.getByText('1 active')).toBeInTheDocument();
    });
  });

  describe('filter options', () => {
    it('calls getFilterOptions for each visible filter', () => {
      render(<FilterBar visibleFilters={['domain', 'team', 'environment']} />);

      expect(mockGetFilterOptions).toHaveBeenCalledWith('domain');
      expect(mockGetFilterOptions).toHaveBeenCalledWith('team');
      expect(mockGetFilterOptions).toHaveBeenCalledWith('environment');
    });

    it('does not call getFilterOptions for filters not in visibleFilters', () => {
      render(<FilterBar visibleFilters={['domain']} />);

      expect(mockGetFilterOptions).toHaveBeenCalledWith('domain');
      expect(mockGetFilterOptions).not.toHaveBeenCalledWith('sprint');
      expect(mockGetFilterOptions).not.toHaveBeenCalledWith('release');
    });

    it('renders placeholder text for each dropdown', () => {
      render(<FilterBar visibleFilters={['domain', 'application', 'team']} />);

      expect(screen.getByText('All Domains')).toBeInTheDocument();
      expect(screen.getByText('All Applications')).toBeInTheDocument();
      expect(screen.getByText('All Teams')).toBeInTheDocument();
    });
  });

  describe('filter state propagation', () => {
    it('displays the selected domain value in the dropdown', () => {
      useFilters.mockReturnValue({
        filters: { ...mockFilters, domain: 'Claims Processing' },
        setFilter: mockSetFilter,
        resetFilters: mockResetFilters,
        getFilterOptions: mockGetFilterOptions,
      });

      render(<FilterBar visibleFilters={['domain']} />);

      expect(screen.getByText('Claims Processing')).toBeInTheDocument();
    });

    it('displays the selected team value in the dropdown', () => {
      useFilters.mockReturnValue({
        filters: { ...mockFilters, team: 'Alpha Squad' },
        setFilter: mockSetFilter,
        resetFilters: mockResetFilters,
        getFilterOptions: mockGetFilterOptions,
      });

      render(<FilterBar visibleFilters={['team']} />);

      expect(screen.getByText('Alpha Squad')).toBeInTheDocument();
    });

    it('displays date range values when set', () => {
      useFilters.mockReturnValue({
        filters: { ...mockFilters, dateFrom: '2024-06-01', dateTo: '2024-12-31' },
        setFilter: mockSetFilter,
        resetFilters: mockResetFilters,
        getFilterOptions: mockGetFilterOptions,
      });

      render(<FilterBar showDateRange visibleFilters={[]} />);

      const dateFromInput = screen.getByLabelText('Filter start date');
      const dateToInput = screen.getByLabelText('Filter end date');

      expect(dateFromInput).toHaveValue('2024-06-01');
      expect(dateToInput).toHaveValue('2024-12-31');
    });
  });

  describe('edge cases', () => {
    it('handles empty visibleFilters array gracefully', () => {
      render(<FilterBar visibleFilters={[]} />);

      expect(screen.getByText('Filters')).toBeInTheDocument();
      expect(screen.queryByText('Domain')).not.toBeInTheDocument();
      expect(screen.queryByText('Application')).not.toBeInTheDocument();
    });

    it('ignores invalid filter keys in visibleFilters', () => {
      render(<FilterBar visibleFilters={['domain', 'invalidKey']} />);

      expect(screen.getByText('Domain')).toBeInTheDocument();
      // Should not crash and should only render valid filters
    });

    it('handles getFilterOptions returning empty arrays', () => {
      mockGetFilterOptions.mockReturnValue([]);

      render(<FilterBar visibleFilters={['domain']} />);

      expect(screen.getByText('Domain')).toBeInTheDocument();
      expect(screen.getByText('All Domains')).toBeInTheDocument();
    });

    it('renders with all filters active and counts correctly', () => {
      useFilters.mockReturnValue({
        filters: {
          domain: 'Claims Processing',
          application: 'ClaimsEngine',
          release: '2024.1',
          sprint: 'Sprint 1',
          team: 'Alpha Squad',
          environment: 'PROD',
          dateFrom: '2024-01-01',
          dateTo: '2024-12-31',
        },
        setFilter: mockSetFilter,
        resetFilters: mockResetFilters,
        getFilterOptions: mockGetFilterOptions,
      });

      render(<FilterBar />);

      expect(screen.getByText('8 active')).toBeInTheDocument();
    });
  });
});