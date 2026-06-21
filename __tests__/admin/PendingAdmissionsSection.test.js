// File: __tests__/admin/PendingAdmissionsSection.test.js

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PendingAdmissionsSection } from '@/app/admin/PendingAdmissionsSection';

global.fetch = jest.fn();

const mockAdmissions = [
  {
    id: 'adm1',
    resident_id: 'res1',
    status: 'pending',
    submitted_at: '2024-05-16T10:00:00',
    pre_screening: {
      id: 'ps1',
      full_name: 'John Doe',
      date_of_birth: '1990-01-01',
      contact_phone: '(555) 123-4567',
      emergency_contact: 'Jane Doe',
      primary_physician: 'Dr. Smith',
      allergies: 'Penicillin',
      current_medications: 'Lisinopril',
      medical_conditions: 'Hypertension',
      vision_hearing: 'Corrected',
      mobility_aids: 'Walker',
    },
    nursing_assessment: null,
    advance_directive: null,
  },
  {
    id: 'adm2',
    resident_id: 'res2',
    status: 'pending',
    submitted_at: '2024-05-15T10:00:00',
    pre_screening: {
      id: 'ps2',
      full_name: 'Jane Smith',
      date_of_birth: '1985-05-15',
    },
    nursing_assessment: {
      id: 'na2',
      vital_temperature: '98.6',
      vital_pulse: '72',
    },
    advance_directive: {
      id: 'ad2',
      healthcare_agent_name: 'Bob Smith',
    },
  },
];

describe('PendingAdmissionsSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch.mockClear();
  });

  describe('Component Rendering', () => {
    test('renders pending admissions section', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({ admissions: mockAdmissions }),
      });

      render(<PendingAdmissionsSection />);

      await waitFor(() => {
        expect(screen.getByText('Pending Admissions')).toBeInTheDocument();
      });
    });

    test('displays loading state initially', async () => {
      global.fetch.mockImplementationOnce(
        () => new Promise(() => {})
      );

      render(<PendingAdmissionsSection />);

      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    test('renders table with columns', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({ admissions: mockAdmissions }),
      });

      render(<PendingAdmissionsSection />);

      await waitFor(() => {
        expect(screen.getByText('Resident Name')).toBeInTheDocument();
        expect(screen.getByText('DOB')).toBeInTheDocument();
        expect(screen.getByText('Submitted')).toBeInTheDocument();
        expect(screen.getByText('Status')).toBeInTheDocument();
        expect(screen.getByText('Action')).toBeInTheDocument();
      });
    });
  });

  describe('Table Data Display', () => {
    test('displays resident names', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({ admissions: mockAdmissions }),
      });

      render(<PendingAdmissionsSection />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      });
    });

    test('displays dates of birth', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({ admissions: mockAdmissions }),
      });

      render(<PendingAdmissionsSection />);

      await waitFor(() => {
        const dobCells = screen.getAllByText(/\/.*\//);
        expect(dobCells.length).toBeGreaterThan(0);
      });
    });

    test('displays submission dates', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({ admissions: mockAdmissions }),
      });

      render(<PendingAdmissionsSection />);

      await waitFor(() => {
        expect(screen.getByText(/5\/16\/2024|2024-05-16/i)).toBeInTheDocument();
      });
    });

    test('displays form completion status', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({ admissions: mockAdmissions }),
      });

      render(<PendingAdmissionsSection />);

      await waitFor(() => {
        const checkmarks = screen.getAllByText(/✓|○/);
        expect(checkmarks.length).toBeGreaterThan(0);
      });
    });

    test('displays status badge', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({ admissions: mockAdmissions }),
      });

      render(<PendingAdmissionsSection />);

      await waitFor(() => {
        expect(screen.getByText('pending')).toBeInTheDocument();
      });
    });
  });

  describe('Tab Filtering', () => {
    test('renders tab filter buttons', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({ admissions: mockAdmissions }),
      });

      render(<PendingAdmissionsSection />);

      await waitFor(() => {
        expect(screen.getByText(/All Pending/i)).toBeInTheDocument();
        expect(screen.getByText(/Pre-Screening Only/i)).toBeInTheDocument();
        expect(screen.getByText(/Nursing Only/i)).toBeInTheDocument();
        expect(screen.getByText(/Directive Only/i)).toBeInTheDocument();
      });
    });

    test('filters by pre-screening only', async () => {
      const user = userEvent.setup();
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({ admissions: mockAdmissions }),
      });

      render(<PendingAdmissionsSection />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      const preScreeningTab = screen.getByText(/Pre-Screening Only/i);
      await user.click(preScreeningTab);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.queryByText('Jane Smith')).not.toBeInTheDocument();
      });
    });

    test('filters by nursing only', async () => {
      const user = userEvent.setup();
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({ admissions: mockAdmissions }),
      });

      render(<PendingAdmissionsSection />);

      await waitFor(() => {
        expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      });

      const nursingTab = screen.getByText(/Nursing Only/i);
      await user.click(nursingTab);

      await waitFor(() => {
        expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      });
    });

    test('shows all admissions when "All" tab selected', async () => {
      const user = userEvent.setup();
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({ admissions: mockAdmissions }),
      });

      render(<PendingAdmissionsSection />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      });
    });
  });

  describe('Review Modal', () => {
    test('opens review modal on review button click', async () => {
      const user = userEvent.setup();
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({ admissions: mockAdmissions }),
      });

      render(<PendingAdmissionsSection />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      const reviewButtons = screen.getAllByText(/Review/i);
      await user.click(reviewButtons[0]);

      await waitFor(() => {
        expect(screen.getByText(/Review Admission/i)).toBeInTheDocument();
      });
    });

    test('displays resident name in modal header', async () => {
      const user = userEvent.setup();
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({ admissions: [mockAdmissions[0]] }),
      });

      render(<PendingAdmissionsSection />);

      await waitFor(() => {
        const reviewButton = screen.getByText(/Review/i);
        user.click(reviewButton);
      });

      await waitFor(() => {
        expect(screen.getByText(/John Doe/i)).toBeInTheDocument();
      });
    });

    test('renders form tabs in modal', async () => {
      const user = userEvent.setup();
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({ admissions: [mockAdmissions[1]] }),
      });

      render(<PendingAdmissionsSection />);

      await waitFor(() => {
        const reviewButton = screen.getByText(/Review/i);
        user.click(reviewButton);
      });

      await waitFor(() => {
        expect(screen.getByText('Pre-Screening')).toBeInTheDocument();
        expect(screen.getByText('Nursing Assessment')).toBeInTheDocument();
        expect(screen.getByText('Advance Directive')).toBeInTheDocument();
      });
    });

    test('displays readonly form fields', async () => {
      const user = userEvent.setup();
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({ admissions: [mockAdmissions[0]] }),
      });

      render(<PendingAdmissionsSection />);

      await waitFor(() => {
        const reviewButton = screen.getByText(/Review/i);
        user.click(reviewButton);
      });

      await waitFor(() => {
        const inputs = screen.getAllByDisplayValue(/John Doe|Penicillin/);
        inputs.forEach(input => {
          expect(input).toHaveAttribute('readonly');
        });
      });
    });

    test('renders notes textarea', async () => {
      const user = userEvent.setup();
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({ admissions: [mockAdmissions[0]] }),
      });

      render(<PendingAdmissionsSection />);

      await waitFor(() => {
        const reviewButton = screen.getByText(/Review/i);
        user.click(reviewButton);
      });

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/approval or rejection notes/i)).toBeInTheDocument();
      });
    });

    test('renders approve and reject buttons', async () => {
      const user = userEvent.setup();
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({ admissions: [mockAdmissions[0]] }),
      });

      render(<PendingAdmissionsSection />);

      await waitFor(() => {
        const reviewButton = screen.getByText(/Review/i);
        user.click(reviewButton);
      });

      await waitFor(() => {
        expect(screen.getByText('Approve')).toBeInTheDocument();
        expect(screen.getByText('Reject')).toBeInTheDocument();
      });
    });

    test('closes modal on cancel', async () => {
      const user = userEvent.setup();
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({ admissions: [mockAdmissions[0]] }),
      });

      render(<PendingAdmissionsSection />);

      await waitFor(() => {
        const reviewButton = screen.getByText(/Review/i);
        user.click(reviewButton);
      });

      await waitFor(() => {
        expect(screen.getByText(/Review Admission/i)).toBeInTheDocument();
      });

      const cancelButton = screen.getByText('Cancel');
      await user.click(cancelButton);

      await waitFor(() => {
        expect(screen.queryByText(/Review Admission/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Review Submission', () => {
    test('submits approval with status approved', async () => {
      const user = userEvent.setup();
      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({ admissions: mockAdmissions }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({ status: 'approved' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({ admissions: mockAdmissions }),
        });

      render(<PendingAdmissionsSection />);

      await waitFor(() => {
        const reviewButton = screen.getByText(/Review/i);
        user.click(reviewButton);
      });

      await waitFor(() => {
        const approveButton = screen.getByText('Approve');
        user.click(approveButton);
      });

      await waitFor(() => {
        const calls = global.fetch.mock.calls;
        const reviewCall = calls.find(c => c[0].includes('/review'));
        expect(reviewCall).toBeDefined();
        expect(reviewCall[1].body).toContain('approved');
      });
    });

    test('submits rejection with status rejected', async () => {
      const user = userEvent.setup();
      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({ admissions: mockAdmissions }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({ status: 'rejected' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({ admissions: mockAdmissions }),
        });

      render(<PendingAdmissionsSection />);

      await waitFor(() => {
        const reviewButton = screen.getByText(/Review/i);
        user.click(reviewButton);
      });

      await waitFor(() => {
        const rejectButton = screen.getByText('Reject');
        user.click(rejectButton);
      });

      await waitFor(() => {
        const calls = global.fetch.mock.calls;
        const reviewCall = calls.find(c => c[0].includes('/review'));
        expect(reviewCall).toBeDefined();
        expect(reviewCall[1].body).toContain('rejected');
      });
    });

    test('includes notes in review submission', async () => {
      const user = userEvent.setup();
      const testNotes = 'All documentation is complete and verified.';

      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({ admissions: mockAdmissions }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({ status: 'approved' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({ admissions: mockAdmissions }),
        });

      render(<PendingAdmissionsSection />);

      await waitFor(() => {
        const reviewButton = screen.getByText(/Review/i);
        user.click(reviewButton);
      });

      await waitFor(() => {
        const notesInput = screen.getByPlaceholderText(/approval or rejection notes/i);
        user.type(notesInput, testNotes);
      });

      await waitFor(() => {
        const approveButton = screen.getByText('Approve');
        user.click(approveButton);
      });

      await waitFor(() => {
        const calls = global.fetch.mock.calls;
        const reviewCall = calls.find(c => c[0].includes('/review'));
        expect(reviewCall[1].body).toContain(testNotes);
      });
    });

    test('shows processing state during submission', async () => {
      const user = userEvent.setup();
      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({ admissions: mockAdmissions }),
        })
        .mockImplementationOnce(
          () => new Promise(() => {})
        );

      render(<PendingAdmissionsSection />);

      await waitFor(() => {
        const reviewButton = screen.getByText(/Review/i);
        user.click(reviewButton);
      });

      await waitFor(() => {
        const approveButton = screen.getByText('Approve');
        user.click(approveButton);
      });

      await waitFor(() => {
        expect(screen.getByText('Processing...')).toBeInTheDocument();
      });
    });

    test('closes modal on successful review', async () => {
      const user = userEvent.setup();
      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({ admissions: mockAdmissions }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({ status: 'approved' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({ admissions: [] }),
        });

      render(<PendingAdmissionsSection />);

      await waitFor(() => {
        const reviewButton = screen.getByText(/Review/i);
        user.click(reviewButton);
      });

      await waitFor(() => {
        const approveButton = screen.getByText('Approve');
        user.click(approveButton);
      });

      await waitFor(() => {
        expect(screen.queryByText(/Review Admission/i)).not.toBeInTheDocument();
      });
    });

    test('refreshes admissions list after review', async () => {
      const user = userEvent.setup();
      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({ admissions: mockAdmissions }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({ status: 'approved' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({ admissions: [] }),
        });

      render(<PendingAdmissionsSection />);

      await waitFor(() => {
        const reviewButton = screen.getByText(/Review/i);
        user.click(reviewButton);
      });

      await waitFor(() => {
        const approveButton = screen.getByText('Approve');
        user.click(approveButton);
      });

      await waitFor(() => {
        expect(screen.getByText(/No pending admissions/i)).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    test('displays error message on API failure', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        json: jest.fn().mockResolvedValue({ error: 'Failed to load' }),
      });

      render(<PendingAdmissionsSection />);

      await waitFor(() => {
        expect(screen.getByText('Failed to load pending admissions')).toBeInTheDocument();
      });
    });

    test('displays error on review submission failure', async () => {
      const user = userEvent.setup();
      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({ admissions: mockAdmissions }),
        })
        .mockResolvedValueOnce({
          ok: false,
          json: jest.fn().mockResolvedValue({ error: 'Review failed' }),
        });

      render(<PendingAdmissionsSection />);

      await waitFor(() => {
        const reviewButton = screen.getByText(/Review/i);
        user.click(reviewButton);
      });

      await waitFor(() => {
        const approveButton = screen.getByText('Approve');
        user.click(approveButton);
      });

      await waitFor(() => {
        expect(screen.getByText('Review failed')).toBeInTheDocument();
      });
    });

    test('shows "No pending admissions" when empty', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({ admissions: [] }),
      });

      render(<PendingAdmissionsSection />);

      await waitFor(() => {
        expect(screen.getByText(/No pending admissions/i)).toBeInTheDocument();
      });
    });
  });
});
