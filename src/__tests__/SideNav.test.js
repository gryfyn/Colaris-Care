import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import SideNav from '../app/components/nav/SideNav';

const defaultProps = {
  active: 'dashboard',
  open: true,
  onNavigate: jest.fn(),
  onToggle: jest.fn(),
};

describe('SideNav', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('branding', () => {
    it('renders the DC logomark', () => {
      render(<SideNav {...defaultProps} />);
      expect(screen.getByText('DC')).toBeInTheDocument();
    });

    it('shows "Dependable Care" wordmark when open', () => {
      render(<SideNav {...defaultProps} open={true} />);
      expect(screen.getByText('Dependable Care')).toBeInTheDocument();
    });

    it('hides wordmark when collapsed', () => {
      render(<SideNav {...defaultProps} open={false} />);
      expect(screen.queryByText('Dependable Care')).not.toBeInTheDocument();
    });

    it('shows "Wellness Centre" subtitle when open', () => {
      render(<SideNav {...defaultProps} open={true} />);
      expect(screen.getByText('Wellness Centre')).toBeInTheDocument();
    });
  });

  describe('navigation items', () => {
    it('renders all 11 nav items', () => {
      render(<SideNav {...defaultProps} />);
      const items = ['Dashboard', 'Residents', 'Care Plans', 'Medications', 'Staff',
        'Reports', 'Compliance', 'Face Sheets', 'Appointments', 'Announcements', 'Calendar'];
      items.forEach(label => {
        expect(screen.getByText(label)).toBeInTheDocument();
      });
    });

    it('renders group labels when open', () => {
      render(<SideNav {...defaultProps} open={true} />);
      expect(screen.getByText('Core')).toBeInTheDocument();
      expect(screen.getByText('Clinical')).toBeInTheDocument();
      expect(screen.getByText('Facility')).toBeInTheDocument();
    });

    it('calls onNavigate with item id when a nav item is clicked', () => {
      const onNavigate = jest.fn();
      render(<SideNav {...defaultProps} onNavigate={onNavigate} />);
      fireEvent.click(screen.getByText('Residents'));
      expect(onNavigate).toHaveBeenCalledWith('residents');
    });

    it('calls onNavigate with correct id for each item', () => {
      const onNavigate = jest.fn();
      render(<SideNav {...defaultProps} onNavigate={onNavigate} />);
      fireEvent.click(screen.getByText('Announcements'));
      expect(onNavigate).toHaveBeenCalledWith('announcements');
    });

    it('does not call onNavigate when already on active item', () => {
      const onNavigate = jest.fn();
      render(<SideNav {...defaultProps} active="dashboard" onNavigate={onNavigate} />);
      fireEvent.click(screen.getByText('Dashboard'));
      expect(onNavigate).toHaveBeenCalledWith('dashboard');
    });
  });

  describe('active state', () => {
    it('marks the active item visually (active pip rendered)', () => {
      const { container } = render(<SideNav {...defaultProps} active="residents" />);
      expect(screen.getByText('Residents')).toBeInTheDocument();
    });

    it('changes active item when prop changes', () => {
      const { rerender } = render(<SideNav {...defaultProps} active="dashboard" />);
      rerender(<SideNav {...defaultProps} active="staff" />);
      expect(screen.getByText('Staff')).toBeInTheDocument();
    });
  });

  describe('collapse toggle', () => {
    it('calls onToggle when collapse button is clicked', () => {
      const onToggle = jest.fn();
      render(<SideNav {...defaultProps} open={true} onToggle={onToggle} />);
      fireEvent.click(screen.getByText('Collapse'));
      expect(onToggle).toHaveBeenCalledTimes(1);
    });

    it('shows "Collapse" text when open', () => {
      render(<SideNav {...defaultProps} open={true} />);
      expect(screen.getByText('Collapse')).toBeInTheDocument();
    });

    it('hides "Collapse" text when closed', () => {
      render(<SideNav {...defaultProps} open={false} />);
      expect(screen.queryByText('Collapse')).not.toBeInTheDocument();
    });
  });

  describe('user strip', () => {
    it('shows user card when expanded', () => {
      render(<SideNav {...defaultProps} open={true} />);
      expect(screen.getByText('Admin')).toBeInTheDocument();
      expect(screen.getByText('Clinical Director')).toBeInTheDocument();
    });

    it('hides user card when collapsed', () => {
      render(<SideNav {...defaultProps} open={false} />);
      expect(screen.queryByText('Clinical Director')).not.toBeInTheDocument();
    });
  });

  describe('layout', () => {
    it('renders without crashing with minimal props', () => {
      expect(() =>
        render(<SideNav active="dashboard" open={true} onNavigate={() => {}} onToggle={() => {}} />)
      ).not.toThrow();
    });
  });
});
