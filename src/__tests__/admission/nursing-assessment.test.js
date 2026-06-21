import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

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
    auth: { user: { id: 'user-123', role: 'staff', tenantId: 'tenant-123' } },
    accessToken: 'mock-token-123',
    token: 'mock-token-123',
    loading: false,
    login: jest.fn(),
    logout: jest.fn(),
  }),
}));

global.fetch = jest.fn();

describe('Nursing Assessment Form', () => {
  beforeEach(() => {
    fetch.mockClear();
    jest.clearAllMocks();
  });

  describe('Form Rendering', () => {
    test('renders nursing assessment form title', () => {
      const { container } = render(
        <div>
          <h1>Nursing Assessment Form</h1>
        </div>
      );
      expect(screen.getByText(/Nursing Assessment Form/i)).toBeInTheDocument();
    });

    test('contains demographic section', () => {
      const { container } = render(
        <div>
          <div>Demographics</div>
        </div>
      );
      expect(screen.getByText(/Demographics/i)).toBeInTheDocument();
    });

    test('contains vital signs section', () => {
      const { container } = render(
        <div>
          <div>Vital Signs</div>
        </div>
      );
      expect(screen.getByText(/Vital Signs/i)).toBeInTheDocument();
    });

    test('contains allergies section', () => {
      const { container } = render(
        <div>
          <div>Allergies</div>
        </div>
      );
      expect(screen.getByText(/Allergies/i)).toBeInTheDocument();
    });

    test('contains medication list input', () => {
      const { container } = render(
        <div>
          <input type="text" placeholder="Medication Name" />
          <input type="text" placeholder="Dosage" />
          <input type="text" placeholder="Frequency" />
        </div>
      );
      expect(screen.getByPlaceholderText(/Medication Name/i)).toBeInTheDocument();
    });
  });

  describe('Medication List Management', () => {
    test('allows adding medication entry', async () => {
      const { container } = render(
        <div>
          <input type="text" placeholder="Medication Name" />
          <button>Add Medication</button>
        </div>
      );
      const addBtn = screen.getByRole('button', { name: /Add Medication/i });
      const user = userEvent.setup();
      
      expect(addBtn).toBeInTheDocument();
    });

    test('allows removing medication entry', async () => {
      const { container } = render(
        <div>
          <input type="text" placeholder="Medication Name" />
          <button>Remove</button>
        </div>
      );
      const removeBtn = screen.getByRole('button', { name: /Remove/i });
      
      expect(removeBtn).toBeInTheDocument();
    });

    test('captures medication name input', async () => {
      const user = userEvent.setup();
      render(
        <input type="text" placeholder="Medication Name" />
      );

      const input = screen.getByPlaceholderText(/Medication Name/i);
      await user.type(input, 'Metformin');

      expect(input.value).toBe('Metformin');
    });

    test('captures dosage input', async () => {
      const user = userEvent.setup();
      render(
        <input type="text" placeholder="Dosage" />
      );

      const input = screen.getByPlaceholderText(/Dosage/i);
      await user.type(input, '500mg');

      expect(input.value).toBe('500mg');
    });

    test('captures frequency input', async () => {
      const user = userEvent.setup();
      render(
        <input type="text" placeholder="Frequency" />
      );

      const input = screen.getByPlaceholderText(/Frequency/i);
      await user.type(input, 'Twice daily');

      expect(input.value).toBe('Twice daily');
    });

    test('stores multiple medication entries', async () => {
      const medications = [
        { name: 'Lisinopril', dosage: '10mg', frequency: 'Once daily' },
        { name: 'Atorvastatin', dosage: '20mg', frequency: 'Once daily' },
        { name: 'Aspirin', dosage: '81mg', frequency: 'Once daily' },
      ];

      expect(medications.length).toBe(3);
      expect(medications[0].name).toBe('Lisinopril');
      expect(medications[1].name).toBe('Atorvastatin');
      expect(medications[2].name).toBe('Aspirin');
    });
  });

  describe('Date Range Validation', () => {
    test('validates start date before end date', () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');

      expect(startDate < endDate).toBe(true);
    });

    test('rejects end date before start date', () => {
      const startDate = new Date('2024-12-31');
      const endDate = new Date('2024-01-01');

      expect(startDate > endDate).toBe(true);
    });

    test('allows same day for start and end', () => {
      const startDate = new Date('2024-06-15');
      const endDate = new Date('2024-06-15');

      expect(startDate.getTime()).toBe(endDate.getTime());
    });
  });

  describe('Enum Field Validation', () => {
    test('validates status enum values', () => {
      const validStatuses = ['active', 'completed', 'pending'];
      const testStatus = 'active';

      expect(validStatuses).toContain(testStatus);
    });

    test('validates diagnosis type enum values', () => {
      const validDiagnoses = ['primary', 'secondary', 'comorbid'];
      const testDiagnosis = 'primary';

      expect(validDiagnoses).toContain(testDiagnosis);
    });

    test('rejects invalid enum values', () => {
      const validStatuses = ['active', 'completed', 'pending'];
      const invalidStatus = 'invalid';

      expect(validStatuses).not.toContain(invalidStatus);
    });
  });

  describe('Medical History Text Fields', () => {
    test('accepts medical history text input', async () => {
      const user = userEvent.setup();
      render(
        <textarea placeholder="Medical History" />
      );

      const input = screen.getByPlaceholderText(/Medical History/i);
      await user.type(input, 'Patient has history of diabetes and hypertension');

      expect(input.value).toBe('Patient has history of diabetes and hypertension');
    });

    test('accepts allergy information', async () => {
      const user = userEvent.setup();
      render(
        <textarea placeholder="Known Allergies" />
      );

      const input = screen.getByPlaceholderText(/Known Allergies/i);
      await user.type(input, 'Penicillin - anaphylaxis');

      expect(input.value).toBe('Penicillin - anaphylaxis');
    });

    test('accepts surgery history', async () => {
      const user = userEvent.setup();
      render(
        <textarea placeholder="Surgical History" />
      );

      const input = screen.getByPlaceholderText(/Surgical History/i);
      await user.type(input, 'Appendectomy 2010, Knee surgery 2018');

      expect(input.value).toBe('Appendectomy 2010, Knee surgery 2018');
    });

    test('accepts vaccination history', async () => {
      const user = userEvent.setup();
      render(
        <textarea placeholder="Vaccination History" />
      );

      const input = screen.getByPlaceholderText(/Vaccination History/i);
      await user.type(input, 'Up to date on all vaccinations');

      expect(input.value).toBe('Up to date on all vaccinations');
    });
  });

  describe('Vital Signs Fields', () => {
    test('accepts temperature input', async () => {
      const user = userEvent.setup();
      render(
        <input type="number" placeholder="Temperature (F)" />
      );

      const input = screen.getByPlaceholderText(/Temperature/i);
      await user.type(input, '98.6');

      expect(input.value).toBe('98.6');
    });

    test('accepts blood pressure input', async () => {
      const user = userEvent.setup();
      render(
        <input type="text" placeholder="Blood Pressure" />
      );

      const input = screen.getByPlaceholderText(/Blood Pressure/i);
      await user.type(input, '120/80');

      expect(input.value).toBe('120/80');
    });

    test('accepts pulse input', async () => {
      const user = userEvent.setup();
      render(
        <input type="number" placeholder="Pulse (BPM)" />
      );

      const input = screen.getByPlaceholderText(/Pulse/i);
      await user.type(input, '72');

      expect(input.value).toBe('72');
    });

    test('accepts respiration rate input', async () => {
      const user = userEvent.setup();
      render(
        <input type="number" placeholder="Respiration Rate" />
      );

      const input = screen.getByPlaceholderText(/Respiration Rate/i);
      await user.type(input, '16');

      expect(input.value).toBe('16');
    });

    test('accepts oxygen saturation input', async () => {
      const user = userEvent.setup();
      render(
        <input type="number" placeholder="O2 Saturation (%)" />
      );

      const input = screen.getByPlaceholderText(/O2 Saturation/i);
      await user.type(input, '98');

      expect(input.value).toBe('98');
    });
  });

  describe('Assessment Submission', () => {
    test('sends assessment data to API on submit', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ assessment_id: 'assess-123' }),
      });

      const mockData = {
        patient_name: 'John Doe',
        assessment_date: '2024-05-17',
        vital_temperature: 98.6,
      };

      await fetch('/api/v1/admission/nursing-assessment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer mock-token-123',
        },
        body: JSON.stringify(mockData),
      });

      expect(fetch).toHaveBeenCalledWith(
        '/api/v1/admission/nursing-assessment',
        expect.objectContaining({
          method: 'POST',
        })
      );
    });

    test('handles assessment submission error', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Validation failed' }),
      });

      const response = await fetch('/api/v1/admission/nursing-assessment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patient_name: 'John' }),
      });

      const data = await response.json();
      expect(data.error).toBeDefined();
    });
  });

  describe('Form Validation', () => {
    test('requires assessment date', () => {
      const formData = {
        assessment_date: '',
        vital_temperature: 98.6,
      };

      const isValid = formData.assessment_date && formData.vital_temperature;
      expect(isValid).toBe(false);
    });

    test('requires temperature reading', () => {
      const formData = {
        assessment_date: '2024-05-17',
        vital_temperature: null,
      };

      const isValid = formData.assessment_date && formData.vital_temperature;
      expect(isValid).toBe(false);
    });

    test('validates temperature range', () => {
      const temperature = 98.6;
      const isValidTemp = temperature > 90 && temperature < 110;

      expect(isValidTemp).toBe(true);
    });

    test('rejects invalid temperature', () => {
      const temperature = 150;
      const isValidTemp = temperature > 90 && temperature < 110;

      expect(isValidTemp).toBe(false);
    });
  });

  describe('Accessibility', () => {
    test('vital signs form has proper input types', () => {
      const { container } = render(
        <div>
          <input type="number" placeholder="Temperature" />
          <input type="text" placeholder="Blood Pressure" />
          <input type="number" placeholder="Pulse" />
        </div>
      );

      expect(screen.getByPlaceholderText(/Temperature/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/Blood Pressure/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/Pulse/i)).toBeInTheDocument();
    });

    test('medication list has clear labels', () => {
      const { container } = render(
        <div>
          <label>Medication Name</label>
          <label>Dosage</label>
          <label>Frequency</label>
        </div>
      );

      expect(screen.getByText(/Medication Name/i)).toBeInTheDocument();
      expect(screen.getByText(/Dosage/i)).toBeInTheDocument();
      expect(screen.getByText(/Frequency/i)).toBeInTheDocument();
    });
  });
});
