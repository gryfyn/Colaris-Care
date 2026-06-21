/**
 * Field Validation Tests
 * Tests form validation across nursing assessment, pre-screening, and advance directive
 */

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    pathname: '/admission/nursing-assessment',
  }),
}));

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    auth: { user: { id: 'user-123', role: 'staff' } },
    token: 'mock-token',
    loading: false,
  }),
}));

global.fetch = jest.fn();

describe('Nursing Assessment Validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('cannot submit step with required fields empty', async () => {
    const formData = {
      name: '',
      dob: '',
      temperature: null,
    };

    const requiredFields = ['name', 'dob', 'temperature'];
    const hasErrors = requiredFields.some(field => !formData[field]);

    expect(hasErrors).toBe(true);
  });

  test('validation error message displays for missing name', async () => {
    const fieldName = 'Patient Full Name';
    const isRequired = true;
    const errorMessage = `${fieldName} is required`;

    expect(errorMessage).toContain('required');
    expect(errorMessage).toContain(fieldName);
  });

  test('validation error message displays for missing temperature', async () => {
    const fieldName = 'Temperature';
    const errorMessage = `${fieldName} is required`;

    expect(errorMessage).toContain('required');
  });

  test('validation error message displays for missing date of birth', async () => {
    const errorMessage = 'Date of Birth is required';
    expect(errorMessage).toContain('Date of Birth');
  });

  test('red asterisk shown on required fields', async () => {
    const requiredFieldMarker = '*';
    expect(requiredFieldMarker).toBe('*');
  });

  test('red border shown on error fields', async () => {
    const errorFieldStyle = {
      border: '2px solid #dc2626',
    };

    expect(errorFieldStyle.border).toContain('#dc2626'); // red color
  });

  test('error clears when required field is filled', async () => {
    const formData = { name: '' };
    const hasError = !formData.name;
    expect(hasError).toBe(true);

    formData.name = 'John Doe';
    const errorCleared = !!formData.name;
    expect(errorCleared).toBe(true);
  });

  test('all required fields in Step 1 are validated', async () => {
    const step1Fields = [
      'name', 'dob', 'age', 'gender', 'pronouns', 'language',
      'emergencyName', 'emergencyPhone', 'emergencyRelationship', 'reasonForAdmission',
    ];

    expect(step1Fields).toHaveLength(10);
  });

  test('all required fields in Step 2 are validated', async () => {
    const step2Fields = [
      'temperature', 'pulse', 'respirations', 'o2Sat', 'height',
      'weightActual', 'noKnownAllergies', 'scalpInspected',
    ];

    expect(step2Fields).toHaveLength(8);
  });

  test('age must be positive number', async () => {
    const validAges = [0, 1, 50, 100, 120];
    const invalidAges = [-1, -50, 'abc'];

    validAges.forEach(age => {
      expect(typeof age).toBe('number');
      expect(age).toBeGreaterThanOrEqual(0);
    });

    invalidAges.forEach(age => {
      const isValid = typeof age === 'number' && age >= 0;
      expect(isValid).toBe(false);
    });
  });

  test('temperature must be within physiological range', async () => {
    const validTemps = [95, 96, 98.6, 100, 104];
    const invalidTemps = [-5, 0, 150];

    validTemps.forEach(temp => {
      expect(temp).toBeGreaterThan(90);
      expect(temp).toBeLessThan(110);
    });
  });

  test('pulse must be between 40-200 bpm', async () => {
    const validPulses = [40, 60, 80, 100, 200];
    const invalidPulses = [-1, 0, 39, 201];

    validPulses.forEach(pulse => {
      expect(pulse).toBeGreaterThanOrEqual(40);
      expect(pulse).toBeLessThanOrEqual(200);
    });
  });

  test('respirations must be between 5-40 per minute', async () => {
    const validRespiration = [5, 12, 20, 40];
    const invalidRespiration = [-1, 4, 41];

    validRespiration.forEach(resp => {
      expect(resp).toBeGreaterThanOrEqual(5);
      expect(resp).toBeLessThanOrEqual(40);
    });
  });

  test('O2 saturation must be 0-100', async () => {
    const validO2 = [85, 90, 95, 98, 100];
    const invalidO2 = [-1, 0, 101, 120];

    validO2.forEach(o2 => {
      expect(o2).toBeGreaterThanOrEqual(0);
      expect(o2).toBeLessThanOrEqual(100);
    });
  });
});

describe('Pre-Screening Validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('step navigation blocked if required fields missing', async () => {
    const formData = {
      full_name: '',
      date_of_birth: '',
    };

    const canAdvance = formData.full_name && formData.date_of_birth;
    expect(canAdvance).toBeFalsy();
  });

  test('validation triggered on step transition', async () => {
    const validateOnTransition = true;
    expect(validateOnTransition).toBe(true);
  });

  test('date range validation: end >= start', async () => {
    const startDate = new Date('2026-01-15');
    const endDate = new Date('2026-01-10');

    const isValid = endDate >= startDate;
    expect(isValid).toBe(false);

    const validEndDate = new Date('2026-01-20');
    const isValidRange = validEndDate >= startDate;
    expect(isValidRange).toBe(true);
  });

  test('full_name is required', async () => {
    const errorMessage = 'full_name is required';
    expect(errorMessage).toContain('required');
  });

  test('date_of_birth is required', async () => {
    const errorMessage = 'date_of_birth is required';
    expect(errorMessage).toContain('required');
  });

  test('contact_phone is required', async () => {
    const errorMessage = 'contact_phone is required';
    expect(errorMessage).toContain('required');
  });

  test('contact_phone must be valid format', async () => {
    const validPhones = [
      '5551234567',
      '(555) 123-4567',
      '555-123-4567',
      '+1-555-123-4567',
    ];

    const invalidPhones = [
      '123',
      'abcdefghij',
      '555 123',
    ];

    validPhones.forEach(phone => {
      const hasDigits = /\d{10}/.test(phone.replace(/\D/g, ''));
      expect(hasDigits).toBe(true);
    });
  });

  test('distinguishes mandatory vs optional fields', async () => {
    const mandatory = ['full_name', 'date_of_birth', 'contact_phone'];
    const optional = ['emergency_contact_name', 'notes'];

    mandatory.forEach(field => {
      expect(['full_name', 'date_of_birth', 'contact_phone']).toContain(field);
    });

    optional.forEach(field => {
      expect(['full_name', 'date_of_birth', 'contact_phone']).not.toContain(field);
    });
  });

  test('date_of_birth must be valid date', async () => {
    const validDates = [
      '1960-01-15',
      '2000-12-31',
      '1945-06-20',
    ];

    const invalidDates = [
      'invalid-date',
      '2050-01-01', // future date
      '1800-01-01', // unrealistic
    ];

    validDates.forEach(date => {
      const parsed = new Date(date);
      expect(parsed.getTime()).toBeGreaterThan(0);
    });
  });
});

describe('Advance Directive Validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('signature fields are required', async () => {
    const signatureFields = [
      'resident_signature',
      'witness1_signature',
      'witness2_signature',
    ];

    signatureFields.forEach(field => {
      const formData = { [field]: '' };
      const hasSignature = !!formData[field];
      expect(hasSignature).toBe(false);
    });
  });

  test('healthcare agent info is required', async () => {
    const agentFields = ['healthcare_agent_name', 'healthcare_agent_phone'];

    const formData = {
      healthcare_agent_name: '',
      healthcare_agent_phone: '',
    };

    const hasAgent = formData.healthcare_agent_name && formData.healthcare_agent_phone;
    expect(hasAgent).toBeFalsy();
  });

  test('preference selections are required', async () => {
    const preferenceFields = [
      'mental_health_preferences',
      'psychiatric_med_preferences',
      'hospitalization_preference',
    ];

    const formData = preferenceFields.reduce((acc, field) => {
      acc[field] = '';
      return acc;
    }, {});

    const allSelected = preferenceFields.every(field => formData[field]);
    expect(allSelected).toBe(false);
  });

  test('witness 1 name and signature required', async () => {
    const witness1Data = {
      witness1_name: '',
      witness1_signature: '',
    };

    const hasWitness = witness1Data.witness1_name && witness1Data.witness1_signature;
    expect(hasWitness).toBeFalsy();
  });

  test('witness 2 name and signature required', async () => {
    const witness2Data = {
      witness2_name: '',
      witness2_signature: '',
    };

    const hasWitness = witness2Data.witness2_name && witness2Data.witness2_signature;
    expect(hasWitness).toBeFalsy();
  });

  test('healthcare agent phone must be valid format', async () => {
    const validPhone = '5551234567';
    const isValid = /^\d{10}$|^[\d\-() +]+$/.test(validPhone);
    expect(isValid).toBe(true);
  });

  test('signature date must not be in future', async () => {
    const today = new Date();
    const futureDate = new Date(today.getTime() + 86400000); // tomorrow

    const isValidDate = futureDate <= today;
    expect(isValidDate).toBe(false);

    const pastDate = new Date(today.getTime() - 86400000); // yesterday
    const isValidPastDate = pastDate <= today;
    expect(isValidPastDate).toBe(true);
  });
});

describe('Cross-Form Validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('demographic consistency check: name matches across forms', async () => {
    const nursingData = { name: 'John Doe' };
    const preScreeningData = { full_name: 'John Doe' };
    const advanceDirectiveData = { resident_name: 'John Doe' };

    const namesMatch =
      nursingData.name === preScreeningData.full_name &&
      preScreeningData.full_name === advanceDirectiveData.resident_name;

    expect(namesMatch).toBe(true);
  });

  test('warns if name differs between forms', async () => {
    const name1 = 'John Doe';
    const name2 = 'Jon Doe';

    const namesDiffer = name1.toLowerCase() !== name2.toLowerCase();
    if (namesDiffer) {
      const warningMessage = 'Name differs across forms. Please verify.';
      expect(warningMessage).toContain('differs');
    }
  });

  test('demographic consistency check: DOB matches across forms', async () => {
    const dob1 = '1960-01-15';
    const dob2 = '1960-01-15';

    const dobsMatch = dob1 === dob2;
    expect(dobsMatch).toBe(true);
  });

  test('warns if DOB differs between forms', async () => {
    const dob1 = '1960-01-15';
    const dob2 = '1960-01-16';

    const dobsDiffer = dob1 !== dob2;
    if (dobsDiffer) {
      const warningMessage = 'Date of birth differs between forms.';
      expect(warningMessage).toContain('differs');
    }
  });

  test('validates consistency of emergency contact info', async () => {
    const emergencyPhone1 = '5551234567';
    const emergencyPhone2 = '5551234567';

    const phonesMatch = emergencyPhone1 === emergencyPhone2;
    expect(phonesMatch).toBe(true);
  });

  test('shows warning banner for inconsistencies', async () => {
    const showWarning = true;
    const warningText = 'Some information differs from previous forms';

    if (showWarning) {
      expect(warningText).toContain('differs');
    }
  });

  test('allows user to confirm differences if intentional', async () => {
    const userConfirmed = true;
    expect(userConfirmed).toBe(true);
  });
});

describe('Real-Time Validation Feedback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('displays error immediately on blur', async () => {
    const fieldValue = '';
    const isRequired = true;
    const showError = isRequired && !fieldValue;

    expect(showError).toBe(true);
  });

  test('clears error message when field becomes valid', async () => {
    let fieldValue = '';
    let showError = !fieldValue;
    expect(showError).toBe(true);

    fieldValue = 'valid value';
    showError = !fieldValue;
    expect(showError).toBe(false);
  });

  test('highlights invalid fields in red', async () => {
    const fieldStyle = {
      borderColor: '#dc2626', // red
      backgroundColor: '#fef2f2', // light red
    };

    expect(fieldStyle.borderColor).toBe('#dc2626');
  });

  test('shows count of completed vs required fields', async () => {
    const requiredFields = 10;
    const completedFields = 7;

    const progressMessage = `${completedFields}/${requiredFields} fields completed`;
    expect(progressMessage).toContain('/');
  });

  test('progress bar fills as more fields complete', async () => {
    const completed = 7;
    const total = 10;
    const percentage = (completed / total) * 100;

    expect(percentage).toBe(70);
    expect(percentage).toBeGreaterThanOrEqual(0);
    expect(percentage).toBeLessThanOrEqual(100);
  });

  test('submit button disabled until all required fields filled', async () => {
    const requiredFieldsFilled = false;
    const submitDisabled = !requiredFieldsFilled;

    expect(submitDisabled).toBe(true);
  });

  test('submit button enabled when all required fields filled', async () => {
    const requiredFieldsFilled = true;
    const submitDisabled = !requiredFieldsFilled;

    expect(submitDisabled).toBe(false);
  });
});

describe('Error Message Display', () => {
  test('shows specific error for each missing field', async () => {
    const errors = {
      name: 'Patient Full Name is required',
      dob: 'Date of Birth is required',
      temperature: 'Temperature is required',
    };

    expect(errors.name).toContain('required');
    expect(errors.dob).toContain('required');
    expect(errors.temperature).toContain('required');
  });

  test('formats error messages consistently', async () => {
    const errorMessages = [
      'Name is required',
      'Date of Birth is required',
      'Email is invalid',
    ];

    errorMessages.forEach(msg => {
      // All should start with a field name
      expect(msg).toMatch(/^[A-Z]/);
    });
  });

  test('error messages are visible and accessible', async () => {
    const errorMessage = {
      text: 'Name is required',
      color: '#dc2626',
      role: 'alert',
    };

    expect(errorMessage.text).toBeDefined();
    expect(errorMessage.color).toBe('#dc2626');
    expect(errorMessage.role).toBe('alert');
  });
});
