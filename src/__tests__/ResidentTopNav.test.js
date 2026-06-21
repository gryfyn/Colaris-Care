import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ResidentTopNav from '../app/components/nav/ResidentTopNav';

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockResident = {
  id: 1,
  firstName: 'Marcus',
  name: 'Marcus Thompson',
  room: '101',
};

const defaultProps = {
  activeSection: 'home',
  resident: mockResident,
  notificationCount: 2,
};

describe('ResidentTopNav', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('user chip', () => {
    it('renders the resident name', () => {
      render(<ResidentTopNav {...defaultProps} />);
      expect(screen.getByText('Marcus Thompson')).toBeInTheDocument();
    });

    it('renders the room number in the user chip', () => {
      render(<ResidentTopNav {...defaultProps} />);
      expect(screen.getByText(/Room 101/)).toBeInTheDocument();
    });
  });

  describe('notifications', () => {
    it('renders a notification bell button', () => {
      render(<ResidentTopNav {...defaultProps} />);
      const bell = screen.getByTitle(/notification/i);
      expect(bell).toBeInTheDocument();
    });

    it('navigates to /notifications?type=resident when bell is clicked', () => {
      render(<ResidentTopNav {...defaultProps} />);
      const bell = screen.getByTitle(/notification/i);
      fireEvent.click(bell);
      expect(mockPush).toHaveBeenCalledWith('/notifications?type=resident');
    });

    it('shows badge button when notification count > 0', () => {
      render(<ResidentTopNav {...defaultProps} notificationCount={3} />);
      expect(screen.getByTitle(/3 new notification/i)).toBeInTheDocument();
    });
  });

  describe('rendering', () => {
    it('renders without crashing', () => {
      expect(() => render(<ResidentTopNav {...defaultProps} />)).not.toThrow();
    });

    it('renders with zero notifications', () => {
      expect(() =>
        render(<ResidentTopNav {...defaultProps} notificationCount={0} />)
      ).not.toThrow();
    });
  });
});
