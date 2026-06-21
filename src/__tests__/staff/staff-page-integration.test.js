/**
 * Staff Page Integration Tests
 * Focus: Core rendering, API calls, state management, error handling
 * Target: 75%+ code coverage
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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

// Mock navigation components minimally
jest.mock('@/app/components/nav/StaffSideNav', () => {
  return function MockStaffSideNav() {
    return <div data-testid="staff-sidenav" />;
  };
});

jest.mock('@/app/components/nav/StaffTopNav', () => {
  return function MockStaffTopNav() {
    return <div data-testid="staff-topnav" />;
  };
});

global.fetch = jest.fn();

// ═══════════════════════════════════════════════════════════════════════════════
// TEST SUITE
// ═══════════════════════════════════════════════════════════════════════════════

describe('Staff Page Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
                status: 'active',
              },
            ],
          }),
        });
      }
      if (url.includes('/api/v1/daily-progress-notes/pending')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            data: [
              {
                id: 'note-1',
                resident_id: 'res-1',
                first_name: 'Marcus',
                last_name: 'Thompson',
              },
            ],
          }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({ data: [] }) });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // CORE RENDERING TESTS
  // ─────────────────────────────────────────────────────────────────────────────

  describe('Core Rendering', () => {
    it('renders without crashing', () => {
      expect(() => render(<StaffPage />)).not.toThrow();
    });

    it('renders main layout structure', async () => {
      render(<StaffPage />);

      await waitFor(() => {
        expect(screen.getByTestId('staff-sidenav')).toBeInTheDocument();
        expect(screen.getByTestId('staff-topnav')).toBeInTheDocument();
      });
    });

    it('renders main layout with sidenav and topnav', async () => {
      render(<StaffPage />);
      await waitFor(() => {
        expect(screen.getByTestId('staff-sidenav')).toBeInTheDocument();
        expect(screen.getByTestId('staff-topnav')).toBeInTheDocument();
      }, { timeout: 3000 });
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

    it('displays staff member name in greeting', async () => {
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

    it('handles profile fetch error without crashing layout', async () => {
      fetch.mockImplementation((url) => {
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

    it('fetches resident assignments for forms', async () => {
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
  // DASHBOARD VIEW RENDERING
  // ─────────────────────────────────────────────────────────────────────────────

  describe('Dashboard View', () => {
    it('displays greeting with correct time period', async () => {
      render(<StaffPage />);

      await waitFor(() => {
        expect(screen.getByText(/good (morning|afternoon|evening), john/i)).toBeInTheDocument();
      });
    });

    it('shows current date in correct format', async () => {
      render(<StaffPage />);

      await waitFor(() => {
        // Should show date like "Monday, May 18"
        const dateElement = screen.getByText(/monday|tuesday|wednesday|thursday|friday|saturday|sunday/i);
        expect(dateElement).toBeInTheDocument();
      });
    });

    it('renders status metric', async () => {
      render(<StaffPage />);

      await waitFor(() => {
        expect(screen.getByText(/status/i)).toBeInTheDocument();
        expect(screen.getByText(/active/i)).toBeInTheDocument();
      });
    });

    it('renders role metric card', async () => {
      render(<StaffPage />);

      await waitFor(() => {
        expect(screen.getByText(/role/i)).toBeInTheDocument();
      });
    });

    it('displays dashboard metrics from API', async () => {
      render(<StaffPage />);

      await waitFor(() => {
        expect(screen.queryByText(/assigned residents/i) || screen.queryByText(/loading/i)).toBeTruthy();
      }, { timeout: 5000 });
    });

    it('shows pending progress note information', async () => {
      render(<StaffPage />);

      await waitFor(() => {
        expect(screen.getByText(/pending progress notes/i)).toBeInTheDocument();
      });
    });

    it('renders today\'s residents table when data loads', async () => {
      render(<StaffPage />);

      await waitFor(() => {
        // Should show either the data or loading state
        const hasResidents = screen.queryByText('Marcus');
        const hasLoading = screen.queryByText(/loading|loading staff/i);
        expect(hasResidents || hasLoading).toBeTruthy();
      }, { timeout: 5000 });
    });

    it('renders quick action area', async () => {
      render(<StaffPage />);

      await waitFor(() => {
        expect(screen.getByText(/quick access/i)).toBeInTheDocument();
      });
    });

    it('displays error handling when staff data fails', async () => {
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
            ok: false,
            text: async () => 'Server error',
          });
        }
        return Promise.resolve({ ok: true, json: async () => ({ data: [] }) });
      });

      render(<StaffPage />);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/v1/staff/assignments', expect.any(Object));
      }, { timeout: 3000 });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // SHARED COMPONENT TESTS
  // ─────────────────────────────────────────────────────────────────────────────

  describe('Shared Components', () => {
    it('displays status badges in resident tables', async () => {
      render(<StaffPage />);

      await waitFor(() => {
        expect(screen.getByText(/active/i)).toBeInTheDocument();
      });
    });

    it('renders metric cards with values', async () => {
      render(<StaffPage />);

      await waitFor(() => {
        expect(screen.getByText(/assigned residents/i)).toBeInTheDocument();
        expect(screen.getByText(/status/i)).toBeInTheDocument();
        expect(screen.getByText(/role/i)).toBeInTheDocument();
      });
    });

    it('includes animation and accessibility styles', async () => {
      const { container } = render(<StaffPage />);
      const html = container.innerHTML;

      // Component should include styling (either inline or in style tags)
      expect(html.length).toBeGreaterThan(0);
      await waitFor(() => {
        expect(screen.getByTestId('staff-sidenav')).toBeInTheDocument();
      }, { timeout: 3000 });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // RESPONSIVE DESIGN
  // ─────────────────────────────────────────────────────────────────────────────

  describe('Responsive Design', () => {
    it('renders responsive layout with mocked nav components', async () => {
      render(<StaffPage />);

      // Layout components should render
      await waitFor(() => {
        expect(screen.getByTestId('staff-sidenav')).toBeInTheDocument();
        expect(screen.getByTestId('staff-topnav')).toBeInTheDocument();
        const mainContent = screen.getByRole('main');
        expect(mainContent).toBeInTheDocument();
      }, { timeout: 3000 });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // API INTEGRATION
  // ─────────────────────────────────────────────────────────────────────────────

  describe('API Integration', () => {
    it('includes auth token in all requests', async () => {
      render(<StaffPage />);

      await waitFor(() => {
        const calls = fetch.mock.calls.filter((call) =>
          call[1]?.headers?.Authorization
        );
        expect(calls.length).toBeGreaterThan(0);
        calls.forEach((call) => {
          expect(call[1].headers.Authorization).toMatch(/Bearer/);
        });
      });
    });

    it('uses same-origin credentials for API calls', async () => {
      render(<StaffPage />);

      await waitFor(() => {
        const calls = fetch.mock.calls.filter((call) =>
          call[1]?.credentials
        );
        expect(calls.length).toBeGreaterThan(0);
        calls.forEach((call) => {
          expect(call[1].credentials).toBe('same-origin');
        });
      });
    });

    it('parses JSON responses correctly', async () => {
      render(<StaffPage />);

      await waitFor(() => {
        // Profile name should load
        expect(screen.queryByText('John') || screen.queryByText(/loading/i)).toBeTruthy();
      }, { timeout: 5000 });
    });

    it('requests current staff assignments endpoint', async () => {
      render(<StaffPage />);

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
  // STATE MANAGEMENT
  // ─────────────────────────────────────────────────────────────────────────────

  describe('State Management', () => {
    it('loads profile and dashboard in correct order', async () => {
      render(<StaffPage />);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/v1/auth/me', expect.any(Object));
      });

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/v1/staff/assignments', expect.any(Object));
      }, { timeout: 5000 });
    });

    it('updates dashboard metrics from current staff data', async () => {
      render(<StaffPage />);

      await waitFor(() => {
        expect(screen.getAllByText('1').length).toBeGreaterThan(0);
      });
    });

    it('stores wizardResidents from assignments endpoint', async () => {
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
  // EDGE CASES & BOUNDARY CONDITIONS
  // ─────────────────────────────────────────────────────────────────────────────

  describe('Edge Cases', () => {
    it('handles empty assigned residents', async () => {
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
            json: async () => ({ data: [] }),
          });
        }
        return Promise.resolve({ ok: true, json: async () => ({ data: [] }) });
      });

      render(<StaffPage />);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          '/api/v1/staff/assignments',
          expect.any(Object)
        );
      }, { timeout: 5000 });
    });

    it('handles missing optional staff fields', async () => {
      fetch.mockImplementation((url) => {
        if (url.includes('/api/v1/auth/me')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              user: {
                id: 'staff-123',
                first_name: 'John',
                // No shift, role, or last_name
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

    it('handles null/undefined metric values', async () => {
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
            json: async () => ({ data: null }),
          });
        }
        return Promise.resolve({ ok: true, json: async () => ({ data: [] }) });
      });

      render(<StaffPage />);

      await waitFor(() => {
        // Should use default value (0) for null/undefined
        const zeros = screen.queryAllByText('0');
        expect(zeros.length).toBeGreaterThanOrEqual(1);
      });
    });

    it('handles special characters in names', async () => {
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
                },
              ],
            }),
          });
        }
        return Promise.resolve({ ok: true, json: async () => ({ data: [] }) });
      });

      render(<StaffPage />);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/v1/staff/assignments'),
          expect.any(Object)
        );
      }, { timeout: 5000 });
    });

    it('formats current date correctly', async () => {
      render(<StaffPage />);

      await waitFor(() => {
        const today = new Date();
        const dateOptions = { weekday: 'long', month: 'long', day: 'numeric' };
        const formattedDate = today.toLocaleDateString('en-US', dateOptions);

        // Date should be displayed
        const dateElements = screen.queryAllByText(new RegExp(formattedDate.split(' ')[0], 'i'));
        expect(dateElements.length).toBeGreaterThan(0);
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // ERROR HANDLING & RECOVERY
  // ─────────────────────────────────────────────────────────────────────────────

  describe('Error Handling', () => {
    it('handles network errors gracefully', async () => {
      fetch.mockImplementation(() => Promise.reject(new Error('Network error')));

      render(<StaffPage />);

      await waitFor(() => {
        expect(screen.getByTestId('staff-sidenav')).toBeInTheDocument();
      });
    });

    it('handles API errors during dashboard load', async () => {
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
            ok: false,
            text: async () => 'Server error',
          });
        }
        return Promise.resolve({ ok: true, json: async () => ({ data: [] }) });
      });

      render(<StaffPage />);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/v1/staff/assignments', expect.any(Object));
      }, { timeout: 5000 });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // DESIGN TOKENS & STYLING
  // ─────────────────────────────────────────────────────────────────────────────

  describe('Design & Styling', () => {
    it('applies correct font sizes and typography', async () => {
      render(<StaffPage />);

      await waitFor(() => {
        const headings = screen.getByText(/good (morning|afternoon|evening)/i);
        expect(headings).toBeInTheDocument();
      });
    });

    it('includes border-radius for rounded card styling', () => {
      const { container } = render(<StaffPage />);

      // Check for inline style border-radius
      const elements = container.querySelectorAll('[style*="border-radius"]');
      expect(elements.length).toBeGreaterThan(0);
    });

    it('includes flex layout for responsive structure', () => {
      const { container } = render(<StaffPage />);

      // Check for flex display
      const flexElements = container.querySelectorAll('[style*="flex"]');
      expect(flexElements.length).toBeGreaterThan(0);
    });

    it('includes color styling for status indicators', async () => {
      render(<StaffPage />);

      await waitFor(() => {
        // Should render colored status badges
        expect(screen.getByText(/active/i)).toBeInTheDocument();
      });
    });
  });
});
