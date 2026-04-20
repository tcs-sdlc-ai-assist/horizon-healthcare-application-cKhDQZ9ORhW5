import { useState, useCallback, useRef } from 'react';
import PropTypes from 'prop-types';
import { Navbar } from '@/components/layout/Navbar';
import { Sidebar } from '@/components/layout/Sidebar';
import { FilterBar } from '@/components/filters/FilterBar';
import { ExportButton } from '@/components/common/ExportButton';
import ErrorBoundary from '@/components/common/ErrorBoundary';

/**
 * DashboardLayout — Layout wrapper component for all dashboard pages.
 *
 * Renders the Navbar at the top, FilterBar below the navbar, an optional
 * collapsible Sidebar for secondary navigation, and a main content area.
 * Provides consistent page structure, spacing, and responsive grid layout
 * across all three dashboards (DevSecOps, App Development, Agile Flow).
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children - The dashboard page content to render in the main area
 * @param {string} [props.title] - Page title displayed above the content area
 * @param {string} [props.description] - Optional description text below the title
 * @param {boolean} [props.showSidebar=true] - Whether to render the sidebar navigation
 * @param {boolean} [props.showFilterBar=true] - Whether to render the global filter bar
 * @param {boolean} [props.showExport=false] - Whether to render the export button in the header
 * @param {string[]} [props.visibleFilters] - Array of filter keys to display in the FilterBar
 * @param {boolean} [props.showDateRange=false] - Whether to show date range inputs in the FilterBar
 * @param {string} [props.activeDashboard] - The active dashboard key for sidebar navigation ('devsecops', 'appdev', 'agile')
 * @param {string} [props.exportFilename] - Base filename for PDF/image exports
 * @param {string} [props.className] - Additional CSS classes for the main content wrapper
 * @returns {JSX.Element}
 */
export function DashboardLayout({
  children,
  title,
  description,
  showSidebar = true,
  showFilterBar = true,
  showExport = false,
  visibleFilters,
  showDateRange = false,
  activeDashboard,
  exportFilename,
  className,
}) {
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const contentRef = useRef(null);

  const handleToggleSidebar = useCallback(() => {
    setSidebarVisible((prev) => !prev);
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 dark:bg-slate-900">
      {/* Top Navigation */}
      <ErrorBoundary>
        <Navbar />
      </ErrorBoundary>

      {/* Body: Sidebar + Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        {showSidebar && (
          <ErrorBoundary>
            <div
              className={`hidden flex-shrink-0 transition-all duration-200 md:block ${
                sidebarVisible ? '' : 'md:hidden'
              }`}
            >
              <Sidebar
                activeDashboard={activeDashboard}
                className="h-full"
              />
            </div>
          </ErrorBoundary>
        )}

        {/* Main Content Area */}
        <main className="flex flex-1 flex-col overflow-y-auto">
          {/* Filter Bar */}
          {showFilterBar && (
            <ErrorBoundary>
              <div className="flex-shrink-0 px-4 pt-4 sm:px-6 lg:px-8">
                <FilterBar
                  visibleFilters={visibleFilters}
                  showDateRange={showDateRange}
                  showReset
                />
              </div>
            </ErrorBoundary>
          )}

          {/* Page Header */}
          {(title || showExport || showSidebar) && (
            <div className="flex flex-wrap items-start justify-between gap-3 px-4 pt-4 sm:px-6 lg:px-8">
              <div className="flex items-center gap-3">
                {/* Sidebar toggle button for tablet/mobile or when sidebar is hidden */}
                {showSidebar && (
                  <button
                    type="button"
                    onClick={handleToggleSidebar}
                    className="hidden rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 dark:hover:bg-slate-700 dark:hover:text-slate-300 md:inline-flex"
                    aria-label={sidebarVisible ? 'Hide sidebar' : 'Show sidebar'}
                    title={sidebarVisible ? 'Hide sidebar' : 'Show sidebar'}
                  >
                    {sidebarVisible ? (
                      <svg
                        className="h-5 w-5"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={1.5}
                        stroke="currentColor"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M3.75 6.75h16.5M3.75 12h16.5M12 17.25h8.25"
                        />
                      </svg>
                    ) : (
                      <svg
                        className="h-5 w-5"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={1.5}
                        stroke="currentColor"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
                        />
                      </svg>
                    )}
                  </button>
                )}

                {title && (
                  <div>
                    <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-2xl">
                      {title}
                    </h1>
                    {description && (
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        {description}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {showExport && (
                <div className="flex-shrink-0">
                  <ExportButton
                    targetRef={contentRef}
                    filename={exportFilename || 'dashboard-export'}
                    title={title || ''}
                    orientation="landscape"
                    size="md"
                  />
                </div>
              )}
            </div>
          )}

          {/* Dashboard Content */}
          <div
            ref={contentRef}
            className={`flex-1 px-4 py-4 sm:px-6 lg:px-8 ${className || ''}`}
          >
            <ErrorBoundary>
              {children}
            </ErrorBoundary>
          </div>

          {/* Footer */}
          <footer className="flex-shrink-0 border-t border-slate-200 px-4 py-3 dark:border-slate-700 sm:px-6 lg:px-8">
            <div className="flex flex-col items-center justify-between gap-2 sm:flex-row">
              <p className="text-xs text-slate-400 dark:text-slate-500">
                © {new Date().getFullYear()} Horizon Healthcare. All rights reserved.
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                Dashboard data refreshed from local storage
              </p>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}

DashboardLayout.propTypes = {
  children: PropTypes.node.isRequired,
  title: PropTypes.string,
  description: PropTypes.string,
  showSidebar: PropTypes.bool,
  showFilterBar: PropTypes.bool,
  showExport: PropTypes.bool,
  visibleFilters: PropTypes.arrayOf(
    PropTypes.oneOf(['domain', 'application', 'team', 'sprint', 'environment', 'release'])
  ),
  showDateRange: PropTypes.bool,
  activeDashboard: PropTypes.oneOf(['devsecops', 'appdev', 'agile']),
  exportFilename: PropTypes.string,
  className: PropTypes.string,
};

DashboardLayout.defaultProps = {
  title: '',
  description: '',
  showSidebar: true,
  showFilterBar: true,
  showExport: false,
  visibleFilters: null,
  showDateRange: false,
  activeDashboard: null,
  exportFilename: 'dashboard-export',
  className: '',
};

export default DashboardLayout;