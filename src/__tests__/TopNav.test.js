import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import TopNav from '../app/components/nav/TopNav';

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

const defaultProps = {
  active: 'dashboard',
  user: { initials: 'PN', name: 'Patricia Nguyen', role: 'Clinical Director' },
  notificationCount: 5,
};

describe('TopNav', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('page identity', () => {
    it('renders the active page label', () => {
      render(<TopNav {...defaultProps} active="dashboard" />);
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });

    it('updates page label when active prop changes', () => {
      const { rerender } = render(<TopNav {...defaultProps} active="residents" />);
      expect(screen.getByText('Residents')).toBeInTheDocument();
      rerender(<TopNav {...defaultProps} active="staff" />);
      expect(screen.getByText('Staff')).toBeInTheDocument();
    });

    it('shows "Dependable Care WC" facility subtitle', () => {
      render(<TopNav {...defaultProps} />);
      expect(screen.getByText('Dependable Care WC')).toBeInTheDocument();
    });

    it('defaults to Dashboard label for unknown active value', () => {
      render(<TopNav {...defaultProps} active="unknown-page" />);
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });
  });

  describe('user chip', () => {
    it('renders user initials', () => {
      render(<TopNav {...defaultProps} />);
      expect(screen.getByText('PN')).toBeInTheDocument();
    });

    it('renders full user name', () => {
      render(<TopNav {...defaultProps} />);
      expect(screen.getByText('Patricia Nguyen')).toBeInTheDocument();
    });

    it('renders user role', () => {
      render(<TopNav {...defaultProps} />);
      expect(screen.getByText('Clinical Director')).toBeInTheDocument();
    });

    it('uses default user props when none provided', () => {
      render(<TopNav active="dashboard" />);
      expect(screen.getByText('Admin')).toBeInTheDocument();
    });
  });

  describe('notification bell', () => {
    it('renders the notification button', () => {
      render(<TopNav {...defaultProps} notificationCount={3} />);
      const btn = screen.getByTitle(/3 unread notification/i);
      expect(btn).toBeInTheDocument();
    });

    it('navigates to /notifications when bell is clicked', () => {
      render(<TopNav {...defaultProps} />);
      const btn = screen.getByTitle(/unread notification/i);
      fireEvent.click(btn);
      expect(mockPush).toHaveBeenCalledWith('/notifications');
    });

    it('uses singular "notification" when count is 1', () => {
      render(<TopNav {...defaultProps} notificationCount={1} />);
      expect(screen.getByTitle('1 unread notification')).toBeInTheDocument();
    });

    it('uses plural "notifications" when count > 1', () => {
      render(<TopNav {...defaultProps} notificationCount={4} />);
      expect(screen.getByTitle('4 unread notifications')).toBeInTheDocument();
    });
  });

  describe('system status', () => {
    it('shows Online status pill', () => {
      render(<TopNav {...defaultProps} />);
      expect(screen.getByText('Online')).toBeInTheDocument();
    });
  });

  describe('search', () => {
    it('renders a search icon button', () => {
      render(<TopNav {...defaultProps} />);
      expect(screen.getByTitle('Search')).toBeInTheDocument();
    });
  });

  describe('rendering', () => {
    it('renders without crashing', () => {
      expect(() => render(<TopNav {...defaultProps} />)).not.toThrow();
    });

    it('renders with zero notification count', () => {
      render(<TopNav {...defaultProps} notificationCount={0} />);
      expect(screen.getByText('Patricia Nguyen')).toBeInTheDocument();
    });
  });
});
