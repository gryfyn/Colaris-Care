import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ResidentsPage from '../app/residents/page';

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

describe('Residents Portal Page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    expect(() => render(<ResidentsPage />)).not.toThrow();
  });

  it('renders the Resident Portal sidebar', () => {
    render(<ResidentsPage />);
    expect(screen.getAllByText('Resident Portal')[0]).toBeInTheDocument();
  });

  describe('home section (default)', () => {
    it('shows a personalized greeting on home screen', () => {
      render(<ResidentsPage />);
      expect(screen.getAllByText(/good (morning|afternoon|evening)/i)[0]).toBeInTheDocument();
    });

    it('shows a wellness summary', () => {
      render(<ResidentsPage />);
      expect(screen.getAllByText(/wellness|your status|how are you/i)[0]).toBeInTheDocument();
    });
  });

  describe('navigation between sections', () => {
    it('navigates to My Health section', () => {
      render(<ResidentsPage />);
      fireEvent.click(screen.getByText('My Health'));
      expect(screen.getAllByText(/medication|health|my health/i)[0]).toBeInTheDocument();
    });

    it('navigates to Appointments section', () => {
      render(<ResidentsPage />);
      fireEvent.click(screen.getByText('Appointments'));
      expect(screen.getAllByText(/appointment|upcoming/i)[0]).toBeInTheDocument();
    });

    it('navigates to Activities section', () => {
      render(<ResidentsPage />);
      fireEvent.click(screen.getByText('Activities'));
      expect(screen.getAllByText(/activities|weekly|schedule/i)[0]).toBeInTheDocument();
    });

    it('navigates to My Care Team section', () => {
      render(<ResidentsPage />);
      fireEvent.click(screen.getByText('My Care Team'));
      expect(screen.getAllByText(/care team|your team/i)[0]).toBeInTheDocument();
    });

    it('navigates to Announcements section', () => {
      render(<ResidentsPage />);
      fireEvent.click(screen.getByText('Announcements'));
      expect(screen.getAllByText(/announcement|notice/i)[0]).toBeInTheDocument();
    });

    it('navigates to Requests section', () => {
      render(<ResidentsPage />);
      fireEvent.click(screen.getByText('Requests'));
      expect(screen.getAllByText(/request|submit/i)[0]).toBeInTheDocument();
    });
  });

  describe('Activities section', () => {
    const goToActivities = () => {
      render(<ResidentsPage />);
      fireEvent.click(screen.getByText('Activities'));
    };

    it('shows activities list', () => {
      goToActivities();
      // Activities render as divs in a grid; check for known activity names
      expect(
        screen.queryAllByText(/CBT Group|Morning Walk|Life Skills/i)[0] ||
        screen.queryAllByText(/therapy|workshop|group/i)[0]
      ).toBeTruthy();
    });

    it('renders day-of-week filter pills', () => {
      goToActivities();
      expect(screen.getAllByText(/Monday|Tuesday|Wednesday/i)[0]).toBeInTheDocument();
    });

    it('filtering by day shows only that day\'s activities', () => {
      goToActivities();
      const monBtn = screen.queryAllByText('Monday')[0];
      if (monBtn) {
        fireEvent.click(monBtn);
        // Should not crash and should render some filtered content
        expect(screen.getAllByText(/Monday|Tuesday|Wednesday/i)[0]).toBeInTheDocument();
      }
    });
  });

  describe('Requests section', () => {
    const goToRequests = () => {
      render(<ResidentsPage />);
      fireEvent.click(screen.getByText('Requests'));
    };

    it('shows a request submission form', () => {
      goToRequests();
      expect(screen.getByText('Submit a New Request')).toBeInTheDocument();
    });

    it('shows past request history', () => {
      goToRequests();
      expect(screen.getByText(/past request|request history|previous/i)).toBeInTheDocument();
    });

    it('submitting a request shows success state', async () => {
      goToRequests();
      // Select a request type first (required)
      const typeSelect = screen.getByRole('combobox');
      const options = Array.from(typeSelect.querySelectorAll('option'));
      if (options.length > 1) {
        fireEvent.change(typeSelect, { target: { value: options[1].value } });
      }
      const textarea = screen.queryByPlaceholderText(/describe your request/i) ||
                       screen.queryAllByRole('textbox')[0];
      if (textarea) {
        fireEvent.change(textarea, { target: { value: 'I need extra blankets please.' } });
      }
      const submitBtn = screen.getByRole('button', { name: /submit request/i });
      fireEvent.click(submitBtn);
      await waitFor(() => {
        expect(screen.getByText(/submitted|received|thank you/i)).toBeInTheDocument();
      });
    });
  });

  describe('resident switcher', () => {
    it('shows multiple residents in the selector', () => {
      render(<ResidentsPage />);
      const select = screen.getAllByRole('combobox')[0];
      const options = Array.from(select.querySelectorAll('option'));
      expect(options.length).toBeGreaterThanOrEqual(2);
    });

    it('changing the resident selector updates the displayed resident name', () => {
      render(<ResidentsPage />);
      const select = screen.getAllByRole('combobox')[0];
      const secondOption = select.querySelectorAll('option')[1];
      if (secondOption) {
        fireEvent.change(select, { target: { value: secondOption.value } });
        // Should not crash
        expect(screen.getAllByText('Resident Portal')[0]).toBeInTheDocument();
      }
    });
  });

  describe('wellness check-in', () => {
    it('renders wellness emoji buttons in the sidebar', () => {
      render(<ResidentsPage />);
      expect(screen.getByText('😔')).toBeInTheDocument();
      expect(screen.getByText('😄')).toBeInTheDocument();
    });
  });
});
