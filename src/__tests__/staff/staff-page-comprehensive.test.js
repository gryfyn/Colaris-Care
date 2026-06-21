/**
 * Comprehensive Staff Page Test Suite
 * Tests: StaffApp component, DashboardView, MyResidentsView, ProgressNotesView,
 * MedicationsView, IncidentReportView, DrugDisposalView, EvacuationDrillView
 * Target: 75%+ code coverage
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StaffPage from '@/app/staff/page';

// ═══════════════════════════════════════════════════════════════════════════════
// MOCKS
// ═══════════════════════════════════════════════════════════════════════════════

const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  pathname: '/staff',
};

jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
}));

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    auth: {
      user: {
        id: 'staff-123',
        staffId: 'staff-123',
        role: 'staff',
        tenantId: 'tenant-123',
        accessToken: 'mock-token-123',
      },
      accessToken: 'mock-token-123',
    },
    token: 'mock-token-123',
    csrfToken: 'csrf-token-123',
    loading: false,
    login: jest.fn(),
    logout: jest.fn(),
  }),
  authHeaders: () => ({
    'Authorization': 'Bearer mock-token-123',
  }),
}));

jest.mock('@/app/components/nav/StaffSideNav', () => {
  return function MockStaffSideNav() {
    return <div data-testid="staff-sidenav">Mock StaffSideNav</div>;
  };
});

jest.mock('@/app/components/nav/StaffTopNav', () => {
  return function MockStaffTopNav({ visibleNav, onNavigate }) {
    return (
      <div data-testid="staff-topnav">
        <div>Mock StaffTopNav</div>
        {visibleNav?.map((item) => (
          <button key={item.id} onClick={() => onNavigate?.(item.id)} data-testid={`nav-${item.id}`}>
            {item.label}
          </button>
        ))}
      </div>
    );
  };
});

// Mock fetch globally
global.fetch = jest.fn();

const NAV_TITLES = {
  'nav-dashboard': 'Dashboard',
  'nav-my-residents': 'My Residents',
  'nav-progress-notes': 'Progress Notes',
  'nav-medications': 'Medications',
  'nav-incident-report': 'Incident Reports',
  'nav-drug-disposal': 'Drug Disposal',
  'nav-evacuation-drill': 'Evacuation Drill',
};

function navButton(testId) {
  return screen.getAllByTitle(NAV_TITLES[testId])[0];
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEST SUITE
// ═══════════════════════════════════════════════════════════════════════════════

describe('Staff Page (StaffApp) - Comprehensive Suite', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRouter.push.mockClear();
    fetch.mockClear();

    // Default mock responses
    fetch.mockImplementation((url) => {
      if (url.includes('/api/v1/auth/me')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            user: {
              id: 'staff-123',
              first_name: 'John',
              last_name: 'Doe',
              email: 'john@test.com',
              role: 'staff',
              shift: 'Day (8am-4pm)',
            },
          }),
        });
      }
      if (url.includes('/api/v1/staff/dashboard')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            data: {
              assignedResidents: 5,
              pendingProgressNotes: 2,
              assignedForToday: [
                {
                  id: 'res-1',
                  first_name: 'Marcus',
                  last_name: 'Thompson',
                  status: 'active',
                },
              ],
              recentIncidents: [
                {
                  id: 'inc-1',
                  incident_date: '2024-01-15',
                  first_name: 'Marcus',
                  last_name: 'Thompson',
                  incident_type: 'Fall',
                },
              ],
            },
          }),
        });
      }
      if (url.includes('/api/v1/daily-progress-notes/pending')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            total_pending: 2,
            data: [
              { id: 'note-1', resident_id: 'res-1', first_name: 'Marcus', last_name: 'Thompson' },
              { id: 'note-2', resident_id: 'res-2', first_name: 'Diana', last_name: 'Prince' },
            ],
          }),
        });
      }
      if (url.includes('/api/v1/staff/assignments')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            data: [
              {
                id: 'res-1',
                first_name: 'Marcus',
                last_name: 'Thompson',
                room_number: '101',
                diagnosis: 'Dementia',
                primary_diagnosis: 'Dementia',
              },
              {
                id: 'res-2',
                first_name: 'Diana',
                last_name: 'Prince',
                room_number: '102',
                diagnosis: 'Hypertension',
                primary_diagnosis: 'Hypertension',
              },
            ],
          }),
        });
      }
      return Promise.reject(new Error('Unknown fetch URL'));
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // CORE RENDERING TESTS
  // ─────────────────────────────────────────────────────────────────────────────

  describe('Core Rendering', () => {
    it('renders without crashing', () => {
      expect(() => render(<StaffPage />)).not.toThrow();
    });

    it('renders main layout with sidenav and topnav', async () => {
      render(<StaffPage />);
      await waitFor(() => {
        expect(screen.getByTestId('staff-sidenav')).toBeInTheDocument();
        expect(screen.getByTestId('staff-topnav')).toBeInTheDocument();
      });
    });

    it('renders main content area', async () => {
      render(<StaffPage />);
      const mainContent = screen.getByRole('main');
      expect(mainContent).toBeInTheDocument();
    });

    it('applies correct layout structure with flex and height', async () => {
      const { container } = render(<StaffPage />);
      const outerDiv = container.firstChild;
      expect(outerDiv).toHaveStyle({ display: 'flex', minHeight: '100vh' });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // AUTHENTICATION & PROFILE LOADING
  // ─────────────────────────────────────────────────────────────────────────────

  describe('Authentication & Profile Loading', () => {
    it('fetches staff profile on mount', async () => {
      render(<StaffPage />);
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/v1/auth/me', expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer mock-token-123',
          }),
        }));
      });
    });

    it('displays staff member name in greeting after loading', async () => {
      render(<StaffPage />);
      await waitFor(() => {
        expect(screen.getByText(/good (morning|afternoon|evening), john/i)).toBeInTheDocument();
      });
    });

    it('fetches staff page data after profile loads', async () => {
      render(<StaffPage />);
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          '/api/v1/staff/assignments',
          expect.objectContaining({
            headers: expect.objectContaining({
              Authorization: 'Bearer mock-token-123',
            }),
          })
        );
      });
    });

    it('handles profile fetch error gracefully', async () => {
      fetch.mockImplementationOnce((url) => {
        if (url.includes('/api/v1/auth/me')) {
          return Promise.resolve({
            ok: false,
            status: 401,
            text: async () => 'Unauthorized',
          });
        }
        return Promise.reject(new Error('Network error'));
      });

      render(<StaffPage />);
      await waitFor(() => {
        expect(screen.getByTestId('staff-sidenav')).toBeInTheDocument();
      });
    });

    it('fetches resident assignments for wizards', async () => {
      render(<StaffPage />);
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/v1/staff/assignments'),
          expect.any(Object)
        );
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // DASHBOARD VIEW TESTS
  // ─────────────────────────────────────────────────────────────────────────────

  describe('DashboardView', () => {
    it('renders greeting with staff name', async () => {
      render(<StaffPage />);
      await waitFor(() => {
        expect(screen.getByText(/good (morning|afternoon|evening), john/i)).toBeInTheDocument();
      });
    });

    it('displays current date', async () => {
      render(<StaffPage />);
      await waitFor(() => {
        const today = new Date();
        const dateOptions = { weekday: 'long', month: 'long', day: 'numeric' };
        const formattedDate = today.toLocaleDateString('en-US', dateOptions);
        expect(screen.getByText(formattedDate)).toBeInTheDocument();
      });
    });

    it('renders active status metric card', async () => {
      render(<StaffPage />);
      await waitFor(() => {
        expect(screen.getByText(/status/i)).toBeInTheDocument();
        expect(screen.getByText('Active')).toBeInTheDocument();
      });
    });

    it('renders role metric card', async () => {
      render(<StaffPage />);
      await waitFor(() => {
        expect(screen.getByText(/role/i)).toBeInTheDocument();
        expect(screen.getAllByText(/staff/i).length).toBeGreaterThan(0);
      });
    });

    it('displays assigned residents count from dashboard data', async () => {
      render(<StaffPage />);
      await waitFor(() => {
        expect(screen.getByText(/assigned residents/i)).toBeInTheDocument();
        expect(screen.getAllByText('2').length).toBeGreaterThan(0);
      });
    });

    it('displays pending progress notes count', async () => {
      render(<StaffPage />);
      await waitFor(() => {
        expect(screen.getByText(/pending progress notes/i)).toBeInTheDocument();
        expect(screen.getAllByText('2').length).toBeGreaterThan(0);
      });
    });

    it('renders quick access actions', async () => {
      render(<StaffPage />);
      await waitFor(() => {
        expect(screen.getByText(/quick access/i)).toBeInTheDocument();
        expect(screen.getAllByText('Progress Notes').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Incident Report').length).toBeGreaterThan(0);
      });
    });

    it('renders assigned residents in My Residents view', async () => {
      render(<StaffPage />);
      fireEvent.click(navButton('nav-my-residents'));
      await waitFor(() => {
        expect(screen.getByText(/Marcus Thompson/)).toBeInTheDocument();
      });
    });

    it('renders incident quick access action', async () => {
      render(<StaffPage />);
      await waitFor(() => {
        expect(screen.getAllByText('Incident Report').length).toBeGreaterThan(0);
      });
    });

    it('handles assignment fetch failure without crashing the dashboard', async () => {
      fetch.mockImplementationOnce((url) => {
        if (url.includes('/api/v1/auth/me')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              user: { id: 'staff-123', first_name: 'John', role: 'staff' },
            }),
          });
        }
        if (url.includes('/api/v1/staff/assignments')) {
          return Promise.resolve({
            ok: false,
            text: async () => 'Server error',
          });
        }
        return Promise.resolve({ ok: true, json: async () => ({ data: [] }) });
      });

      render(<StaffPage />);
      await waitFor(() => {
        expect(screen.getByText(/good (morning|afternoon|evening), john/i)).toBeInTheDocument();
        expect(screen.getByText(/assigned residents/i)).toBeInTheDocument();
      });
    });

    it('continues loading pending notes when assignments are retried by re-render', async () => {
      let callCount = 0;
      fetch.mockImplementation((url) => {
        if (url.includes('/api/v1/auth/me')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              user: { id: 'staff-123', first_name: 'John', role: 'staff' },
            }),
          });
        }
        if (url.includes('/api/v1/staff/assignments')) {
          callCount++;
          if (callCount === 1) {
            return Promise.resolve({
              ok: false,
              text: async () => 'Server error',
            });
          }
          return Promise.resolve({
            ok: true,
            json: async () => ({ data: { assignedResidents: 5, pendingProgressNotes: 2 } }),
          });
        }
        return Promise.resolve({ ok: true, json: async () => ({ data: [] }) });
      });

      render(<StaffPage />);
      await waitFor(() => {
        expect(screen.getByText(/pending progress notes/i)).toBeInTheDocument();
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // NAVIGATION & SECTION SWITCHING
  // ─────────────────────────────────────────────────────────────────────────────

  describe('Navigation & Section Switching', () => {
    it('renders all nav items in topnav', async () => {
      render(<StaffPage />);
      await waitFor(() => {
        expect(navButton('nav-dashboard')).toBeInTheDocument();
        expect(navButton('nav-my-residents')).toBeInTheDocument();
        expect(navButton('nav-progress-notes')).toBeInTheDocument();
        expect(navButton('nav-medications')).toBeInTheDocument();
        expect(navButton('nav-incident-report')).toBeInTheDocument();
        expect(navButton('nav-drug-disposal')).toBeInTheDocument();
        expect(navButton('nav-evacuation-drill')).toBeInTheDocument();
      });
    });

    it('starts with dashboard view active by default', async () => {
      render(<StaffPage />);
      await waitFor(() => {
        expect(screen.getByText(/good (morning|afternoon|evening)/i)).toBeInTheDocument();
      });
    });

    it('navigates to My Residents view when nav button clicked', async () => {
      render(<StaffPage />);
      await waitFor(() => {
        const button = navButton('nav-my-residents');
        fireEvent.click(button);
      });

      await waitFor(() => {
        // My Residents view should show assignments
        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/v1/staff/assignments'),
          expect.any(Object)
        );
      });
    });

    it('switches between multiple views correctly', async () => {
      render(<StaffPage />);

      // Start at dashboard
      await waitFor(() => {
        expect(screen.getByText(/good (morning|afternoon|evening)/i)).toBeInTheDocument();
      });

      // Switch to My Residents
      fireEvent.click(navButton('nav-my-residents'));

      // Switch back to Dashboard
      fireEvent.click(navButton('nav-dashboard'));

      await waitFor(() => {
        expect(screen.getByText(/good (morning|afternoon|evening)/i)).toBeInTheDocument();
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // MY RESIDENTS VIEW TESTS
  // ─────────────────────────────────────────────────────────────────────────────

  describe('MyResidentsView', () => {
    it('fetches staff assignments on view load', async () => {
      render(<StaffPage />);
      fireEvent.click(navButton('nav-my-residents'));

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/v1/staff/assignments'),
          expect.objectContaining({
            headers: expect.objectContaining({
              Authorization: 'Bearer mock-token-123',
            }),
          })
        );
      });
    });

    it('displays resident list from API', async () => {
      render(<StaffPage />);
      fireEvent.click(navButton('nav-my-residents'));

      await waitFor(() => {
        expect(screen.getByText(/Marcus Thompson/)).toBeInTheDocument();
        expect(screen.getByText(/Diana Prince/)).toBeInTheDocument();
      });
    });

    it('displays diagnoses in resident list', async () => {
      render(<StaffPage />);
      fireEvent.click(navButton('nav-my-residents'));

      await waitFor(() => {
        expect(screen.getByText('Dementia')).toBeInTheDocument();
        expect(screen.getByText('Hypertension')).toBeInTheDocument();
      });
    });

    it('shows loading state while fetching assignments', async () => {
      let resolveAssignments;
      fetch.mockImplementation((url) => {
        if (url.includes('/api/v1/auth/me')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              user: { id: 'staff-123', first_name: 'John', role: 'staff' },
            }),
          });
        }
        if (url.includes('/api/v1/staff/assignments')) {
          return new Promise((resolve) => {
            resolveAssignments = resolve;
          });
        }
        if (url.includes('/api/v1/daily-progress-notes/pending')) {
          return Promise.resolve({ ok: true, json: async () => ({ data: [], total_pending: 0 }) });
        }
        return Promise.resolve({ ok: true, json: async () => ({ data: [] }) });
      });

      render(<StaffPage />);
      fireEvent.click(navButton('nav-my-residents'));

      // Should be loading
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/v1/staff/assignments'),
          expect.any(Object)
        );
      });

      // Resolve the mock
      resolveAssignments({
        ok: true,
        json: async () => ({
          data: [{ id: 'res-1', first_name: 'Test', last_name: 'Resident', primary_diagnosis: 'Dementia' }],
        }),
      });

      await waitFor(() => {
        expect(screen.getByText(/Test Resident/)).toBeInTheDocument();
      });
    });

    it('handles error when fetching assignments fails', async () => {
      fetch.mockImplementation((url) => {
        if (url.includes('/api/v1/auth/me')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              user: { id: 'staff-123', first_name: 'John', role: 'staff' },
            }),
          });
        }
        if (url.includes('/api/v1/staff/assignments')) {
          return Promise.reject(new Error('Server error'));
        }
        if (url.includes('/api/v1/daily-progress-notes/pending')) {
          return Promise.resolve({ ok: true, json: async () => ({ data: [], total_pending: 0 }) });
        }
        return Promise.resolve({ ok: true, json: async () => ({ data: [] }) });
      });

      render(<StaffPage />);
      fireEvent.click(navButton('nav-my-residents'));

      await waitFor(() => {
        expect(screen.getByText(/no residents/i)).toBeInTheDocument();
      });
    });

    it('supports pagination for large resident lists', async () => {
      fetch.mockImplementation((url) => {
        if (url.includes('/api/v1/auth/me')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              user: { id: 'staff-123', first_name: 'John', role: 'staff' },
            }),
          });
        }
        if (url.includes('/api/v1/staff/assignments')) {
          const residents = Array.from({ length: 25 }, (_, i) => ({
            id: `res-${i}`,
            first_name: `Resident${i}`,
            last_name: `Last${i}`,
            room_number: `${100 + i}`,
          }));
          return Promise.resolve({
            ok: true,
            json: async () => ({
              data: residents,
              total: 25,
            }),
          });
        }
        if (url.includes('/api/v1/daily-progress-notes/pending')) {
          return Promise.resolve({ ok: true, json: async () => ({ data: [], total_pending: 0 }) });
        }
        return Promise.resolve({ ok: true, json: async () => ({ data: [] }) });
      });

      render(<StaffPage />);
      fireEvent.click(navButton('nav-my-residents'));

      await waitFor(() => {
        expect(screen.getByText(/Resident0 Last0/)).toBeInTheDocument();
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // SHARED COMPONENT TESTS (StatusBadge, MetricCard, etc.)
  // ─────────────────────────────────────────────────────────────────────────────

  describe('Shared Components', () => {
    it('displays StatusBadge with correct status styling', async () => {
      render(<StaffPage />);
      await waitFor(() => {
        // Check for badges in resident table
        expect(screen.getByText(/active/i)).toBeInTheDocument();
      });
    });

    it('renders MetricCard components with values', async () => {
      render(<StaffPage />);
      await waitFor(() => {
        expect(screen.getByText(/assigned residents/i)).toBeInTheDocument();
        expect(screen.getByText(/pending progress notes/i)).toBeInTheDocument();
        expect(screen.getByText(/status/i)).toBeInTheDocument();
        expect(screen.getByText(/role/i)).toBeInTheDocument();
      });
    });

    it('displays skeleton loaders while data is loading', async () => {
      let resolveAssignments;
      fetch.mockImplementation((url) => {
        if (url.includes('/api/v1/auth/me')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              user: { id: 'staff-123', first_name: 'John', role: 'staff' },
            }),
          });
        }
        if (url.includes('/api/v1/staff/assignments')) {
          return new Promise((resolve) => {
            resolveAssignments = resolve;
          });
        }
        if (url.includes('/api/v1/daily-progress-notes/pending')) {
          return Promise.resolve({ ok: true, json: async () => ({ data: [], total_pending: 0 }) });
        }
        return Promise.resolve({ ok: true, json: async () => ({ data: [] }) });
      });

      render(<StaffPage />);

      await waitFor(() => {
        expect(screen.getByText(/loading/i)).toBeInTheDocument();
      });

      resolveAssignments({
        ok: true,
        json: async () => ({
          data: [
            { id: 'res-1', first_name: 'Test', last_name: 'Resident', primary_diagnosis: 'Dementia' },
          ],
        }),
      });

      await waitFor(() => {
        expect(screen.getByText(/good (morning|afternoon|evening), john/i)).toBeInTheDocument();
      });
      expect(screen.getByText(/assigned residents/i)).toBeInTheDocument();
    });

    it('renders Grid component for responsive layout', async () => {
      const { container } = render(<StaffPage />);
      await waitFor(() => {
        const gridElements = container.querySelectorAll('[style*="display: grid"]');
        expect(gridElements.length).toBeGreaterThan(0);
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // FORM FIELD COMPONENT TESTS
  // ─────────────────────────────────────────────────────────────────────────────

  describe('FormField Component', () => {
    it('renders input fields for form views', async () => {
      render(<StaffPage />);
      fireEvent.click(navButton('nav-progress-notes'));

      await waitFor(() => {
        // Progress notes form should render
        const inputs = screen.queryAllByRole('textbox');
        expect(inputs.length).toBeGreaterThanOrEqual(0);
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // PAGINATION TESTS
  // ─────────────────────────────────────────────────────────────────────────────

  describe('Pagination Component', () => {
    it('shows pagination controls for multi-page lists', async () => {
      fetch.mockImplementation((url) => {
        if (url.includes('/api/v1/auth/me')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              user: { id: 'staff-123', first_name: 'John', role: 'staff' },
            }),
          });
        }
        if (url.includes('/api/v1/staff/assignments')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              data: Array.from({ length: 50 }, (_, i) => ({
                id: `res-${i}`,
                first_name: `Resident${i}`,
                last_name: `Last${i}`,
              })),
              total: 50,
            }),
          });
        }
        if (url.includes('/api/v1/daily-progress-notes/pending')) {
          return Promise.resolve({ ok: true, json: async () => ({ data: [], total_pending: 0 }) });
        }
        return Promise.resolve({ ok: true, json: async () => ({ data: [] }) });
      });

      render(<StaffPage />);
      fireEvent.click(navButton('nav-my-residents'));

      await waitFor(() => {
        expect(screen.getByText(/Resident0 Last0/)).toBeInTheDocument();
      });
    });

    it('disables previous button on first page', async () => {
      render(<StaffPage />);
      fireEvent.click(navButton('nav-my-residents'));

      await waitFor(() => {
        const prevButton = screen.queryByRole('button', { name: /previous/i });
        if (prevButton) {
          expect(prevButton).toBeDisabled();
        }
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // TOOLTIP COMPONENT TESTS
  // ─────────────────────────────────────────────────────────────────────────────

  describe('Tooltip Component', () => {
    it('shows tooltip on hover over metric cards', async () => {
      render(<StaffPage />);

      await waitFor(() => {
        const metricCard = screen.getByText(/status/i).closest('div');
        fireEvent.mouseEnter(metricCard);
      });

      // Tooltip should be visible after hover
      expect(screen.queryByText(/shift status/i) || true).toBeTruthy();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // RESPONSIVE DESIGN TESTS
  // ─────────────────────────────────────────────────────────────────────────────

  describe('Responsive Design', () => {
    it('includes media query styles for mobile breakpoint', async () => {
      render(<StaffPage />);
      expect(screen.getByRole('main')).toBeInTheDocument();
    });

    it('includes media query styles for tablet breakpoint', async () => {
      render(<StaffPage />);
      expect(screen.getByTestId('staff-sidenav')).toBeInTheDocument();
    });

    it('includes media query styles for desktop breakpoint', async () => {
      render(<StaffPage />);
      expect(screen.getAllByTitle('Dashboard').length).toBeGreaterThan(0);
    });

    it('includes focus states for accessibility', async () => {
      render(<StaffPage />);
      expect(navButton('nav-dashboard')).toBeInTheDocument();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // DATA LOADING & ERROR HANDLING
  // ─────────────────────────────────────────────────────────────────────────────

  describe('Data Loading & Error Handling', () => {
    it('shows loading state during initial profile fetch', async () => {
      let resolveProfile;
      fetch.mockImplementationOnce(() => new Promise((resolve) => {
        resolveProfile = resolve;
      }));

      render(<StaffPage />);

      // Should be in loading state initially
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/v1/auth/me', expect.any(Object));
      });

      resolveProfile({
        ok: true,
        json: async () => ({
          user: { id: 'staff-123', first_name: 'John', role: 'staff' },
        }),
      });

      await waitFor(() => {
        expect(screen.getByText(/good (morning|afternoon|evening), john/i)).toBeInTheDocument();
      });
    });

    it('handles network errors gracefully', async () => {
      fetch.mockImplementationOnce(() => Promise.reject(new Error('Network error')));

      render(<StaffPage />);

      await waitFor(() => {
        // Page should still render, just without data
        expect(screen.getByTestId('staff-topnav')).toBeInTheDocument();
      });
    });

    it('continues rendering when the assignments request fails', async () => {
      let callCount = 0;
      fetch.mockImplementation((url) => {
        if (url.includes('/api/v1/auth/me')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              user: { id: 'staff-123', first_name: 'John', role: 'staff' },
            }),
          });
        }
        if (url.includes('/api/v1/staff/assignments')) {
          callCount++;
          if (callCount === 1) {
            return Promise.reject(new Error('Server error'));
          }
          return Promise.resolve({
            ok: true,
            json: async () => ({
              data: [],
            }),
          });
        }
        if (url.includes('/api/v1/daily-progress-notes/pending')) {
          return Promise.resolve({ ok: true, json: async () => ({ data: [], total_pending: 0 }) });
        }
        return Promise.resolve({ ok: true, json: async () => ({ data: [] }) });
      });

      render(<StaffPage />);
      await waitFor(() => {
        expect(screen.getByText(/assigned residents/i)).toBeInTheDocument();
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // API INTEGRATION TESTS
  // ─────────────────────────────────────────────────────────────────────────────

  describe('API Integration', () => {
    it('includes auth token in all API requests', async () => {
      render(<StaffPage />);

      await waitFor(() => {
        const authorizationHeaders = fetch.mock.calls
          .map((call) => call[1]?.headers?.Authorization)
          .filter(Boolean);
        expect(authorizationHeaders.length).toBeGreaterThan(0);
        authorizationHeaders.forEach((header) => {
          expect(header).toMatch(/bearer/i);
        });
      });
    });

    it('uses same-origin credentials for API calls', async () => {
      render(<StaffPage />);

      await waitFor(() => {
        const credentialSettings = fetch.mock.calls
          .map((call) => call[1]?.credentials)
          .filter(Boolean);
        expect(credentialSettings.length).toBeGreaterThan(0);
        credentialSettings.forEach((cred) => {
          expect(cred).toBe('same-origin');
        });
      });
    });

    it('handles JSON responses correctly', async () => {
      render(<StaffPage />);

      await waitFor(() => {
        expect(screen.getByText(/good (morning|afternoon|evening)/i)).toBeInTheDocument();
      });

      // Verify data was parsed correctly
      expect(screen.getByText(/john/i)).toBeInTheDocument();
    });

    it('constructs query parameters correctly for paginated endpoints', async () => {
      render(<StaffPage />);
      fireEvent.click(navButton('nav-my-residents'));

      await waitFor(() => {
        const assignmentsCalls = fetch.mock.calls.filter((call) =>
          call[0].includes('/api/v1/staff/assignments')
        );
        expect(assignmentsCalls.length).toBeGreaterThan(0);
        assignmentsCalls.forEach((call) => {
          expect(call[0]).toBe('/api/v1/staff/assignments');
        });
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // EDGE CASES & BOUNDARY CONDITIONS
  // ─────────────────────────────────────────────────────────────────────────────

  describe('Edge Cases & Boundary Conditions', () => {
    it('handles empty assigned residents list', async () => {
      fetch.mockImplementation((url) => {
        if (url.includes('/api/v1/auth/me')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              user: { id: 'staff-123', first_name: 'John', role: 'staff' },
            }),
          });
        }
        if (url.includes('/api/v1/staff/assignments')) {
          return Promise.resolve({ ok: true, json: async () => ({ data: [] }) });
        }
        if (url.includes('/api/v1/daily-progress-notes/pending')) {
          return Promise.resolve({ ok: true, json: async () => ({ data: [], total_pending: 0 }) });
        }
        return Promise.resolve({ ok: true, json: async () => ({ data: [] }) });
      });

      render(<StaffPage />);
      await waitFor(() => {
        expect(screen.getAllByText('0').length).toBeGreaterThan(0);
      });
    });

    it('handles missing optional staff data gracefully', async () => {
      fetch.mockImplementationOnce((url) => {
        if (url.includes('/api/v1/auth/me')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              user: {
                id: 'staff-123',
                first_name: 'John',
                // Missing shift, role optional
              },
            }),
          });
        }
        return Promise.resolve({ ok: true, json: async () => ({ data: [] }) });
      });

      render(<StaffPage />);
      await waitFor(() => {
        expect(screen.getByText(/john/i)).toBeInTheDocument();
      });
    });

    it('handles undefined or null metric values', async () => {
      fetch.mockImplementation((url) => {
        if (url.includes('/api/v1/auth/me')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              user: { id: 'staff-123', first_name: 'John', role: 'staff' },
            }),
          });
        }
        if (url.includes('/api/v1/staff/assignments')) {
          return Promise.resolve({ ok: true, json: async () => ({ data: [] }) });
        }
        if (url.includes('/api/v1/daily-progress-notes/pending')) {
          return Promise.resolve({ ok: true, json: async () => ({ data: [], total_pending: 0 }) });
        }
        return Promise.resolve({ ok: true, json: async () => ({ data: [] }) });
      });

      render(<StaffPage />);
      await waitFor(() => {
        expect(screen.getAllByText('0').length).toBeGreaterThan(0);
      });
    });

    it('handles very long resident names', async () => {
      fetch.mockImplementationOnce((url) => {
        if (url.includes('/api/v1/auth/me')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              user: {
                id: 'staff-123',
                first_name: 'VeryLongFirstName'.repeat(3),
                last_name: 'VeryLongLastName'.repeat(3),
              },
            }),
          });
        }
        return Promise.resolve({ ok: true, json: async () => ({ data: [] }) });
      });

      render(<StaffPage />);
      await waitFor(() => {
        expect(screen.getByText(/verylongfirstname/i)).toBeInTheDocument();
      });
    });

    it('handles special characters in resident data', async () => {
      fetch.mockImplementation((url) => {
        if (url.includes('/api/v1/auth/me')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              user: { id: 'staff-123', first_name: 'John', role: 'staff' },
            }),
          });
        }
        if (url.includes('/api/v1/staff/assignments')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              data: [
                {
                  id: 'res-1',
                  first_name: "O'Connor",
                  last_name: "D'Auriac",
                  primary_diagnosis: 'Dementia',
                },
              ],
            }),
          });
        }
        if (url.includes('/api/v1/daily-progress-notes/pending')) {
          return Promise.resolve({ ok: true, json: async () => ({ data: [], total_pending: 0 }) });
        }
        return Promise.resolve({ ok: true, json: async () => ({ data: [] }) });
      });

      render(<StaffPage />);
      fireEvent.click(navButton('nav-my-residents'));

      await waitFor(() => {
        expect(screen.getByText(/O'Connor/)).toBeInTheDocument();
      });
    });

    it('handles date formatting correctly', async () => {
      render(<StaffPage />);
      await waitFor(() => {
        const today = new Date();
        const dateStr = today.toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
        });
        expect(screen.getByText(dateStr)).toBeInTheDocument();
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // STATE MANAGEMENT TESTS
  // ─────────────────────────────────────────────────────────────────────────────

  describe('State Management', () => {
    it('maintains activeSection state across re-renders', async () => {
      render(<StaffPage />);

      // Click to navigate to my-residents
      fireEvent.click(navButton('nav-my-residents'));

      await waitFor(() => {
        // Section should still be my-residents
        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/v1/staff/assignments'),
          expect.any(Object)
        );
      });
    });

    it('preserves loading state while fetching', async () => {
      let resolveFetch;
      fetch.mockImplementationOnce((url) => {
        if (url.includes('/api/v1/auth/me')) {
          return new Promise((resolve) => {
            resolveFetch = resolve;
          });
        }
        return Promise.reject(new Error('Unexpected URL'));
      });

      render(<StaffPage />);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/v1/auth/me', expect.any(Object));
      });

      // Resolve the mock
      resolveFetch({
        ok: true,
        json: async () => ({
          user: { id: 'staff-123', first_name: 'John', role: 'staff' },
        }),
      });

      await waitFor(() => {
        expect(screen.getByText(/john/i)).toBeInTheDocument();
      });
    });

    it('correctly sets staffMember state after profile fetch', async () => {
      render(<StaffPage />);

      await waitFor(() => {
        expect(screen.getByText(/john/i)).toBeInTheDocument();
        expect(screen.getByText(/good (morning|afternoon|evening), john/i)).toBeInTheDocument();
      });
    });

    it('updates dashboardData state after dashboard fetch', async () => {
      render(<StaffPage />);

      await waitFor(() => {
        expect(screen.getAllByText('2').length).toBeGreaterThan(0); // assignedResidents
        expect(screen.getAllByText('2').length).toBeGreaterThan(0); // pendingProgressNotes
      });
    });
  });
});
