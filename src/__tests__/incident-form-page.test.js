import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import IncidentReportPage from '../app/reports/incident-form/page';

const mockPush = jest.fn();
const mockBack = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack }),
}));

describe('Incident Report Page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    expect(() => render(<IncidentReportPage />)).not.toThrow();
  });

  it('shows the Incident Report heading', () => {
    render(<IncidentReportPage />);
    expect(screen.getByText('Incident Report')).toBeInTheDocument();
  });

  it('renders top bar with New Incident Report breadcrumb', () => {
    render(<IncidentReportPage />);
    expect(screen.getByText('New Incident Report')).toBeInTheDocument();
  });

  it('renders a Back button in the top bar', () => {
    render(<IncidentReportPage />);
    const backBtns = screen.getAllByText(/← Back|Back/i);
    expect(backBtns.length).toBeGreaterThan(0);
  });

  it('Back button in top bar calls router.back()', () => {
    render(<IncidentReportPage />);
    const backBtn = screen.getAllByText(/← Back/i)[0];
    fireEvent.click(backBtn);
    expect(mockBack).toHaveBeenCalled();
  });

  describe('Section 1 — Resident & Incident Details', () => {
    it("shows the Resident's Name field", () => {
      render(<IncidentReportPage />);
      expect(screen.getByText(/resident.*name|name.*resident/i)).toBeInTheDocument();
    });

    it('shows Date of Incident field', () => {
      render(<IncidentReportPage />);
      expect(screen.getByText(/date of incident/i)).toBeInTheDocument();
    });

    it('shows Time of Incident field', () => {
      render(<IncidentReportPage />);
      expect(screen.getByText(/time of incident/i)).toBeInTheDocument();
    });

    it('renders all 5 incident type checkboxes', () => {
      render(<IncidentReportPage />);
      expect(screen.getByText('Accident')).toBeInTheDocument();
      expect(screen.getByText('Medication Error')).toBeInTheDocument();
      expect(screen.getByText('Complaint')).toBeInTheDocument();
      expect(screen.getByText('Behavioral')).toBeInTheDocument();
      expect(screen.getByText('Suspected Abuse or Neglect')).toBeInTheDocument();
    });

    it('selecting Abuse/Neglect reveals the report date field', () => {
      render(<IncidentReportPage />);
      const abuseCheckbox = screen.getByText('Suspected Abuse or Neglect').closest('div');
      fireEvent.click(abuseCheckbox);
      expect(screen.getByText(/date reported to local office/i)).toBeInTheDocument();
    });

    it('does not show abuse report date field initially', () => {
      render(<IncidentReportPage />);
      expect(screen.queryByText(/date reported to local office/i)).not.toBeInTheDocument();
    });

    it('selecting "Yes" for witnessed reveals the witness name field', () => {
      render(<IncidentReportPage />);
      const yesOptions = screen.getAllByText('Yes');
      fireEvent.click(yesOptions[0]);
      expect(screen.getByText(/if so.*by whom|witnessed by/i)).toBeInTheDocument();
    });

    it('does not show witness name field initially', () => {
      render(<IncidentReportPage />);
      expect(screen.queryByText(/if so.*by whom/i)).not.toBeInTheDocument();
    });
  });

  describe('Section 2 — Incident Narrative', () => {
    it('shows the incident details textarea', () => {
      render(<IncidentReportPage />);
      expect(screen.getByText(/incident narrative/i)).toBeInTheDocument();
    });

    it('shows the staff actions textarea', () => {
      render(<IncidentReportPage />);
      expect(screen.getByText(/action.*taken.*staff|staff.*action/i)).toBeInTheDocument();
    });

    it('accepts text input in narrative textarea', () => {
      render(<IncidentReportPage />);
      const narrative = screen.getByPlaceholderText(/describe the incident in full/i);
      fireEvent.change(narrative, { target: { value: 'Resident fell in hallway.' } });
      expect(narrative.value).toBe('Resident fell in hallway.');
    });
  });

  describe('Section 3 — Body Diagram', () => {
    it('shows the Body Areas Injured section', () => {
      render(<IncidentReportPage />);
      expect(screen.getByText(/body areas injured/i)).toBeInTheDocument();
    });

    it('shows front and back diagram labels', () => {
      render(<IncidentReportPage />);
      expect(screen.getByText('FRONT')).toBeInTheDocument();
      expect(screen.getByText('BACK')).toBeInTheDocument();
    });

    it('shows "None marked" when no body areas are selected', () => {
      render(<IncidentReportPage />);
      expect(screen.getByText('None marked')).toBeInTheDocument();
    });
  });

  describe('Section 4 — Notifications', () => {
    it('shows the Notifications section', () => {
      render(<IncidentReportPage />);
      expect(screen.getByText('Notifications')).toBeInTheDocument();
    });

    it('shows Licensee notification row', () => {
      render(<IncidentReportPage />);
      expect(screen.getByText('Licensee')).toBeInTheDocument();
    });

    it('shows Primary Care Practitioner notification row', () => {
      render(<IncidentReportPage />);
      expect(screen.getByText('Primary Care Practitioner')).toBeInTheDocument();
    });

    it('shows Family notification row', () => {
      render(<IncidentReportPage />);
      expect(screen.getByText('Family')).toBeInTheDocument();
    });

    it('shows all 6 notification parties', () => {
      render(<IncidentReportPage />);
      expect(screen.getByText('Case Manager')).toBeInTheDocument();
      expect(screen.getByText('Licensor')).toBeInTheDocument();
      expect(screen.getByText('Mental Health Professional')).toBeInTheDocument();
    });
  });

  describe('Section 5 — Follow-up', () => {
    it('shows the Follow-Up Plan section', () => {
      render(<IncidentReportPage />);
      expect(screen.getByText(/follow.*up plan/i)).toBeInTheDocument();
    });
  });

  describe('Section 6 — Sign-Off', () => {
    it('shows the Sign-Off section', () => {
      render(<IncidentReportPage />);
      expect(screen.getByText(/sign.?off/i)).toBeInTheDocument();
    });

    it('shows licensee review subsection', () => {
      render(<IncidentReportPage />);
      expect(screen.getByText(/licensee review/i)).toBeInTheDocument();
    });
  });

  describe('form actions', () => {
    it('renders the Submit Report button', () => {
      render(<IncidentReportPage />);
      expect(screen.getByText(/submit report/i)).toBeInTheDocument();
    });

    it('renders a Cancel button', () => {
      render(<IncidentReportPage />);
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    it('Cancel button calls router.back()', () => {
      render(<IncidentReportPage />);
      fireEvent.click(screen.getByText('Cancel'));
      expect(mockBack).toHaveBeenCalled();
    });

    it('Submit Report shows success screen', () => {
      render(<IncidentReportPage />);
      fireEvent.click(screen.getByText(/submit report/i));
      expect(screen.getByText('Incident Report Submitted')).toBeInTheDocument();
    });

    it('success screen shows a Return to Dashboard button', () => {
      render(<IncidentReportPage />);
      fireEvent.click(screen.getByText(/submit report/i));
      expect(screen.getByText('Return to Dashboard')).toBeInTheDocument();
    });

    it('Return to Dashboard routes to /', () => {
      render(<IncidentReportPage />);
      fireEvent.click(screen.getByText(/submit report/i));
      fireEvent.click(screen.getByText('Return to Dashboard'));
      expect(mockPush).toHaveBeenCalledWith('/');
    });
  });
});
