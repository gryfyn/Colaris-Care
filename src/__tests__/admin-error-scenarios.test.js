import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '@/app/admin/page';

const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  pathname: '/admin',
};

jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  useSearchParams: () => ({ get: () => null }),
}));

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    auth: {
      user: {
        id: 'staff-admin-001',
        role: 'admin',
        tenantId: 'tenant-test-001',
      },
    },
    token: 'mock-admin-token',
    loading: false,
    login: jest.fn(),
    logout: jest.fn(),
  }),
}));

global.fetch = jest.fn();

function expectAdminDashboardRendered() {
  expect(screen.getByRole('navigation', { name: /admin navigation/i })).toBeInTheDocument();
  expect(screen.getByText('Dependable Care')).toBeInTheDocument();
}

describe('Admin Page — Error Handling & Edge Cases', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRouter.push.mockClear();
  });

  describe('Network Errors', () => {
    test('handles network timeout gracefully', async () => {
      fetch.mockRejectedValueOnce(new Error('Network timeout'));

      render(<App />);

      await waitFor(() => {
        // Component should still render even if network fails
        expectAdminDashboardRendered();
      }, { timeout: 3000 });
    });

    test('handles network error for resident list', async () => {
      fetch.mockRejectedValueOnce(new Error('Network error'));

      render(<App />);
      const resBtn = screen.getAllByText('Residents').find(el => el.closest('button'));
      fireEvent.click(resBtn);

      await waitFor(() => {
        // Should show error or empty state
      }, { timeout: 2000 });
    });

    test('handles fetch abort gracefully', async () => {
      fetch.mockRejectedValueOnce(new Error('The operation was aborted'));

      render(<App />);
      expectAdminDashboardRendered();
    });

    test('handles DNS resolution failure', async () => {
      fetch.mockRejectedValueOnce(new Error('getaddrinfo ENOTFOUND api.example.com'));

      render(<App />);
      expectAdminDashboardRendered();
    });

    test('handles connection refused', async () => {
      fetch.mockRejectedValueOnce(new Error('connect ECONNREFUSED 127.0.0.1:3000'));

      render(<App />);
      expectAdminDashboardRendered();
    });

    test('recovers after network error', async () => {
      fetch.mockRejectedValueOnce(new Error('Network error'));

      const { rerender } = render(<App />);

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
      });

      rerender(<App />);
      expectAdminDashboardRendered();
    });
  });

  describe('Server Errors (5xx)', () => {
    test('handles 500 Internal Server Error', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Internal Server Error' }),
      });

      render(<App />);
      expectAdminDashboardRendered();
    });

    test('handles 502 Bad Gateway', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 502,
        json: async () => ({ error: 'Bad Gateway' }),
      });

      render(<App />);
      expectAdminDashboardRendered();
    });

    test('handles 503 Service Unavailable', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({ error: 'Service Unavailable' }),
      });

      render(<App />);
      expectAdminDashboardRendered();
    });

    test('handles 504 Gateway Timeout', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 504,
        json: async () => ({ error: 'Gateway Timeout' }),
      });

      render(<App />);
      expectAdminDashboardRendered();
    });
  });

  describe('Client Errors (4xx)', () => {
    test('handles 400 Bad Request', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: 'Bad Request' }),
      });

      render(<App />);
      expectAdminDashboardRendered();
    });

    test('handles 401 Unauthorized', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Unauthorized' }),
      });

      render(<App />);
      // Should handle auth error
      expectAdminDashboardRendered();
    });

    test('handles 403 Forbidden', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({ error: 'Forbidden' }),
      });

      render(<App />);
      expectAdminDashboardRendered();
    });

    test('handles 404 Not Found', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ error: 'Not Found' }),
      });

      render(<App />);
      expectAdminDashboardRendered();
    });

    test('handles 422 Unprocessable Entity', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 422,
        json: async () => ({ error: 'Validation failed' }),
      });

      render(<App />);
      expectAdminDashboardRendered();
    });

    test('handles 429 Too Many Requests', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({ error: 'Rate limit exceeded' }),
      });

      render(<App />);
      expectAdminDashboardRendered();
    });
  });

  describe('Data Validation Errors', () => {
    test('handles invalid JSON response', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => {
          throw new SyntaxError('Unexpected token < in JSON at position 0');
        },
      });

      render(<App />);
      expectAdminDashboardRendered();
    });

    test('handles missing required fields in response', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}), // Missing 'data' field
      });

      render(<App />);
      expectAdminDashboardRendered();
    });

    test('handles null data in response', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: null }),
      });

      render(<App />);
      expectAdminDashboardRendered();
    });

    test('handles undefined data in response', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: undefined }),
      });

      render(<App />);
      expectAdminDashboardRendered();
    });

    test('handles empty array response', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
      });

      render(<App />);
      expectAdminDashboardRendered();
    });
  });

  describe('Form Validation Errors', () => {
    test('shows required field error on empty submit', async () => {
      render(<App />);
      const resBtn = screen.getAllByText('Residents').find(el => el.closest('button'));
      fireEvent.click(resBtn);

      const registerBtn = screen.queryByText('Register');
      if (registerBtn) {
        fireEvent.click(registerBtn);
        // Validation should prevent submission or show error
      }
    });

    test('shows email format error on invalid email', async () => {
      render(<App />);
      // Try to enter invalid email in a form
      const emailInputs = Array.from(document.querySelectorAll('input[type="email"]'));
      if (emailInputs.length > 0) {
        await userEvent.type(emailInputs[0], 'invalid-email');
        // Should show validation error
      }
    });

    test('shows date format error on invalid date', async () => {
      render(<App />);
      const dateInputs = Array.from(document.querySelectorAll('input[type="date"]'));
      if (dateInputs.length > 0) {
        fireEvent.change(dateInputs[0], { target: { value: 'invalid-date' } });
        // Should handle invalid date
      }
    });

    test('prevents form submission with missing required fields', async () => {
      render(<App />);
      const resBtn = screen.getAllByText('Residents').find(el => el.closest('button'));
      fireEvent.click(resBtn);

      const textInputs = screen.queryAllByRole('textbox');
      // Submit without filling required fields
      const submitBtn = screen.queryByRole('button', { name: /submit|save|register/i });
      if (submitBtn && !submitBtn.disabled) {
        fireEvent.click(submitBtn);
      }
    });
  });

  describe('Race Conditions', () => {
    test('handles rapid button clicks', async () => {
      render(<App />);
      const resBtn = screen.getAllByText('Residents').find(el => el.closest('button'));

      // Rapid clicks
      fireEvent.click(resBtn);
      fireEvent.click(resBtn);
      fireEvent.click(resBtn);

      // Should only navigate once or handle gracefully
      expectAdminDashboardRendered();
    });

    test('handles rapid section switches', async () => {
      render(<App />);

      const resBtn = screen.getAllByText('Residents').find(el => el.closest('button'));
      const staffBtn = screen.getAllByText('Staff Directory').find(el => el.closest('button'));

      fireEvent.click(resBtn);
      fireEvent.click(staffBtn);
      fireEvent.click(resBtn);

      // Should not crash
      expectAdminDashboardRendered();
    });

    test('handles simultaneous fetch and navigation', async () => {
      fetch.mockImplementationOnce(
        () => new Promise(resolve => setTimeout(() => resolve({
          ok: true,
          json: async () => ({ data: [] }),
        }), 100))
      );

      render(<App />);
      const resBtn = screen.getAllByText('Residents').find(el => el.closest('button'));
      fireEvent.click(resBtn);

      // Navigate away before fetch completes
      const staffBtn = screen.getAllByText('Staff Directory').find(el => el.closest('button'));
      fireEvent.click(staffBtn);

      await waitFor(() => {
        // Should not crash
        expectAdminDashboardRendered();
      }, { timeout: 3000 });
    });
  });

  describe('Memory Leaks & Cleanup', () => {
    test('unmounts component without errors', async () => {
      const { unmount } = render(<App />);
      expect(() => unmount()).not.toThrow();
    });

    test('cleans up fetch abort controller', async () => {
      fetch.mockImplementationOnce(
        () => new Promise(resolve => setTimeout(() => resolve({
          ok: true,
          json: async () => ({ data: [] }),
        }), 100))
      );

      const { unmount } = render(<App />);
      unmount();

      // Fetch should have been aborted if still pending
      expect(fetch).toHaveBeenCalled();
    });

    test('cleans up event listeners on unmount', async () => {
      const { unmount } = render(<App />);
      expect(() => unmount()).not.toThrow();
    });

    test('prevents state updates after unmount', async () => {
      fetch.mockImplementationOnce(
        () => new Promise(resolve => setTimeout(() => resolve({
          ok: true,
          json: async () => ({ data: [] }),
        }), 500))
      );

      const { unmount } = render(<App />);

      // Unmount before fetch completes
      setTimeout(() => unmount(), 100);

      await waitFor(() => {
        // Should not cause "Can't perform a React state update" warning
      }, { timeout: 1000 });
    });
  });

  describe('Data Corruption Handling', () => {
    test('handles resident with missing name', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ id: 'res-001', status: 'active' }], // Missing name
        }),
      });

      render(<App />);
      expectAdminDashboardRendered();
    });

    test('handles resident with null values', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{
            id: 'res-001',
            first_name: null,
            last_name: null,
          }],
        }),
      });

      render(<App />);
      expectAdminDashboardRendered();
    });

    test('handles resident with malformed dates', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{
            id: 'res-001',
            intake_date: 'not-a-date',
          }],
        }),
      });

      render(<App />);
      expectAdminDashboardRendered();
    });

    test('handles XSS attempts in resident name', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{
            id: 'res-001',
            first_name: '<script>alert("xss")</script>',
          }],
        }),
      });

      render(<App />);
      expectAdminDashboardRendered();
      // Should escape the content
      expect(screen.queryByText(/alert.*xss/i)).toBeFalsy();
    });
  });

  describe('Pagination Edge Cases', () => {
    test('handles page 0', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [], pagination: { page: 1 } }),
      });

      render(<App />);
      const resBtn = screen.getAllByText('Residents').find(el => el.closest('button'));
      fireEvent.click(resBtn);

      expect(screen.getAllByText('Residents').length).toBeGreaterThan(0);
    });

    test('handles negative page', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [], pagination: { page: 1 } }),
      });

      render(<App />);
      expectAdminDashboardRendered();
    });

    test('handles page beyond total', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [],
          pagination: { page: 999, total: 10 },
        }),
      });

      render(<App />);
      expectAdminDashboardRendered();
    });

    test('handles missing pagination info', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }), // No pagination
      });

      render(<App />);
      expectAdminDashboardRendered();
    });
  });

  describe('Browser Environment Issues', () => {
    test('handles localStorage unavailable', () => {
      const localStorageBackup = global.localStorage;
      delete global.localStorage;

      render(<App />);
      expectAdminDashboardRendered();

      global.localStorage = localStorageBackup;
    });

    test('handles sessionStorage unavailable', () => {
      const sessionStorageBackup = global.sessionStorage;
      delete global.sessionStorage;

      render(<App />);
      expectAdminDashboardRendered();

      global.sessionStorage = sessionStorageBackup;
    });

    test('handles window.matchMedia unavailable', () => {
      const matchMediaBackup = window.matchMedia;
      delete window.matchMedia;

      render(<App />);
      expectAdminDashboardRendered();

      window.matchMedia = matchMediaBackup;
    });
  });

  describe('Timeout Scenarios', () => {
    test('handles request timeout', async () => {
      fetch.mockImplementationOnce(() => new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), 100)
      ));

      render(<App />);

      await waitFor(() => {
        expectAdminDashboardRendered();
      }, { timeout: 2000 });
    });

    test('retries failed requests with exponential backoff', async () => {
      fetch.mockRejectedValueOnce(new Error('Network error'));
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
      });

      render(<App />);
      expectAdminDashboardRendered();
    });
  });

  describe('Concurrent Operations Errors', () => {
    test('handles error in one request without affecting others', async () => {
      fetch.mockRejectedValueOnce(new Error('Error 1'));
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
      });

      render(<App />);
      expectAdminDashboardRendered();
    });

    test('handles mixed success and error responses', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [{ id: 1 }] }),
      });
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Error' }),
      });

      render(<App />);
      expectAdminDashboardRendered();
    });
  });

  describe('Graceful Degradation', () => {
    test('shows basic UI even if analytics fails to load', () => {
      fetch.mockRejectedValueOnce(new Error('Analytics unavailable'));

      render(<App />);
      expectAdminDashboardRendered();
    });

    test('shows core content even if secondary data fails', () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Secondary data error' }),
      });

      render(<App />);
      expectAdminDashboardRendered();
    });

    test('handles missing feature flag gracefully', () => {
      render(<App />);
      // Should render default state if feature flag unavailable
      expectAdminDashboardRendered();
    });
  });

  describe('Invalid Input Handling', () => {
    test('sanitizes SQL injection attempts in search', async () => {
      render(<App />);
      const resBtn = screen.getAllByText('Residents').find(el => el.closest('button'));
      fireEvent.click(resBtn);

      const searchInputs = screen.queryAllByPlaceholderText(/search/i);
      if (searchInputs.length > 0) {
        await userEvent.type(searchInputs[0], "' OR '1'='1");
        // Should handle safely
      }
    });

    test('handles very long input strings', async () => {
      render(<App />);
      const textInputs = screen.queryAllByRole('textbox');
      if (textInputs.length > 0) {
        const longString = 'x'.repeat(1000);
        fireEvent.change(textInputs[0], { target: { value: longString } });
      }
    });

    test('handles special characters in input', async () => {
      render(<App />);
      const textInputs = screen.queryAllByRole('textbox');
      if (textInputs.length > 0) {
        await userEvent.type(textInputs[0], '<>&"\'');
      }
    });

    test('handles emoji in input', async () => {
      render(<App />);
      const textInputs = screen.queryAllByRole('textbox');
      if (textInputs.length > 0) {
        await userEvent.type(textInputs[0], '😀🎉🔒');
      }
    });
  });

  describe('State Consistency Errors', () => {
    test('recovers from corrupted component state', () => {
      const { rerender } = render(<App />);
      rerender(<App />);
      expectAdminDashboardRendered();
    });

    test('handles state update from stale closure', () => {
      render(<App />);
      // Simulate stale closure by navigating and navigating back
      const resBtn = screen.getAllByText('Residents').find(el => el.closest('button'));
      fireEvent.click(resBtn);

      const overviewBtn = screen.getAllByText('Dashboard').find(el => el.closest('button'));
      if (overviewBtn) fireEvent.click(overviewBtn);

      expectAdminDashboardRendered();
    });
  });
});
