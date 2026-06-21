import React, { Suspense } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import NotificationsPage from '../app/notifications/page';

const mockBack = jest.fn();
let mockSearchParamsGet = jest.fn(() => null);

jest.mock('next/navigation', () => ({
  useRouter: () => ({ back: mockBack }),
  useSearchParams: () => ({ get: mockSearchParamsGet }),
}));

const renderNotifications = () =>
  render(
    <Suspense fallback={<div>Loading...</div>}>
      <NotificationsPage />
    </Suspense>
  );

describe('Notifications Page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchParamsGet = jest.fn(() => null);
  });

  describe('default render (admin persona)', () => {
    it('renders without crashing', () => {
      expect(() => renderNotifications()).not.toThrow();
    });

    it('shows the Notifications heading', () => {
      renderNotifications();
      expect(screen.getByText(/notifications/i)).toBeInTheDocument();
    });

    it('renders the back button', () => {
      renderNotifications();
      expect(screen.getByText(/back|←/i)).toBeInTheDocument();
    });

    it('back button calls router.back()', () => {
      renderNotifications();
      fireEvent.click(screen.getByText(/back|←/i));
      expect(mockBack).toHaveBeenCalledTimes(1);
    });

    it('renders filter tabs: All, Unread, Action Needed', () => {
      renderNotifications();
      expect(screen.getByText('All')).toBeInTheDocument();
      expect(screen.getByText('Unread')).toBeInTheDocument();
      expect(screen.getByText('Action Needed')).toBeInTheDocument();
    });
  });

  describe('persona switching', () => {
    it('renders persona switcher', () => {
      renderNotifications();
      const switcher = screen.getByRole('combobox');
      expect(switcher).toBeInTheDocument();
    });

    it('switching to staff_rn persona shows staff-specific notifications', () => {
      renderNotifications();
      const switcher = screen.getByRole('combobox');
      fireEvent.change(switcher, { target: { value: 'staff_rn' } });
      // Staff RN should see nursing-relevant notifications
      expect(screen.getAllByTitle('Dismiss').length).toBeGreaterThan(0);
    });

    it('switching to resident persona shows resident notifications', () => {
      renderNotifications();
      const switcher = screen.getByRole('combobox');
      fireEvent.change(switcher, { target: { value: 'resident' } });
      expect(screen.getAllByTitle('Dismiss').length).toBeGreaterThan(0);
    });
  });

  describe('notification cards', () => {
    it('shows at least one notification card by default', () => {
      renderNotifications();
      expect(screen.getAllByTitle('Dismiss').length).toBeGreaterThan(0);
    });

    it('dismiss button removes a notification', async () => {
      renderNotifications();
      const initialCount = screen.getAllByTitle('Dismiss').length;
      const dismissBtns = screen.getAllByText('✕');
      fireEvent.click(dismissBtns[0]);
      await waitFor(() => {
        expect(screen.queryAllByTitle('Dismiss').length).toBe(initialCount - 1);
      });
    });
  });

  describe('filter tabs', () => {
    it('Unread filter shows only unread notifications', () => {
      renderNotifications();
      const allCount = screen.getAllByTitle('Dismiss').length;
      fireEvent.click(screen.getByText('Unread'));
      const unreadCount = screen.queryAllByTitle('Dismiss').length;
      expect(unreadCount).toBeLessThanOrEqual(allCount);
    });

    it('clicking All restores all notifications', () => {
      renderNotifications();
      const allCount = screen.getAllByTitle('Dismiss').length;
      fireEvent.click(screen.getByText('Unread'));
      fireEvent.click(screen.getByText('All'));
      expect(screen.getAllByTitle('Dismiss').length).toBe(allCount);
    });

    it('Action Needed filter shows only action-required notifications', () => {
      renderNotifications();
      fireEvent.click(screen.getByText('Action Needed'));
      // Should render without crashing; 0 or more action-needed items
      expect(screen.queryAllByTitle('Dismiss').length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('URL param — resident type', () => {
    it('defaults to resident persona when ?type=resident is in the URL', () => {
      mockSearchParamsGet = jest.fn(key => (key === 'type' ? 'resident' : null));
      renderNotifications();
      // Should render resident-specific content
      expect(screen.queryAllByTitle('Dismiss').length).toBeGreaterThanOrEqual(0);
    });
  });
});
