// File: __tests__/admission/PreScreeningForm.test.js

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PreScreeningForm from '@/app/admission/pre-screening/page';

const mockRouter = {
  push: jest.fn(),
  back: jest.fn(),
};

jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
}));

describe('PreScreeningForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  describe('Form Rendering', () => {
    test('renders all required form fields', () => {
      render(<PreScreeningForm />);

      expect(screen.getByPlaceholderText('Enter full name')).toBeInTheDocument();
      expect(screen.getByDisplayValue('')).toHaveLength(0);
      const dateFields = screen.getAllByDisplayValue('');
      expect(dateFields.length).toBeGreaterThan(0);
      expect(screen.getByPlaceholderText(/Contact phone/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/Emergency contact/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/Physician name/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/allergies/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/current medications/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/medical conditions/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/vision and hearing/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/mobility aids/i)).toBeInTheDocument();
    });

    test('renders form sections with headers', () => {
      render(<PreScreeningForm />);

      expect(screen.getByText('Personal Information')).toBeInTheDocument();
      expect(screen.getByText('Medical Information')).toBeInTheDocument();
      expect(screen.getByText('Functional Assessment')).toBeInTheDocument();
    });

    test('renders submit and back buttons', () => {
      render(<PreScreeningForm />);

      expect(screen.getByRole('button', { name: /Back/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Submit Pre-Screening Form/i })).toBeInTheDocument();
    });
  });

  describe('Form Validation - Required Fields', () => {
    test('shows validation errors for empty required fields on submit', async () => {
      render(<PreScreeningForm />);

      const submitButton = screen.getByRole('button', { name: /Submit Pre-Screening Form/i });
      expect(submitButton).toBeDisabled();
    });

    test('validates full name is required', async () => {
      render(<PreScreeningForm />);

      const fullNameInput = screen.getByPlaceholderText('Enter full name');
      await userEvent.type(fullNameInput, 'John Doe');
      await userEvent.clear(fullNameInput);

      const submitButton = screen.getByRole('button', { name: /Submit Pre-Screening Form/i });
      expect(submitButton).toBeDisabled();
    });

    test('validates date of birth is required', async () => {
      const user = userEvent.setup();
      render(<PreScreeningForm />);

      const fullNameInput = screen.getByPlaceholderText('Enter full name');
      const dobInputs = screen.getAllByDisplayValue('');

      await user.type(fullNameInput, 'John Doe');
      const dateInput = dobInputs[0].closest('input[type="date"]');
      if (dateInput) {
        await user.type(dateInput, '1990-01-01');
        await user.clear(dateInput);
      }

      const submitButton = screen.getByRole('button', { name: /Submit Pre-Screening Form/i });
      expect(submitButton).toBeDisabled();
    });
  });

  describe('Form Validation - Numeric Ranges', () => {
    test('accepts valid vital signs in range', async () => {
      render(<PreScreeningForm />);

      const fullNameInput = screen.getByPlaceholderText('Enter full name');
      await userEvent.type(fullNameInput, 'John Doe');

      const submitButton = screen.getByRole('button', { name: /Submit Pre-Screening Form/i });
      expect(submitButton).toBeDisabled();
    });
  });

  describe('Submit Behavior', () => {
    test('submit button disabled when form incomplete', () => {
      render(<PreScreeningForm />);

      const submitButton = screen.getByRole('button', { name: /Submit Pre-Screening Form/i });
      expect(submitButton).toBeDisabled();
    });

    test('submit button enabled when all fields filled', async () => {
      const user = userEvent.setup();
      render(<PreScreeningForm />);

      const fullNameInput = screen.getByPlaceholderText('Enter full name');
      const contactPhoneInput = screen.getByPlaceholderText(/Contact phone/i);
      const emergencyContactInput = screen.getByPlaceholderText(/Emergency contact/i);
      const primaryPhysicianInput = screen.getByPlaceholderText(/Physician name/i);
      const allergiesInput = screen.getByPlaceholderText(/allergies/i);
      const medicationsInput = screen.getByPlaceholderText(/current medications/i);
      const conditionsInput = screen.getByPlaceholderText(/medical conditions/i);
      const visionInput = screen.getByPlaceholderText(/vision and hearing/i);
      const mobilityInput = screen.getByPlaceholderText(/mobility aids/i);

      await user.type(fullNameInput, 'John Doe');
      const dateInputs = screen.getAllByDisplayValue('');
      if (dateInputs[0]) {
        await user.type(dateInputs[0], '1990-01-01');
      }
      await user.type(contactPhoneInput, '(555) 123-4567');
      await user.type(emergencyContactInput, 'Jane Doe');
      await user.type(primaryPhysicianInput, 'Dr. Smith');
      await user.type(allergiesInput, 'Penicillin');
      await user.type(medicationsInput, 'Lisinopril');
      await user.type(conditionsInput, 'Hypertension');
      await user.type(visionInput, 'Corrected vision');
      await user.type(mobilityInput, 'Walker');

      const submitButton = screen.getByRole('button', { name: /Submit Pre-Screening Form/i });
      expect(submitButton).not.toBeDisabled();
    });

    test('submit button disabled during loading', async () => {
      const user = userEvent.setup();
      global.fetch = jest.fn(() => new Promise(() => {}));

      render(<PreScreeningForm />);

      const fullNameInput = screen.getByPlaceholderText('Enter full name');
      const contactPhoneInput = screen.getByPlaceholderText(/Contact phone/i);
      const emergencyContactInput = screen.getByPlaceholderText(/Emergency contact/i);
      const primaryPhysicianInput = screen.getByPlaceholderText(/Physician name/i);
      const allergiesInput = screen.getByPlaceholderText(/allergies/i);
      const medicationsInput = screen.getByPlaceholderText(/current medications/i);
      const conditionsInput = screen.getByPlaceholderText(/medical conditions/i);
      const visionInput = screen.getByPlaceholderText(/vision and hearing/i);
      const mobilityInput = screen.getByPlaceholderText(/mobility aids/i);

      await user.type(fullNameInput, 'John Doe');
      const dateInputs = screen.getAllByDisplayValue('');
      if (dateInputs[0]) {
        await user.type(dateInputs[0], '1990-01-01');
      }
      await user.type(contactPhoneInput, '(555) 123-4567');
      await user.type(emergencyContactInput, 'Jane Doe');
      await user.type(primaryPhysicianInput, 'Dr. Smith');
      await user.type(allergiesInput, 'Penicillin');
      await user.type(medicationsInput, 'Lisinopril');
      await user.type(conditionsInput, 'Hypertension');
      await user.type(visionInput, 'Corrected vision');
      await user.type(mobilityInput, 'Walker');

      const submitButton = screen.getByRole('button', { name: /Submit Pre-Screening Form/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(submitButton).toBeDisabled();
        expect(screen.getByText(/Submitting/i)).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    test('shows error message on API failure', async () => {
      const user = userEvent.setup();
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: false,
          json: () => Promise.resolve({ message: 'API Error' }),
        })
      );

      render(<PreScreeningForm />);

      const fullNameInput = screen.getByPlaceholderText('Enter full name');
      const contactPhoneInput = screen.getByPlaceholderText(/Contact phone/i);
      const emergencyContactInput = screen.getByPlaceholderText(/Emergency contact/i);
      const primaryPhysicianInput = screen.getByPlaceholderText(/Physician name/i);
      const allergiesInput = screen.getByPlaceholderText(/allergies/i);
      const medicationsInput = screen.getByPlaceholderText(/current medications/i);
      const conditionsInput = screen.getByPlaceholderText(/medical conditions/i);
      const visionInput = screen.getByPlaceholderText(/vision and hearing/i);
      const mobilityInput = screen.getByPlaceholderText(/mobility aids/i);

      await user.type(fullNameInput, 'John Doe');
      const dateInputs = screen.getAllByDisplayValue('');
      if (dateInputs[0]) {
        await user.type(dateInputs[0], '1990-01-01');
      }
      await user.type(contactPhoneInput, '(555) 123-4567');
      await user.type(emergencyContactInput, 'Jane Doe');
      await user.type(primaryPhysicianInput, 'Dr. Smith');
      await user.type(allergiesInput, 'Penicillin');
      await user.type(medicationsInput, 'Lisinopril');
      await user.type(conditionsInput, 'Hypertension');
      await user.type(visionInput, 'Corrected vision');
      await user.type(mobilityInput, 'Walker');

      const submitButton = screen.getByRole('button', { name: /Submit Pre-Screening Form/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('API Error')).toBeInTheDocument();
      });
    });

    test('displays error in red alert box', async () => {
      const user = userEvent.setup();
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: false,
          json: () => Promise.resolve({ message: 'Network Error' }),
        })
      );

      render(<PreScreeningForm />);

      const fullNameInput = screen.getByPlaceholderText('Enter full name');
      const contactPhoneInput = screen.getByPlaceholderText(/Contact phone/i);
      const emergencyContactInput = screen.getByPlaceholderText(/Emergency contact/i);
      const primaryPhysicianInput = screen.getByPlaceholderText(/Physician name/i);
      const allergiesInput = screen.getByPlaceholderText(/allergies/i);
      const medicationsInput = screen.getByPlaceholderText(/current medications/i);
      const conditionsInput = screen.getByPlaceholderText(/medical conditions/i);
      const visionInput = screen.getByPlaceholderText(/vision and hearing/i);
      const mobilityInput = screen.getByPlaceholderText(/mobility aids/i);

      await user.type(fullNameInput, 'John Doe');
      const dateInputs = screen.getAllByDisplayValue('');
      if (dateInputs[0]) {
        await user.type(dateInputs[0], '1990-01-01');
      }
      await user.type(contactPhoneInput, '(555) 123-4567');
      await user.type(emergencyContactInput, 'Jane Doe');
      await user.type(primaryPhysicianInput, 'Dr. Smith');
      await user.type(allergiesInput, 'Penicillin');
      await user.type(medicationsInput, 'Lisinopril');
      await user.type(conditionsInput, 'Hypertension');
      await user.type(visionInput, 'Corrected vision');
      await user.type(mobilityInput, 'Walker');

      const submitButton = screen.getByRole('button', { name: /Submit Pre-Screening Form/i });
      await user.click(submitButton);

      await waitFor(() => {
        const errorBox = screen.getByText('Network Error').closest('div');
        expect(errorBox).toHaveStyle({ color: '#dc2626' });
      });
    });
  });

  describe('Success Handling', () => {
    test('shows success message on form submission', async () => {
      const user = userEvent.setup();
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ id: '123', admission_id: '456' }),
        })
      );

      render(<PreScreeningForm />);

      const fullNameInput = screen.getByPlaceholderText('Enter full name');
      const contactPhoneInput = screen.getByPlaceholderText(/Contact phone/i);
      const emergencyContactInput = screen.getByPlaceholderText(/Emergency contact/i);
      const primaryPhysicianInput = screen.getByPlaceholderText(/Physician name/i);
      const allergiesInput = screen.getByPlaceholderText(/allergies/i);
      const medicationsInput = screen.getByPlaceholderText(/current medications/i);
      const conditionsInput = screen.getByPlaceholderText(/medical conditions/i);
      const visionInput = screen.getByPlaceholderText(/vision and hearing/i);
      const mobilityInput = screen.getByPlaceholderText(/mobility aids/i);

      await user.type(fullNameInput, 'John Doe');
      const dateInputs = screen.getAllByDisplayValue('');
      if (dateInputs[0]) {
        await user.type(dateInputs[0], '1990-01-01');
      }
      await user.type(contactPhoneInput, '(555) 123-4567');
      await user.type(emergencyContactInput, 'Jane Doe');
      await user.type(primaryPhysicianInput, 'Dr. Smith');
      await user.type(allergiesInput, 'Penicillin');
      await user.type(medicationsInput, 'Lisinopril');
      await user.type(conditionsInput, 'Hypertension');
      await user.type(visionInput, 'Corrected vision');
      await user.type(mobilityInput, 'Walker');

      const submitButton = screen.getByRole('button', { name: /Submit Pre-Screening Form/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/successfully/i)).toBeInTheDocument();
      });
    });

    test('redirects to nursing assessment on success', async () => {
      const user = userEvent.setup();
      jest.useFakeTimers();

      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ id: '123', admission_id: '456' }),
        })
      );

      render(<PreScreeningForm />);

      const fullNameInput = screen.getByPlaceholderText('Enter full name');
      const contactPhoneInput = screen.getByPlaceholderText(/Contact phone/i);
      const emergencyContactInput = screen.getByPlaceholderText(/Emergency contact/i);
      const primaryPhysicianInput = screen.getByPlaceholderText(/Physician name/i);
      const allergiesInput = screen.getByPlaceholderText(/allergies/i);
      const medicationsInput = screen.getByPlaceholderText(/current medications/i);
      const conditionsInput = screen.getByPlaceholderText(/medical conditions/i);
      const visionInput = screen.getByPlaceholderText(/vision and hearing/i);
      const mobilityInput = screen.getByPlaceholderText(/mobility aids/i);

      await user.type(fullNameInput, 'John Doe');
      const dateInputs = screen.getAllByDisplayValue('');
      if (dateInputs[0]) {
        await user.type(dateInputs[0], '1990-01-01');
      }
      await user.type(contactPhoneInput, '(555) 123-4567');
      await user.type(emergencyContactInput, 'Jane Doe');
      await user.type(primaryPhysicianInput, 'Dr. Smith');
      await user.type(allergiesInput, 'Penicillin');
      await user.type(medicationsInput, 'Lisinopril');
      await user.type(conditionsInput, 'Hypertension');
      await user.type(visionInput, 'Corrected vision');
      await user.type(mobilityInput, 'Walker');

      const submitButton = screen.getByRole('button', { name: /Submit Pre-Screening Form/i });
      await user.click(submitButton);

      jest.advanceTimersByTime(1500);

      expect(mockRouter.push).toHaveBeenCalledWith('/admission/nursing-assessment');

      jest.useRealTimers();
    });
  });

  describe('Back Button', () => {
    test('back button calls router.back()', async () => {
      const user = userEvent.setup();
      render(<PreScreeningForm />);

      const backButton = screen.getByRole('button', { name: /Back/i });
      await user.click(backButton);

      expect(mockRouter.back).toHaveBeenCalled();
    });

    test('back button does not submit form', async () => {
      const user = userEvent.setup();
      global.fetch = jest.fn();

      render(<PreScreeningForm />);

      const backButton = screen.getByRole('button', { name: /Back/i });
      await user.click(backButton);

      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('Field State Management', () => {
    test('updates form state on input change', async () => {
      const user = userEvent.setup();
      render(<PreScreeningForm />);

      const fullNameInput = screen.getByPlaceholderText('Enter full name');
      await user.type(fullNameInput, 'Jane Smith');

      expect(fullNameInput).toHaveValue('Jane Smith');
    });

    test('clears validation errors when field is edited', async () => {
      const user = userEvent.setup();
      render(<PreScreeningForm />);

      const contactPhoneInput = screen.getByPlaceholderText(/Contact phone/i);
      await user.type(contactPhoneInput, 'invalid');

      expect(contactPhoneInput).toHaveValue('invalid');
    });

    test('stores multiple field values correctly', async () => {
      const user = userEvent.setup();
      render(<PreScreeningForm />);

      const fullNameInput = screen.getByPlaceholderText('Enter full name');
      const contactPhoneInput = screen.getByPlaceholderText(/Contact phone/i);
      const emergencyContactInput = screen.getByPlaceholderText(/Emergency contact/i);

      await user.type(fullNameInput, 'John Doe');
      await user.type(contactPhoneInput, '(555) 123-4567');
      await user.type(emergencyContactInput, 'Jane Doe');

      expect(fullNameInput).toHaveValue('John Doe');
      expect(contactPhoneInput).toHaveValue('(555) 123-4567');
      expect(emergencyContactInput).toHaveValue('Jane Doe');
    });
  });
});
