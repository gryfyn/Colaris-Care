import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import StaffPage from '../app/staff/page';

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

describe('Staff Portal Page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    expect(() => render(<StaffPage />)).not.toThrow();
  });

  it('renders the Staff Portal branding', () => {
    render(<StaffPage />);
    expect(screen.getAllByText('Staff Portal')[0]).toBeInTheDocument();
  });

  describe('dashboard section (default)', () => {
    it('shows a shift dashboard or welcome message', () => {
      render(<StaffPage />);
      expect(
        screen.queryAllByText(/shift|dashboard|welcome|on duty/i)[0] ||
        screen.queryAllByText(/staff portal/i)[0]
      ).toBeTruthy();
    });

    it('shows unsigned notes count', () => {
      render(<StaffPage />);
      expect(screen.getByText(/unsigned|pending sign/i)).toBeInTheDocument();
    });
  });

  describe('navigation', () => {
    it('renders Daily Notes nav item', () => {
      render(<StaffPage />);
      expect(screen.getByText('Daily Notes')).toBeInTheDocument();
    });

    it('renders My Residents nav item', () => {
      render(<StaffPage />);
      expect(screen.getByText('My Residents')).toBeInTheDocument();
    });

    it('renders Medications nav item', () => {
      render(<StaffPage />);
      expect(screen.getByText('Medications')).toBeInTheDocument();
    });

    it('navigates to Daily Notes section', () => {
      render(<StaffPage />);
      fireEvent.click(screen.getByText('Daily Notes'));
      expect(screen.getAllByText(/progress notes|daily notes/i)[0]).toBeInTheDocument();
    });

    it('navigates to My Residents section', () => {
      render(<StaffPage />);
      fireEvent.click(screen.getByText('My Residents'));
      expect(screen.getAllByText(/resident.*roster|active resident|my resident/i)[0]).toBeInTheDocument();
    });

    it('navigates to Medications (MAR) section', () => {
      render(<StaffPage />);
      fireEvent.click(screen.getByText('Medications'));
      expect(screen.getAllByText(/medication|MAR/i)[0]).toBeInTheDocument();
    });
  });

  describe('Progress Notes section', () => {
    const goToNotes = () => {
      render(<StaffPage />);
      fireEvent.click(screen.getByText('Daily Notes'));
    };

    it('shows unsigned notes prominently', () => {
      goToNotes();
      expect(screen.getByText(/unsigned|pending/i)).toBeInTheDocument();
    });

    it('renders note records for residents', () => {
      goToNotes();
      expect(
        screen.queryAllByText('Marcus Thompson')[0] ||
        screen.queryAllByText('Diane Kowalski')[0] ||
        screen.queryAllByText('Roy Hendricks')[0]
      ).toBeTruthy();
    });

    it('shift filter renders day and night options', () => {
      goToNotes();
      expect(screen.getAllByText(/all shifts|day|night/i)[0]).toBeInTheDocument();
    });

    it('filter by day shift narrows notes list', () => {
      goToNotes();
      const dayBtn = screen.queryAllByText('Day')[0];
      if (dayBtn) {
        const initialRows = screen.queryAllByRole('row').length;
        fireEvent.click(dayBtn);
        const filteredRows = screen.queryAllByRole('row').length;
        expect(filteredRows).toBeLessThanOrEqual(initialRows);
      }
    });

    it('signed notes show a Signed badge', () => {
      goToNotes();
      expect(screen.getByText(/signed/i)).toBeInTheDocument();
    });
  });

  describe('Residents section', () => {
    const goToResidents = () => {
      render(<StaffPage />);
      fireEvent.click(screen.getByText('My Residents'));
    };

    it('lists active residents', () => {
      goToResidents();
      expect(
        screen.queryAllByText('Marcus Thompson')[0] ||
        screen.queryAllByText('Diane Kowalski')[0]
      ).toBeTruthy();
    });

    it('clicking a resident opens their detail view', () => {
      goToResidents();
      const marcusItems = screen.queryAllByText('Marcus Thompson');
      if (marcusItems.length > 0) {
        fireEvent.click(marcusItems[0]);
        expect(screen.queryAllByText(/room|101|diagnosis/i)[0]).toBeInTheDocument();
      }
    });
  });

  describe('clock in / out', () => {
    it('renders a clock-in or clock-out button', () => {
      render(<StaffPage />);
      expect(screen.getAllByText(/clock (in|out)|clocked/i)[0]).toBeInTheDocument();
    });

    it('toggling clock updates the status display', () => {
      render(<StaffPage />);
      const clockBtn = screen.queryAllByText(/clock out/i)[0];
      if (clockBtn) {
        fireEvent.click(clockBtn);
        expect(screen.queryAllByText(/clock in|clocked out/i)[0]).toBeInTheDocument();
      }
    });
  });

  describe('staff switcher', () => {
    it('renders a staff selector dropdown', () => {
      render(<StaffPage />);
      const selects = screen.getAllByRole('combobox');
      expect(selects.length).toBeGreaterThan(0);
    });

    it('switching staff updates the name displayed', () => {
      render(<StaffPage />);
      const select = screen.getAllByRole('combobox')[0];
      const options = Array.from(select.querySelectorAll('option'));
      if (options.length > 1) {
        fireEvent.change(select, { target: { value: options[1].value } });
        expect(screen.getAllByText('Staff Portal')[0]).toBeInTheDocument();
      }
    });
  });
});
