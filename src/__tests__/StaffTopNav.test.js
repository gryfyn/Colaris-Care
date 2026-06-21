import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import StaffTopNav from '../app/components/nav/StaffTopNav';

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockStaff = { id: 2, name: 'Carlos Rivera', role: 'RN', shift: 'day', status: 'clocked_in', since: '07:15 AM' };

const mockVisibleNav = [
  { id: 'dashboard',  label: 'Dashboard',      icon: '⊞' },
  { id: 'residents',  label: 'Residents',       icon: '♟' },
  { id: 'notes',      label: 'Progress Notes',  icon: '▦' },
  { id: 'mar',        label: 'Medications',     icon: '⬡' },
  { id: 'incidents',  label: 'Incidents',       icon: '⚠' },
];

const defaultProps = {
  activeSection: 'dashboard',
  visibleNav: mockVisibleNav,
  clockedIn: true,
  staff: mockStaff,
  notificationCount: 3,
};

describe('StaffTopNav', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('user identity', () => {
    it('renders the staff member name', () => {
      render(<StaffTopNav {...defaultProps} />);
      expect(screen.getByText('Carlos Rivera')).toBeInTheDocument();
    });

    it('renders the staff role', () => {
      render(<StaffTopNav {...defaultProps} />);
      expect(screen.getByText('RN')).toBeInTheDocument();
    });

    it('renders initials derived from staff name', () => {
      render(<StaffTopNav {...defaultProps} />);
      expect(screen.getByText('CR')).toBeInTheDocument();
    });
  });

  describe('clock status', () => {
    it('shows clocked-in status when clockedIn is true', () => {
      render(<StaffTopNav {...defaultProps} clockedIn={true} />);
      expect(screen.getByText(/on duty|clocked in/i)).toBeInTheDocument();
    });

    it('shows clocked-out status when clockedIn is false', () => {
      render(<StaffTopNav {...defaultProps} clockedIn={false} />);
      expect(screen.getByText(/off duty|clocked out/i)).toBeInTheDocument();
    });
  });

  describe('notifications', () => {
    it('renders a notification bell button', () => {
      render(<StaffTopNav {...defaultProps} />);
      const btns = screen.getAllByRole('button');
      expect(btns.length).toBeGreaterThan(0);
    });

    it('navigates to /notifications when bell is clicked', () => {
      render(<StaffTopNav {...defaultProps} />);
      const bell = screen.getByTitle(/notification/i);
      fireEvent.click(bell);
      expect(mockPush).toHaveBeenCalledWith('/notifications');
    });

    it('shows notification badge button for count > 0', () => {
      render(<StaffTopNav {...defaultProps} notificationCount={5} />);
      expect(screen.getByTitle(/5 notification/i)).toBeInTheDocument();
    });
  });

  describe('rendering', () => {
    it('renders without crashing', () => {
      expect(() => render(<StaffTopNav {...defaultProps} />)).not.toThrow();
    });

    it('renders with zero notification count', () => {
      expect(() => render(<StaffTopNav {...defaultProps} notificationCount={0} />)).not.toThrow();
    });
  });
});
