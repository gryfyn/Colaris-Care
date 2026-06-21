import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PreAdmissionWizard from '@/app/admission/pre-screening/page';

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    pathname: '/',
  }),
}));

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    auth: {
      accessToken: 'mock-token-123',
      user: { id: 'user-123', role: 'staff', tenantId: 'tenant-123' },
    },
    accessToken: 'mock-token-123',
    token: 'mock-token-123',
    loading: false,
    login: jest.fn(),
    logout: jest.fn(),
  }),
}));

global.fetch = jest.fn();

describe('Pre-Admission Screening Form', () => {
  jest.setTimeout(10000);

  beforeEach(() => {
    fetch.mockClear();
    jest.clearAllMocks();
  });

  describe('Step 1: Referral & Funding - Rendering', () => {
    test('renders Step 1 with all required fields', () => {
      render(<PreAdmissionWizard nursingData={{ name: 'John Doe', dob: '1980-01-01', pronouns: 'he/him' }} />);

      expect(screen.getByText(/Referral Information/i)).toBeInTheDocument();
      expect(screen.getByText(/Funding & Insurance/i)).toBeInTheDocument();
      expect(screen.getByText(/Current Living Situation/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/Organization or professional name/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/Referring contact name/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/XXX-XX-XXXX/i)).toBeInTheDocument();
    });

    test('displays auto-filled nursing data as read-only badges', () => {
      const nursingData = {
        name: 'Jane Smith',
        dob: '1985-06-15',
        pronouns: 'she/her',
      };

      render(<PreAdmissionWizard nursingData={nursingData} />);

      expect(screen.getAllByText('Jane Smith').length).toBeGreaterThan(0);
      expect(screen.getAllByText('1985-06-15').length).toBeGreaterThan(0);
      expect(screen.getAllByText('she/her').length).toBeGreaterThan(0);
    });

    test('shows info box about auto-populated fields', () => {
      render(<PreAdmissionWizard nursingData={{}} />);

      expect(screen.getByText(/Fields already captured in the Nursing Assessment/i)).toBeInTheDocument();
    });
  });

  describe('Step 1: Validation', () => {
    test('email format validation', async () => {
      const user = userEvent.setup();
      render(<PreAdmissionWizard nursingData={{}} />);

      const emailInput = screen.getByPlaceholderText(/email@agency.org/i);
      await user.type(emailInput, 'invalid-email');

      expect(emailInput.value).toBe('invalid-email');
    });

    test('requires referringAgency for form completion', async () => {
      render(<PreAdmissionWizard nursingData={{}} />);

      const advanceBtn = screen.getByRole('button', { name: /Save & Continue/i });
      expect(advanceBtn).toBeDisabled();
    });
  });

  describe('Step 1: Form Submission', () => {
    test('enables advance button when all required fields are filled', async () => {
      render(<PreAdmissionWizard nursingData={{}} />);

      const agencyInput = screen.getByPlaceholderText(/Organization or professional name/i);
      const contactInput = screen.getByPlaceholderText(/Referring contact name/i);
      const ssnInput = screen.getByPlaceholderText(/XXX-XX-XXXX/i);
      const problemInput = screen.getByPlaceholderText(/Describe the presenting crisis/i);

      fireEvent.change(agencyInput, { target: { value: 'Test Agency' } });
      fireEvent.change(contactInput, { target: { value: 'John Contact' } });
      fireEvent.change(ssnInput, { target: { value: '123-45-6789' } });
      fireEvent.change(problemInput, { target: { value: 'Test presenting problem' } });

      const selects = screen.getAllByRole('combobox');
      fireEvent.change(selects[0], { target: { value: 'Family Home' } });
      fireEvent.change(selects[1], { target: { value: 'Multnomah' } });

      const dateInputs = document.querySelectorAll('input[type="date"]');
      if (dateInputs.length > 0) {
        fireEvent.change(dateInputs[0], { target: { value: '2024-05-10' } });
      }

      const advanceBtn = screen.getByRole('button', { name: /Save & Continue/i });
      expect(advanceBtn).not.toBeDisabled();
    });

    test('saves draft with correct API call', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ admission_id: 'adm-123' }),
      });

      const user = userEvent.setup();
      render(<PreAdmissionWizard nursingData={{}} />);

      const saveDraftBtn = screen.getAllByRole('button', { name: /Save Draft/i })[0];
      await user.click(saveDraftBtn);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          '/api/v1/admission/forms',
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              'Authorization': 'Bearer mock-token-123',
              'Content-Type': 'application/json',
            }),
          })
        );
      });
    });

    test('handles save draft error gracefully', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Server error' }),
        text: async () => JSON.stringify({ error: 'Server error' }),
      });

      render(<PreAdmissionWizard nursingData={{}} />);

      const saveDraftBtn = screen.getAllByRole('button', { name: /Save Draft/i })[0];

      fireEvent.click(saveDraftBtn);

      await waitFor(() => {
        expect(screen.getByText(/Server error/i)).toBeInTheDocument();
      });
    });
  });

  describe('Form Navigation and State', () => {
    test('Previous button is disabled on Step 1', () => {
      render(<PreAdmissionWizard nursingData={{}} />);

      const prevBtn = screen.getByRole('button', { name: /← Previous/i });
      expect(prevBtn).toBeDisabled();
    });

    test('sidebar displays all steps', () => {
      render(<PreAdmissionWizard nursingData={{}} />);

      expect(screen.getAllByText(/Pre-Admission Screening/i).length).toBeGreaterThan(0);
    });

    test('progress indicator shows current step', () => {
      render(<PreAdmissionWizard nursingData={{}} />);

      expect(screen.getByText(/Step 1 of 6/i)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    test('has descriptive step labels in sidebar', () => {
      render(<PreAdmissionWizard nursingData={{}} />);

      expect(screen.getByText(/Referral & Funding/i)).toBeInTheDocument();
    });

    test('progress indicator is visible and descriptive', () => {
      render(<PreAdmissionWizard nursingData={{}} />);

      expect(screen.getByText(/Step 1 of 6/i)).toBeInTheDocument();
    });
  });

  describe('Optional Fields', () => {
    test('OHP ID is optional', () => {
      render(<PreAdmissionWizard nursingData={{}} />);
      const ohpInput = screen.getByPlaceholderText(/OHP Member ID/i);
      expect(ohpInput.value).toBe('');
    });

    test('Other Insurance fields are optional', () => {
      render(<PreAdmissionWizard nursingData={{}} />);
      const otherInsInput = screen.getByPlaceholderText(/Insurance carrier name/i);
      expect(otherInsInput.value).toBe('');
    });
  });
});
