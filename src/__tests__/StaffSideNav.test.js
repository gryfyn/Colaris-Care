import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import StaffSideNav from '../app/components/nav/StaffSideNav';

const mockStaff = { id: 2, name: 'Carlos Rivera', role: 'RN', shift: 'day', status: 'clocked_in', since: '07:15 AM' };
const mockRoster = [
  { id: 1, name: 'Patricia Nguyen', role: 'Clinical Director', shift: 'day', status: 'clocked_in', since: '07:02 AM' },
  { id: 2, name: 'Carlos Rivera',   role: 'RN',                shift: 'day', status: 'clocked_in', since: '07:15 AM' },
  { id: 3, name: 'Tamara Ellis',    role: 'Caregiver',         shift: 'day', status: 'clocked_out', since: '—' },
];

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
  staff: mockStaff,
  role: 'RN',
  clockedIn: true,
  onNavigate: jest.fn(),
  onToggleClock: jest.fn(),
  activeStaffId: 2,
  staffRoster: mockRoster,
  onStaffChange: jest.fn(),
};

describe('StaffSideNav', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('branding', () => {
    it('renders the DC logomark', () => {
      render(<StaffSideNav {...defaultProps} />);
      expect(screen.getByText('DC')).toBeInTheDocument();
    });

    it('renders the Staff Portal label', () => {
      render(<StaffSideNav {...defaultProps} />);
      expect(screen.getByText('Staff Portal')).toBeInTheDocument();
    });
  });

  describe('staff card', () => {
    it('shows the active staff member name', () => {
      render(<StaffSideNav {...defaultProps} />);
      expect(screen.getByText('Carlos Rivera')).toBeInTheDocument();
    });

    it('shows the staff role', () => {
      render(<StaffSideNav {...defaultProps} />);
      expect(screen.getByText('RN')).toBeInTheDocument();
    });

    it('shows Clock Out button when clocked in', () => {
      render(<StaffSideNav {...defaultProps} clockedIn={true} />);
      expect(screen.getByText(/Clock Out/)).toBeInTheDocument();
    });

    it('shows Clock In button when not clocked in', () => {
      render(<StaffSideNav {...defaultProps} clockedIn={false} />);
      expect(screen.getByText(/Clock In/)).toBeInTheDocument();
    });
  });

  describe('navigation items', () => {
    it('renders all nav section labels', () => {
      render(<StaffSideNav {...defaultProps} />);
      const sections = ['Dashboard', 'Residents', 'Progress Notes', 'Medications', 'Incidents'];
      sections.forEach(label => {
        expect(screen.getByText(label)).toBeInTheDocument();
      });
    });

    it('calls onNavigate with section id when item is clicked', () => {
      const onNavigate = jest.fn();
      render(<StaffSideNav {...defaultProps} onNavigate={onNavigate} />);
      fireEvent.click(screen.getByText('Residents'));
      expect(onNavigate).toHaveBeenCalledWith('residents');
    });
  });

  describe('clock button', () => {
    it('calls onToggleClock when the clock button is clicked', () => {
      const onToggleClock = jest.fn();
      render(<StaffSideNav {...defaultProps} onToggleClock={onToggleClock} />);
      const btn = screen.getByText(/clock out/i);
      fireEvent.click(btn);
      expect(onToggleClock).toHaveBeenCalledTimes(1);
    });
  });

  describe('staff switcher', () => {
    it('renders staff switcher dropdown', () => {
      render(<StaffSideNav {...defaultProps} />);
      const select = screen.getByRole('combobox');
      expect(select).toBeInTheDocument();
    });

    it('calls onStaffChange with a number when another staff is selected', () => {
      const onStaffChange = jest.fn();
      render(<StaffSideNav {...defaultProps} onStaffChange={onStaffChange} />);
      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: '1' } });
      expect(onStaffChange).toHaveBeenCalledWith(1);
    });

    it('lists all roster members in the dropdown', () => {
      render(<StaffSideNav {...defaultProps} />);
      expect(screen.getByText(/Patricia Nguyen/)).toBeInTheDocument();
      expect(screen.getByText(/Tamara Ellis/)).toBeInTheDocument();
    });
  });

  describe('rendering', () => {
    it('renders without crashing', () => {
      expect(() => render(<StaffSideNav {...defaultProps} />)).not.toThrow();
    });
  });
});
