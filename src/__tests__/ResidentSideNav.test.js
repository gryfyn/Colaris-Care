import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ResidentSideNav from '../app/components/nav/ResidentSideNav';

const mockResident = {
  id: 1,
  firstName: 'Marcus',
  name: 'Marcus Thompson',
  room: '101',
};

const mockResidents = [
  { id: 1, firstName: 'Marcus',  name: 'Marcus Thompson', room: '101' },
  { id: 2, firstName: 'Diane',   name: 'Diane Kowalski',  room: '104' },
  { id: 3, firstName: 'Roy',     name: 'Roy Hendricks',   room: '107' },
];

const defaultProps = {
  activeSection: 'home',
  resident: mockResident,
  onNavigate: jest.fn(),
  activeResidentId: 1,
  residents: mockResidents,
  onResidentChange: jest.fn(),
};

describe('ResidentSideNav', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('branding', () => {
    it('renders the DC logomark', () => {
      render(<ResidentSideNav {...defaultProps} />);
      expect(screen.getByText('DC')).toBeInTheDocument();
    });

    it('renders Resident Portal subtitle', () => {
      render(<ResidentSideNav {...defaultProps} />);
      expect(screen.getByText('Resident Portal')).toBeInTheDocument();
    });
  });

  describe('resident welcome', () => {
    it('shows the resident first name in the greeting', () => {
      render(<ResidentSideNav {...defaultProps} />);
      expect(screen.getAllByText(/Marcus/).length).toBeGreaterThan(0);
    });

    it('shows the room number', () => {
      render(<ResidentSideNav {...defaultProps} />);
      expect(screen.getByText(/101/)).toBeInTheDocument();
    });

    it('shows a time-based greeting (Good morning/afternoon/evening)', () => {
      render(<ResidentSideNav {...defaultProps} />);
      expect(
        screen.getByText(/Good (morning|afternoon|evening)/i)
      ).toBeInTheDocument();
    });
  });

  describe('navigation items', () => {
    it('renders all resident nav sections', () => {
      render(<ResidentSideNav {...defaultProps} />);
      const sections = ['Home', 'My Health', 'Appointments', 'Activities', 'My Care Team', 'Announcements', 'Requests'];
      sections.forEach(label => {
        expect(screen.getByText(label)).toBeInTheDocument();
      });
    });

    it('calls onNavigate with section id when an item is clicked', () => {
      const onNavigate = jest.fn();
      render(<ResidentSideNav {...defaultProps} onNavigate={onNavigate} />);
      fireEvent.click(screen.getByText('Activities'));
      expect(onNavigate).toHaveBeenCalledWith('activities');
    });

    it('calls onNavigate with "health" when My Health is clicked', () => {
      const onNavigate = jest.fn();
      render(<ResidentSideNav {...defaultProps} onNavigate={onNavigate} />);
      fireEvent.click(screen.getByText('My Health'));
      expect(onNavigate).toHaveBeenCalledWith('health');
    });

    it('calls onNavigate with "requests" when Requests is clicked', () => {
      const onNavigate = jest.fn();
      render(<ResidentSideNav {...defaultProps} onNavigate={onNavigate} />);
      fireEvent.click(screen.getByText('Requests'));
      expect(onNavigate).toHaveBeenCalledWith('requests');
    });
  });

  describe('wellness check-in', () => {
    it('renders the wellness emoji strip', () => {
      render(<ResidentSideNav {...defaultProps} />);
      const emojis = ['😔', '😐', '🙂', '😊', '😄'];
      emojis.forEach(emoji => {
        expect(screen.getByText(emoji)).toBeInTheDocument();
      });
    });
  });

  describe('resident selector', () => {
    it('renders the resident dropdown', () => {
      render(<ResidentSideNav {...defaultProps} />);
      const select = screen.getByRole('combobox');
      expect(select).toBeInTheDocument();
    });

    it('lists all resident names in the dropdown', () => {
      render(<ResidentSideNav {...defaultProps} />);
      expect(screen.getByText(/Diane Kowalski/)).toBeInTheDocument();
      expect(screen.getByText(/Roy Hendricks/)).toBeInTheDocument();
    });

    it('calls onResidentChange with a number when another resident is selected', () => {
      const onResidentChange = jest.fn();
      render(<ResidentSideNav {...defaultProps} onResidentChange={onResidentChange} />);
      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: '2' } });
      expect(onResidentChange).toHaveBeenCalledWith(2);
    });
  });

  describe('rendering', () => {
    it('renders without crashing', () => {
      expect(() => render(<ResidentSideNav {...defaultProps} />)).not.toThrow();
    });
  });
});
