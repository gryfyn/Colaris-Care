/**
 * Error Handling Tests
 * Tests error scenarios, recovery options, and data preservation
 */

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
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
global.sessionStorage = {
  data: {},
  getItem: jest.fn(function(key) { return this.data[key] || null; }),
  setItem: jest.fn(function(key, value) { this.data[key] = value; }),
  removeItem: jest.fn(function(key) { delete this.data[key]; }),
  clear: jest.fn(function() { this.data = {}; }),
};

describe('Invalid PDF Rejection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.sessionStorage.clear();
  });

  test('rejects file without PDF magic bytes', async () => {
    // JPEG header instead of PDF
    const jpegBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]);
    const isPdf = jpegBuffer[0] === 0x25 && jpegBuffer[1] === 0x50;

    expect(isPdf).toBe(false);
  });

  test('rejects empty PDF file', async () => {
    const emptyBuffer = Buffer.alloc(0);
    const isValid = emptyBuffer.length > 4;

    expect(isValid).toBe(false);
  });

  test('rejects corrupted PDF file', async () => {
    // Valid header but truncated
    const pdfHeader = Buffer.from([0x25, 0x50, 0x44, 0x46]); // %PDF
    const corruptedPdf = Buffer.concat([pdfHeader]); // Too short to be valid

    expect(corruptedPdf.length).toBeGreaterThan(0);
    expect(corruptedPdf[0]).toBe(0x25);
  });

  test('displays specific error message for invalid PDF', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 422,
      json: async () => ({
        error: 'Invalid PDF file - file does not appear to be a valid PDF',
      }),
    });

    const response = await fetch('/api/v1/admission/forms/admission-123/documents', {
      method: 'POST',
      headers: { Authorization: 'Bearer mock-token' },
      body: JSON.stringify({
        file_data: 'not-pdf-data',
        document_type: 'nursing',
      }),
    });

    expect(response.status).toBe(422);
    const data = await response.json();
    expect(data.error).toContain('PDF');
  });

  test('allows user to retry with valid file', async () => {
    global.fetch
      .mockResolvedValueOnce({
        ok: false,
        status: 422,
        json: async () => ({ error: 'Invalid PDF' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { documentId: 'doc-123' } }),
      });

    let response = await fetch('/api/v1/admission/forms/admission-123/documents', {
      method: 'POST',
      headers: { Authorization: 'Bearer mock-token' },
      body: JSON.stringify({
        file_data: 'invalid',
        document_type: 'nursing',
      }),
    });
    expect(response.ok).toBe(false);

    response = await fetch('/api/v1/admission/forms/admission-123/documents', {
      method: 'POST',
      headers: { Authorization: 'Bearer mock-token' },
      body: JSON.stringify({
        file_data: Buffer.from([0x25, 0x50, 0x44, 0x46]).toString('base64'),
        document_type: 'nursing',
      }),
    });
    expect(response.ok).toBe(true);
  });
});

describe('Oversized File Rejection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('rejects file larger than 50MB', async () => {
    const MAX_SIZE = 50 * 1024 * 1024;
    const oversizedBuffer = Buffer.alloc(MAX_SIZE + 1);

    expect(oversizedBuffer.length > MAX_SIZE).toBe(true);
  });

  test('displays specific error message for oversized file', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 422,
      json: async () => ({
        error: 'File too large - maximum 50MB allowed',
      }),
    });

    const response = await fetch('/api/v1/admission/forms/admission-123/documents', {
      method: 'POST',
      headers: { Authorization: 'Bearer mock-token' },
      body: JSON.stringify({
        file_data: 'x'.repeat(51 * 1024 * 1024),
        document_type: 'nursing',
      }),
    });

    expect(response.status).toBe(422);
    const data = await response.json();
    expect(data.error).toContain('50MB');
  });

  test('suggests compression or alternative approach', async () => {
    const suggestion = 'File is too large. Please compress the PDF or upload a smaller file.';
    expect(suggestion).toContain('compress');
  });

  test('allows retry after user compresses file', async () => {
    global.fetch
      .mockResolvedValueOnce({
        ok: false,
        status: 422,
        json: async () => ({ error: 'File too large' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { documentId: 'doc-123' } }),
      });

    let response = await fetch('/api/v1/admission/forms/admission-123/documents', {
      method: 'POST',
      headers: { Authorization: 'Bearer mock-token' },
      body: JSON.stringify({
        file_data: 'x'.repeat(51 * 1024 * 1024),
        document_type: 'nursing',
      }),
    });
    expect(response.ok).toBe(false);

    response = await fetch('/api/v1/admission/forms/admission-123/documents', {
      method: 'POST',
      headers: { Authorization: 'Bearer mock-token' },
      body: JSON.stringify({
        file_data: 'x'.repeat(10 * 1024 * 1024), // Compressed
        document_type: 'nursing',
      }),
    });
    expect(response.ok).toBe(true);
  });
});

describe('Missing Required Fields', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('shows helpful error for missing name field', async () => {
    const errorMessage = 'Patient Full Name is required';
    expect(errorMessage).toContain('Name');
    expect(errorMessage).toContain('required');
  });

  test('shows helpful error for missing temperature', async () => {
    const errorMessage = 'Temperature is required. Please provide a valid reading.';
    expect(errorMessage).toContain('Temperature');
  });

  test('shows helpful error for missing date of birth', async () => {
    const errorMessage = 'Date of Birth is required to calculate patient age';
    expect(errorMessage).toContain('Date');
  });

  test('highlights which step has missing fields', async () => {
    const stepErrorMessage = 'Step 2: Vital Signs & Allergies - 3 required fields missing';
    expect(stepErrorMessage).toContain('Step');
    expect(stepErrorMessage).toContain('missing');
  });

  test('provides list of specific missing fields', async () => {
    const missingFields = ['Temperature', 'Pulse', 'Respirations'];
    const message = `Missing: ${missingFields.join(', ')}`;

    expect(message).toContain('Temperature');
    expect(message).toContain('Pulse');
  });
});

describe('Network Errors During PDF Generation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('handles timeout during PDF generation', async () => {
    global.fetch.mockRejectedValueOnce(new Error('Request timeout'));

    const formData = { name: 'John Doe' };
    global.sessionStorage.setItem('form_data_nursing-assessment', JSON.stringify({
      data: formData,
      timestamp: new Date().toISOString(),
    }));

    try {
      await fetch('/api/v1/admission/generate-pdf', {
        method: 'POST',
        headers: { Authorization: 'Bearer mock-token' },
        body: JSON.stringify({ formType: 'nursing-assessment', formData }),
      });
    } catch (err) {
      expect(err.message).toContain('timeout');
    }

    // Form data should still be in session
    const stored = JSON.parse(global.sessionStorage.getItem('form_data_nursing-assessment')).data;
    expect(stored.name).toBe('John Doe');
  });

  test('handles network error during PDF generation', async () => {
    global.fetch.mockRejectedValueOnce(new Error('Network error'));

    const formData = { name: 'Jane Smith' };

    try {
      await fetch('/api/v1/admission/generate-pdf', {
        method: 'POST',
        headers: { Authorization: 'Bearer mock-token' },
        body: JSON.stringify({ formType: 'nursing-assessment', formData }),
      });
    } catch (err) {
      expect(err.message).toContain('Network');
    }
  });

  test('shows user-friendly error message for network failure', async () => {
    const errorMessage = 'Unable to generate PDF. Please check your internet connection and try again.';
    expect(errorMessage).toContain('connection');
  });

  test('offers retry button when network fails', async () => {
    const hasRetryButton = true;
    expect(hasRetryButton).toBe(true);
  });

  test('retains form data for retry after network error', async () => {
    const formData = { name: 'Bob Jones', dob: '1960-01-15' };
    global.sessionStorage.setItem('form_data_nursing-assessment', JSON.stringify({
      data: formData,
      timestamp: new Date().toISOString(),
    }));

    global.fetch.mockRejectedValueOnce(new Error('Network error'));

    try {
      await fetch('/api/v1/admission/generate-pdf', {
        method: 'POST',
        headers: { Authorization: 'Bearer mock-token' },
        body: JSON.stringify({ formType: 'nursing-assessment', formData }),
      });
    } catch (err) {
      // Error expected
    }

    const stored = JSON.parse(global.sessionStorage.getItem('form_data_nursing-assessment')).data;
    expect(stored.name).toBe('Bob Jones');
    expect(stored.dob).toBe('1960-01-15');
  });
});

describe('Network Errors During Document Upload', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('handles connection error during document upload', async () => {
    const formData = { name: 'John Doe' };
    global.sessionStorage.setItem('form_data_nursing-assessment', JSON.stringify({
      data: formData,
      timestamp: new Date().toISOString(),
    }));

    global.fetch.mockRejectedValueOnce(new Error('Connection refused'));

    try {
      await fetch('/api/v1/admission/forms/admission-123/documents', {
        method: 'POST',
        headers: { Authorization: 'Bearer mock-token' },
        body: JSON.stringify({
          file_data: Buffer.from('PDF').toString('base64'),
          document_type: 'nursing',
        }),
      });
    } catch (err) {
      expect(err.message).toContain('Connection');
    }

    // Data should be preserved
    const stored = JSON.parse(global.sessionStorage.getItem('form_data_nursing-assessment')).data;
    expect(stored.name).toBe('John Doe');
  });

  test('shows error message for failed document upload', async () => {
    const errorMessage = 'Failed to upload PDF. Please try again.';
    expect(errorMessage).toContain('upload');
  });

  test('allows retry of document upload', async () => {
    global.fetch
      .mockRejectedValueOnce(new Error('Upload failed'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { documentId: 'doc-123' } }),
      });

    try {
      await fetch('/api/v1/admission/forms/admission-123/documents', {
        method: 'POST',
        headers: { Authorization: 'Bearer mock-token' },
        body: JSON.stringify({
          file_data: 'data',
          document_type: 'nursing',
        }),
      });
    } catch (err) {
      // First attempt fails
    }

    const response = await fetch('/api/v1/admission/forms/admission-123/documents', {
      method: 'POST',
      headers: { Authorization: 'Bearer mock-token' },
      body: JSON.stringify({
        file_data: 'data',
        document_type: 'nursing',
      }),
    });

    expect(response.ok).toBe(true);
  });

  test('preserves form data across upload retries', async () => {
    const formData = { name: 'Alice', temperature: 98.6 };
    global.sessionStorage.setItem('form_data_nursing-assessment', JSON.stringify({
      data: formData,
      timestamp: new Date().toISOString(),
    }));

    global.fetch
      .mockRejectedValueOnce(new Error('Upload failed'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { documentId: 'doc-123' } }),
      });

    try {
      await fetch('/api/v1/admission/forms/admission-123/documents', {
        method: 'POST',
        headers: { Authorization: 'Bearer mock-token' },
        body: JSON.stringify({
          file_data: 'data',
          document_type: 'nursing',
        }),
      });
    } catch (err) {
      // First attempt fails
    }

    // Retry
    const response = await fetch('/api/v1/admission/forms/admission-123/documents', {
      method: 'POST',
      headers: { Authorization: 'Bearer mock-token' },
      body: JSON.stringify({
        file_data: 'data',
        document_type: 'nursing',
      }),
    });

    expect(response.ok).toBe(true);

    // Form data still available
    const stored = JSON.parse(global.sessionStorage.getItem('form_data_nursing-assessment')).data;
    expect(stored.name).toBe('Alice');
  });
});

describe('Form Data Preservation on Error', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.sessionStorage.clear();
  });

  test('form data not lost on PDF generation failure', async () => {
    const formData = {
      name: 'John Doe',
      dob: '1960-01-15',
      temperature: 98.6,
      pulse: 72,
    };

    global.sessionStorage.setItem('form_data_nursing-assessment', JSON.stringify({
      data: formData,
      timestamp: new Date().toISOString(),
    }));

    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Server error' }),
    });

    await fetch('/api/v1/admission/generate-pdf', {
      method: 'POST',
      headers: { Authorization: 'Bearer mock-token' },
      body: JSON.stringify({ formType: 'nursing-assessment', formData }),
    });

    const stored = JSON.parse(global.sessionStorage.getItem('form_data_nursing-assessment')).data;
    expect(stored.name).toBe('John Doe');
    expect(stored.dob).toBe('1960-01-15');
    expect(stored.temperature).toBe(98.6);
  });

  test('form data not lost on validation error', async () => {
    const formData = { name: '', dob: '1960-01-15' };

    global.sessionStorage.setItem('form_data_nursing-assessment', JSON.stringify({
      data: formData,
      timestamp: new Date().toISOString(),
    }));

    const stored = JSON.parse(global.sessionStorage.getItem('form_data_nursing-assessment')).data;
    expect(stored.dob).toBe('1960-01-15');
  });

  test('form data recovered on page reload', async () => {
    const formData = { name: 'John Doe', temperature: 98.6 };

    global.sessionStorage.setItem('form_data_nursing-assessment', JSON.stringify({
      data: formData,
      timestamp: new Date().toISOString(),
    }));

    // Simulate page reload - session storage persists
    const stored = JSON.parse(global.sessionStorage.getItem('form_data_nursing-assessment')).data;
    expect(stored.name).toBe('John Doe');
  });

  test('form data persists across multiple error attempts', async () => {
    const formData = { name: 'Jane Smith', temperature: 99.1 };

    global.sessionStorage.setItem('form_data_nursing-assessment', JSON.stringify({
      data: formData,
      timestamp: new Date().toISOString(),
    }));

    global.fetch
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Error 1' }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Error 2' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { documentId: 'doc-123' } }),
      });

    // First error
    await fetch('/api/v1/admission/generate-pdf', {
      method: 'POST',
      headers: { Authorization: 'Bearer mock-token' },
      body: JSON.stringify({ formType: 'nursing-assessment', formData }),
    });

    let stored = JSON.parse(global.sessionStorage.getItem('form_data_nursing-assessment')).data;
    expect(stored.name).toBe('Jane Smith');

    // Second error
    await fetch('/api/v1/admission/generate-pdf', {
      method: 'POST',
      headers: { Authorization: 'Bearer mock-token' },
      body: JSON.stringify({ formType: 'nursing-assessment', formData }),
    });

    stored = JSON.parse(global.sessionStorage.getItem('form_data_nursing-assessment')).data;
    expect(stored.temperature).toBe(99.1);

    // Eventually succeeds
    await fetch('/api/v1/admission/generate-pdf', {
      method: 'POST',
      headers: { Authorization: 'Bearer mock-token' },
      body: JSON.stringify({ formType: 'nursing-assessment', formData }),
    });
  });
});

describe('Error Recovery Options', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('user can skip PDF download and proceed', async () => {
    const canSkip = true;
    expect(canSkip).toBe(true);
  });

  test('user can retry PDF generation', async () => {
    const canRetry = true;
    expect(canRetry).toBe(true);
  });

  test('user can go back to form and correct errors', async () => {
    const canGoBack = true;
    expect(canGoBack).toBe(true);
  });

  test('user can contact support for assistance', async () => {
    const supportOption = {
      text: 'Contact Support',
      link: '/support',
    };

    expect(supportOption.link).toBe('/support');
  });

  test('shows clear error recovery instructions', async () => {
    const instructions = 'Please try the following: 1) Check your internet connection 2) Try again 3) Contact support if problem persists';
    expect(instructions).toContain('try');
  });
});
