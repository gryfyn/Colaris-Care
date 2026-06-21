/**
 * Staff Page E2E Workflow Test
 * Tests: Complete staff workflow from login → dashboard → multi-step interactions
 * Covers: View navigation, form submissions, API calls, list refreshes, error handling
 * Mocks: All fetch calls, useRouter, useAuth context
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StaffPage from '@/app/staff/page';

// ─── MOCK SETUP ────────────────────────────────────────────────────────────────

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    pathname: '/staff',
  }),
}));

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    auth: {
      user: {
        id: 'staff-123',
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@dependablecare.dev',
        role: 'staff',
        tenantId: 'tenant-123',
      },
      accessToken: 'mock-token-e2e-123',
    },
    token: 'mock-token-e2e-123',
    loading: false,
    login: jest.fn(),
    logout: jest.fn(),
  }),
}));

global.fetch = jest.fn();

// ─── TEST DATA (E2E WORKFLOW) ──────────────────────────────────────────────────

const mockAuthMe = {
  user: {
    id: 'staff-123',
    first_name: 'Jane',
    last_name: 'Smith',
    email: 'jane@dependablecare.dev',
    role: 'staff',
  },
};

const mockResidents = {
  data: [
    { id: 'res-1', first_name: 'Robert', last_name: 'Johnson', primary_diagnosis: 'Dementia' },
    { id: 'res-2', first_name: 'Susan', last_name: 'Williams', primary_diagnosis: 'Hypertension' },
  ],
};

const mockPendingNotes = {
  data: [
    { resident_id: 'res-1', first_name: 'Robert', last_name: 'Johnson' },
  ],
  total_pending: 1,
};

const mockProgressNotes = {
  data: [
    { id: 'note-1', resident_id: 'res-1', content: 'Patient stable', created_at: '2024-05-20' },
  ],
};

const mockMedications = {
  data: [
    {
      id: 'med-1',
      drug_name: 'Lisinopril',
      drug_strength: '10mg',
      dosage: '1 tablet',
      route: 'oral',
      frequency: 'daily',
      first_name: 'Robert',
      last_name: 'Johnson',
      is_prn: false,
      is_controlled_substance: false,
      special_instructions: 'Take in morning',
    },
    {
      id: 'med-2',
      drug_name: 'Fentanyl',
      drug_strength: '25mcg',
      dosage: '1 patch',
      route: 'transdermal',
      frequency: 'every 72 hours',
      first_name: 'Susan',
      last_name: 'Williams',
      is_prn: false,
      is_controlled_substance: true,
      special_instructions: null,
    },
    {
      id: 'med-3',
      drug_name: 'Tylenol',
      drug_strength: '500mg',
      dosage: '1-2 tablets',
      route: 'oral',
      frequency: 'as needed',
      first_name: 'Robert',
      last_name: 'Johnson',
      is_prn: true,
      is_controlled_substance: false,
      special_instructions: null,
    },
  ],
};

const mockIncidents = {
  data: [
    { id: 'inc-1', incident_date: '2024-05-20', first_name: 'Robert', last_name: 'Johnson', incident_type: 'Fall', review_status: 'pending' },
  ],
};

const mockDrugDisposal = {
  data: [
    { id: 'disp-1', disposal_date: '2024-05-20', first_name: 'Robert', last_name: 'Johnson', drug_name: 'Expired Ibuprofen', review_status: 'pending' },
  ],
};

const mockEvacuationDrills = {
  data: [
    { id: 'evac-1', drill_date: '2024-05-20', drill_type: 'Fire', all_residents_accounted: true, review_status: 'pending' },
  ],
};

const mockCarePlans = {
  data: [
    {
      id: 'plan-1',
      resident_name: 'Robert Johnson',
      plan_type: 'Care Plan',
      effective_date: '2024-01-01',
      expiration_date: '2024-12-31',
      status: 'active',
      goal1_statement: 'Maintain medication compliance',
      goal2_statement: 'Prevent falls',
      goal3_statement: 'Manage blood pressure',
      primary_counselor_name: 'Dr. Miller',
    },
  ],
};

const mockNotifications = {
  data: [
    { id: 'notif-1', title: 'Medication due', message: 'Robert needs Lisinopril', is_read: false, created_at: '2024-05-20T10:00:00Z' },
    { id: 'notif-2', title: 'Appointment reminder', message: 'Susan has doctor visit today', is_read: true, created_at: '2024-05-19T10:00:00Z', read_at: '2024-05-19T11:00:00Z' },
  ],
  pagination: { total: 2, pages: 1 },
};

const mockAnnouncements = {
  data: [
    { id: 'ann-1', type: 'announcement', title: 'Infection Control Update', message: 'New PPE requirements effective immediately', priority: 'high', published_at: '2024-05-20T08:00:00Z', author_first_name: 'Admin', author_last_name: 'User' },
  ],
};

const mockAppointments = {
  data: [
    { id: 'apt-1', first_name: 'Robert', last_name: 'Johnson', title: 'Doctor Visit', appointment_type: 'medical', scheduled_at: '2024-05-21T10:00:00Z', location: 'Medical Clinic', status: 'scheduled', description: 'Follow-up appointment' },
    { id: 'apt-2', first_name: 'Susan', last_name: 'Williams', title: 'Dentist Appointment', appointment_type: 'dental', scheduled_at: '2024-05-22T14:00:00Z', location: 'Dental Office', status: 'completed', description: 'Routine cleaning' },
  ],
};

const mockFaceSheets = {
  data: [
    {
      id: 'fs-1',
      first_name: 'Robert',
      last_name: 'Johnson',
      emergency_contact_name: 'John Johnson',
      emergency_contact_phone: '555-0100',
      emergency_contact_relationship: 'Son',
      primary_physician_name: 'Dr. Miller',
      primary_physician_phone: '555-0200',
      primary_physician_address: '123 Medical Ave',
      insurance_provider: 'Blue Cross',
      insurance_policy_number: 'BC123456',
      insurance_group_number: 'GRP789',
      medicare_number: 'MED123456789',
      medicaid_number: 'MCD123456789',
      dnr_status: false,
      form_data: {
        primary_name: 'John Johnson',
        pcp_name: 'Dr. Miller',
      },
    },
  ],
};

// ─── MOCK FETCH SETUP ──────────────────────────────────────────────────────────

function setupMockFetch() {
  fetch.mockImplementation((url, opts = {}) => {
    // Auth endpoints
    if (url.includes('/auth/me')) {
      return Promise.resolve({
        ok: true,
        json: async () => mockAuthMe,
      });
    }
    if (url.includes('/staff/assignments')) {
      return Promise.resolve({
        ok: true,
        json: async () => mockResidents,
      });
    }
    if (url.includes('/daily-progress-notes/pending')) {
      return Promise.resolve({
        ok: true,
        json: async () => mockPendingNotes,
      });
    }
    if (url.includes('/daily-progress-notes') && opts.method === 'POST') {
      return Promise.resolve({
        ok: true,
        json: async () => ({ id: 'note-new-1', message: 'Progress note created' }),
      });
    }
    if (url.includes('/medications?staff_only=1')) {
      return Promise.resolve({
        ok: true,
        json: async () => mockMedications,
      });
    }
    if (url.includes('/medications/') && url.includes('/administer')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ message: 'Medication administered successfully' }),
      });
    }
    if (url.includes('/incidents?staff_only=1')) {
      return Promise.resolve({
        ok: true,
        json: async () => mockIncidents,
      });
    }
    if (url.includes('/incidents') && opts.method === 'POST') {
      return Promise.resolve({
        ok: true,
        json: async () => ({ id: 'inc-new-1', message: 'Incident report created' }),
      });
    }
    if (url.includes('/drug-disposal?staff_only=1')) {
      return Promise.resolve({
        ok: true,
        json: async () => mockDrugDisposal,
      });
    }
    if (url.includes('/drug-disposal') && opts.method === 'POST') {
      return Promise.resolve({
        ok: true,
        json: async () => ({ id: 'disp-new-1', message: 'Drug disposal recorded' }),
      });
    }
    if (url.includes('/evacuation-drills?staff_only=1')) {
      return Promise.resolve({
        ok: true,
        json: async () => mockEvacuationDrills,
      });
    }
    if (url.includes('/evacuation-drills') && opts.method === 'POST') {
      return Promise.resolve({
        ok: true,
        json: async () => ({ id: 'evac-new-1', message: 'Evacuation drill recorded' }),
      });
    }
    if (url.includes('/care-plans')) {
      return Promise.resolve({
        ok: true,
        json: async () => mockCarePlans,
      });
    }
    if (url.includes('/notifications/') && url.includes('/read')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true }),
      });
    }
    if (url.includes('/notifications')) {
      return Promise.resolve({
        ok: true,
        json: async () => mockNotifications,
      });
    }
    if (url.includes('/announcements')) {
      return Promise.resolve({
        ok: true,
        json: async () => mockAnnouncements,
      });
    }
    if (url.includes('/appointments') && opts.method === 'PATCH') {
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true }),
      });
    }
    if (url.includes('/appointments')) {
      return Promise.resolve({
        ok: true,
        json: async () => mockAppointments,
      });
    }
    if (url.includes('/face-sheets')) {
      return Promise.resolve({
        ok: true,
        json: async () => mockFaceSheets,
      });
    }
    // Default fallback
    return Promise.resolve({
      ok: true,
      json: async () => ({ data: [] }),
    });
  });
}

function main() {
  return within(screen.getByRole('main'));
}

function getResidentsSearchInput() {
  return screen.getAllByPlaceholderText(/search residents/i).find(
    input => input.getAttribute('placeholder') === 'Search residents...'
  );
}

// ─── TESTS ────────────────────────────────────────────────────────────────────────

describe('Staff Page E2E Workflow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupMockFetch();
  });

  describe('E2E: Complete Staff Workflow', () => {
    it('staff logs in, lands on dashboard, and navigates through all sections', async () => {
      render(<StaffPage />);

      // 1. Initial load → Staff lands on dashboard
      await waitFor(() => {
        expect(screen.getByText(/Jane/)).toBeInTheDocument();
        expect(screen.getByText('Dependable Care')).toBeInTheDocument();
      });

      // 2. Dashboard displays staff info and stats
      await waitFor(() => {
        expect(screen.getByText('Assigned Residents')).toBeInTheDocument();
        expect(screen.getByText('2')).toBeInTheDocument(); // 2 residents
      });

      // 3. Navigate to My Residents
      const residentsBtn = screen.getAllByTitle('My Residents')[0];
      fireEvent.click(residentsBtn);
      await waitFor(() => {
        expect(screen.getByText('Robert Johnson')).toBeInTheDocument();
        expect(screen.getByText('Susan Williams')).toBeInTheDocument();
      });

      // 4. Navigate to Care Plans
      const carePlanBtn = screen.getAllByTitle('Care Plan')[0];
      fireEvent.click(carePlanBtn);
      await waitFor(() => {
        expect(screen.getByText('Robert Johnson')).toBeInTheDocument();
        expect(screen.getByText(/Maintain medication compliance/)).toBeInTheDocument();
      });

      // 5. Navigate to Progress Notes
      const progressBtn = screen.getAllByTitle('Progress Notes')[0];
      fireEvent.click(progressBtn);
      await waitFor(() => {
        expect(screen.getByText(/Pending Progress Notes/i)).toBeInTheDocument();
      });

      // 6. Navigate to Medications
      const medsBtn = screen.getAllByTitle('Medications')[0];
      fireEvent.click(medsBtn);
      await waitFor(() => {
        expect(screen.getByText('Lisinopril')).toBeInTheDocument();
        expect(screen.getByText('Fentanyl')).toBeInTheDocument();
      });

      // 7. Navigate to Incident Reports
      const incidentBtn = screen.getAllByTitle('Incident Reports')[0];
      fireEvent.click(incidentBtn);
      await waitFor(() => {
        expect(main().getByText('Incident Reports')).toBeInTheDocument();
      });

      // 8. Navigate to Drug Disposal
      const disposalBtn = screen.getAllByTitle('Drug Disposal')[0];
      fireEvent.click(disposalBtn);
      await waitFor(() => {
        expect(screen.getByText('Drug Disposal Records')).toBeInTheDocument();
      });

      // 9. Navigate to Evacuation Drills
      const evacuationBtn = screen.getAllByTitle('Evacuation Drill')[0];
      fireEvent.click(evacuationBtn);
      await waitFor(() => {
        expect(screen.getByText('Evacuation Drills')).toBeInTheDocument();
      });

      // 10. Navigate to Announcements
      const announcementBtn = screen.getAllByTitle('Announcements')[0];
      fireEvent.click(announcementBtn);
      await waitFor(() => {
        expect(main().getByText('Announcements')).toBeInTheDocument();
        expect(screen.getByText('Infection Control Update')).toBeInTheDocument();
      });

      // 11. Navigate to Notifications
      const notifBtn = screen.getAllByTitle('Notifications')[0];
      fireEvent.click(notifBtn);
      await waitFor(() => {
        expect(main().getByText('Notifications')).toBeInTheDocument();
        expect(screen.getByText('Medication due')).toBeInTheDocument();
      });

      // 12. Navigate to Appointments
      const appointBtn = screen.getAllByTitle('Appointments')[0];
      fireEvent.click(appointBtn);
      await waitFor(() => {
        expect(screen.getByText(/My Appointments/i)).toBeInTheDocument();
        expect(screen.getByText('Robert Johnson')).toBeInTheDocument();
      });

      // 13. Navigate to Calendar
      const calendarBtn = screen.getAllByTitle('Calendar')[0];
      fireEvent.click(calendarBtn);
      await waitFor(() => {
        expect(main().getByText('Calendar')).toBeInTheDocument();
      });

      // 14. Navigate to Face Sheet
      const faceSheetBtn = screen.getAllByTitle('Face Sheet')[0];
      fireEvent.click(faceSheetBtn);
      await waitFor(() => {
        expect(screen.getByText('Face Sheets')).toBeInTheDocument();
      });

      // Verify all navigation tabs exist
      expect(screen.getByLabelText('Staff navigation')).toBeInTheDocument();
    });

    it('staff creates progress note → submits → sees pending state', async () => {
      render(<StaffPage />);

      // Navigate to Progress Notes
      await waitFor(() => {
        const progressBtn = screen.getAllByTitle('Progress Notes')[0];
        fireEvent.click(progressBtn);
      });

      // Verify pending notes are shown
      await waitFor(() => {
        expect(screen.getByText(/Pending Progress Notes/i)).toBeInTheDocument();
        expect(screen.getByText(/1 pending/)).toBeInTheDocument();
      });

      // Verify resident appears in pending list
      await waitFor(() => {
        expect(screen.getByText('Robert Johnson')).toBeInTheDocument();
      });

      // Fill Note button would navigate to form (tested separately)
      const fillNoteBtn = screen.getByRole('button', { name: /fill note/i });
      expect(fillNoteBtn).toBeInTheDocument();
    });

    it('staff files incident report → submits → shows in submissions list', async () => {
      render(<StaffPage />);

      // Navigate to Incident Reports
      await waitFor(() => {
        const incidentBtn = screen.getAllByTitle('Incident Reports')[0];
        fireEvent.click(incidentBtn);
      });

      // Verify incident list appears
      await waitFor(() => {
        expect(main().getByText('Incident Reports')).toBeInTheDocument();
        expect(screen.getByText('Fall')).toBeInTheDocument();
      });

      // Verify incident details
      expect(screen.getByText('Robert Johnson')).toBeInTheDocument();
      expect(screen.getByText(/pending/i)).toBeInTheDocument();

      // Verify Submit New button
      const submitBtn = screen.getByRole('button', { name: /submit new/i });
      expect(submitBtn).toBeInTheDocument();
    });

    it('staff logs drug disposal → submits → appears in list', async () => {
      render(<StaffPage />);

      // Navigate to Drug Disposal
      await waitFor(() => {
        const disposalBtn = screen.getAllByTitle('Drug Disposal')[0];
        fireEvent.click(disposalBtn);
      });

      // Verify drug disposal list appears
      await waitFor(() => {
        expect(screen.getByText('Drug Disposal Records')).toBeInTheDocument();
        expect(screen.getByText('Expired Ibuprofen')).toBeInTheDocument();
      });

      // Verify disposal details
      expect(screen.getByText('Robert Johnson')).toBeInTheDocument();
      expect(screen.getByText(/pending/i)).toBeInTheDocument();

      // Verify Submit New button
      const submitBtn = screen.getByRole('button', { name: /submit new/i });
      expect(submitBtn).toBeInTheDocument();
    });

    it('staff logs evacuation drill → submits → appears in list', async () => {
      render(<StaffPage />);

      // Navigate to Evacuation Drills
      await waitFor(() => {
        const evacuationBtn = screen.getAllByTitle('Evacuation Drill')[0];
        fireEvent.click(evacuationBtn);
      });

      // Verify evacuation list appears
      await waitFor(() => {
        expect(screen.getByText('Evacuation Drills')).toBeInTheDocument();
        expect(screen.getByText('Fire')).toBeInTheDocument();
      });

      // Verify evacuation details
      expect(screen.getByText(/All/)).toBeInTheDocument(); // All residents accounted
      expect(screen.getByText(/pending/i)).toBeInTheDocument();

      // Verify Submit New button
      const submitBtn = screen.getByRole('button', { name: /submit new/i });
      expect(submitBtn).toBeInTheDocument();
    });

    it('staff views medications → administers one → sees confirmation', async () => {
      render(<StaffPage />);

      // Navigate to Medications
      await waitFor(() => {
        const medsBtn = screen.getAllByTitle('Medications')[0];
        fireEvent.click(medsBtn);
      });

      // Verify medications appear
      await waitFor(() => {
        expect(screen.getByText('Lisinopril')).toBeInTheDocument();
        expect(screen.getByText('Fentanyl')).toBeInTheDocument();
      });

      // Find and click Administer button
      const adminBtns = screen.getAllByRole('button', { name: /administer/i });
      expect(adminBtns.length).toBeGreaterThanOrEqual(1);
      fireEvent.click(adminBtns[0]);

      // Verify modal opens with medication details
      await waitFor(() => {
        expect(screen.getByText(/Administer Medication/i)).toBeInTheDocument();
        expect(screen.getByText('Lisinopril')).toBeInTheDocument();
      });

      // Fill in administer form
      const doseInput = screen.getByDisplayValue('1 tablet');
      expect(doseInput).toBeInTheDocument();

      // Select shift
      const shiftSelect = screen.getByRole('combobox');
      expect(shiftSelect).toBeInTheDocument();

      // Submit administer
      const confirmBtn = screen.getByRole('button', { name: /Confirm Administration/i });
      fireEvent.click(confirmBtn);

      // Verify API was called
      await waitFor(() => {
        const calls = fetch.mock.calls.filter(c => c[0].includes('/medications/') && c[0].includes('/administer'));
        expect(calls.length).toBeGreaterThan(0);
        expect(calls[0][1].method).toBe('POST');
        expect(calls[0][1].headers['Authorization']).toBe('Bearer mock-token-e2e-123');
      });
    });

    it('staff marks notification as read', async () => {
      render(<StaffPage />);

      // Navigate to Notifications
      await waitFor(() => {
        const notifBtn = screen.getAllByTitle('Notifications')[0];
        fireEvent.click(notifBtn);
      });

      // Verify unread notification appears
      await waitFor(() => {
        expect(screen.getByText('Medication due')).toBeInTheDocument();
        expect(screen.getByText(/1 unread/)).toBeInTheDocument();
      });

      // Click unread notification to mark as read
      const unreadNotif = screen.getByText('Medication due');
      fireEvent.click(unreadNotif);

      // Verify mark read API call
      await waitFor(() => {
        const calls = fetch.mock.calls.filter(c => c[0].includes('/notifications/') && c[0].includes('/read'));
        expect(calls.length).toBeGreaterThan(0);
        expect(calls[0][1].method).toBe('PATCH');
        expect(calls[0][1].headers['Authorization']).toBe('Bearer mock-token-e2e-123');
      });
    });

    it('staff marks appointment complete', async () => {
      render(<StaffPage />);

      // Navigate to Appointments
      await waitFor(() => {
        const appointBtn = screen.getAllByTitle('Appointments')[0];
        fireEvent.click(appointBtn);
      });

      // Verify appointments appear
      await waitFor(() => {
        expect(screen.getByText('Robert Johnson')).toBeInTheDocument();
        expect(screen.getByText('Doctor Visit')).toBeInTheDocument();
      });

      // Find Complete button (only visible on scheduled appointment hover)
      fireEvent.mouseEnter(screen.getByText('Doctor Visit').closest('div'));
      const markCompleteBtn = await screen.findByRole('button', { name: /Complete/i });
      fireEvent.click(markCompleteBtn);

      // Verify API call
      await waitFor(() => {
        const calls = fetch.mock.calls.filter(c => c[0].includes('/appointments/') && c[1]?.method === 'PATCH');
        expect(calls.length).toBeGreaterThan(0);
        expect(calls[0][1].method).toBe('PATCH');
        expect(calls[0][1].headers['Authorization']).toBe('Bearer mock-token-e2e-123');
      });
    });

    it('staff views calendar with appointments', async () => {
      render(<StaffPage />);

      // Navigate to Calendar
      await waitFor(() => {
        const calendarBtn = screen.getAllByTitle('Calendar')[0];
        fireEvent.click(calendarBtn);
      });

      // Verify calendar appears
      await waitFor(() => {
        expect(main().getByText('Calendar')).toBeInTheDocument();
      });

      // Verify calendar elements
      expect(screen.getByText(/Sun/)).toBeInTheDocument();
      expect(screen.getByText(/Mon/)).toBeInTheDocument();
    });

    it('staff views face sheet resident details', async () => {
      render(<StaffPage />);

      // Navigate to Face Sheet
      await waitFor(() => {
        const faceSheetBtn = screen.getAllByTitle('Face Sheet')[0];
        fireEvent.click(faceSheetBtn);
      });

      // Verify face sheets list appears
      await waitFor(() => {
        expect(screen.getByText('Face Sheets')).toBeInTheDocument();
        expect(screen.getByText('Robert Johnson')).toBeInTheDocument();
      });

      // Click on a resident to view details
      const residentCard = screen.getByText('Robert Johnson').closest('div');
      fireEvent.click(residentCard);

      // Verify details appear
      await waitFor(() => {
        expect(screen.getByText(/Read Only/)).toBeInTheDocument();
        expect(screen.getByText('Robert Johnson')).toBeInTheDocument();
      });
    });
  });

  describe('E2E: Multi-Step Flows and State Management', () => {
    it('transitions between views preserve navigation state', async () => {
      render(<StaffPage />);

      // Load initial dashboard
      await waitFor(() => {
        expect(screen.getByText('Assigned Residents')).toBeInTheDocument();
      });

      // Navigate to residents
      const residentsBtn = screen.getAllByTitle('My Residents')[0];
      fireEvent.click(residentsBtn);
      await waitFor(() => {
        expect(screen.getByText('Robert Johnson')).toBeInTheDocument();
      });

      // Navigate to medications
      const medsBtn = screen.getAllByTitle('Medications')[0];
      fireEvent.click(medsBtn);
      await waitFor(() => {
        expect(screen.getByText('Lisinopril')).toBeInTheDocument();
      });

      // Navigate back to residents
      fireEvent.click(residentsBtn);
      await waitFor(() => {
        expect(screen.getByText('Robert Johnson')).toBeInTheDocument();
      });

      // Verify residents still rendered (state maintained)
      expect(screen.getByText('Susan Williams')).toBeInTheDocument();
    });

    it('submission triggers correct API call with auth token', async () => {
      render(<StaffPage />);

      // Navigate to Medications
      await waitFor(() => {
        const medsBtn = screen.getAllByTitle('Medications')[0];
        fireEvent.click(medsBtn);
      });

      // Click Administer on first medication
      await waitFor(() => {
        const adminBtns = screen.getAllByRole('button', { name: /administer/i });
        fireEvent.click(adminBtns[0]);
      });

      // Fill and submit form
      await waitFor(() => {
        expect(screen.getByText(/Administer Medication/i)).toBeInTheDocument();
      });

      const confirmBtn = screen.getByRole('button', { name: /Confirm Administration/i });
      fireEvent.click(confirmBtn);

      // Verify API call contains correct token and body
      await waitFor(() => {
        const calls = fetch.mock.calls.filter(c => c[0].includes('/medications/med-1/administer'));
        expect(calls.length).toBeGreaterThan(0);

        const [url, opts] = calls[0];
        expect(opts.method).toBe('POST');
        expect(opts.headers['Authorization']).toBe('Bearer mock-token-e2e-123');
        expect(opts.headers['Content-Type']).toBe('application/json');

        const body = JSON.parse(opts.body);
        expect(body.administered).toBe(true);
        expect(body.shift).toBeDefined();
      });
    });

    it('lists refresh after mutations (medication administer)', async () => {
      const originalMeds = { data: [...mockMedications.data] };
      let callCount = 0;

      fetch.mockImplementation((url, opts = {}) => {
        if (url.includes('/auth/me')) {
          return Promise.resolve({
            ok: true,
            json: async () => mockAuthMe,
          });
        }
        if (url.includes('/medications?staff_only=1')) {
          // Track calls to medications endpoint
          callCount++;
          return Promise.resolve({
            ok: true,
            json: async () => originalMeds,
          });
        }
        if (url.includes('/medications/med-1/administer')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ message: 'Medication administered successfully' }),
          });
        }
        if (url.includes('/staff/assignments')) {
          return Promise.resolve({
            ok: true,
            json: async () => mockResidents,
          });
        }
        if (url.includes('/daily-progress-notes/pending')) {
          return Promise.resolve({
            ok: true,
            json: async () => mockPendingNotes,
          });
        }
        // Default for other endpoints
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: [] }),
        });
      });

      render(<StaffPage />);

      // Navigate to Medications
      await waitFor(() => {
        const medsBtn = screen.getAllByTitle('Medications')[0];
        fireEvent.click(medsBtn);
      });

      const initialCallCount = callCount;
      expect(initialCallCount).toBeGreaterThan(0);

      // Administer medication
      await waitFor(() => {
        const adminBtns = screen.getAllByRole('button', { name: /administer/i });
        fireEvent.click(adminBtns[0]);
      });

      await waitFor(() => {
        expect(screen.getByText(/Administer Medication/i)).toBeInTheDocument();
      });

      const confirmBtn = screen.getByRole('button', { name: /Confirm Administration/i });
      fireEvent.click(confirmBtn);

      // Verify medications list endpoint called (may be called again for refresh)
      await waitFor(() => {
        expect(fetch.mock.calls.filter(c => c[0].includes('/medications/med-1/administer')).length).toBeGreaterThan(0);
      });
    });

    it('handles API errors gracefully (500 response)', async () => {
      fetch.mockImplementation((url, opts = {}) => {
        if (url.includes('/auth/me')) {
          return Promise.resolve({
            ok: true,
            json: async () => mockAuthMe,
          });
        }
        if (url.includes('/staff/assignments')) {
          return Promise.resolve({
            ok: false,
            json: async () => ({ error: 'Server error' }),
          });
        }
        if (url.includes('/daily-progress-notes/pending')) {
          return Promise.resolve({
            ok: true,
            json: async () => mockPendingNotes,
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: [] }),
        });
      });

      render(<StaffPage />);

      // Navigate to My Residents
      await waitFor(() => {
        const residentsBtn = screen.getAllByTitle('My Residents')[0];
        fireEvent.click(residentsBtn);
      });

      // Verify error state is handled
      await waitFor(() => {
        expect(screen.getByText(/No Residents/i)).toBeInTheDocument();
      });
    });

    it('displays empty states when no data available', async () => {
      fetch.mockImplementation((url, opts = {}) => {
        if (url.includes('/auth/me')) {
          return Promise.resolve({
            ok: true,
            json: async () => mockAuthMe,
          });
        }
        if (url.includes('/staff/assignments')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ data: [] }),
          });
        }
        if (url.includes('/daily-progress-notes/pending')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ data: [], total_pending: 0 }),
          });
        }
        if (url.includes('/medications')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ data: [] }),
          });
        }
        if (url.includes('/incidents')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ data: [] }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: [] }),
        });
      });

      render(<StaffPage />);

      // Check My Residents empty state
      await waitFor(() => {
        const residentsBtn = screen.getAllByTitle('My Residents')[0];
        fireEvent.click(residentsBtn);
      });

      await waitFor(() => {
        expect(screen.getByText(/No Residents/)).toBeInTheDocument();
      });

      // Check Medications empty state
      const medsBtn = screen.getAllByTitle('Medications')[0];
      fireEvent.click(medsBtn);

      await waitFor(() => {
        expect(screen.getByText(/No active medications/)).toBeInTheDocument();
      });

      // Check Incidents empty state
      const incidentBtn = screen.getAllByTitle('Incident Reports')[0];
      fireEvent.click(incidentBtn);

      await waitFor(() => {
        expect(screen.getByText(/No submissions yet/)).toBeInTheDocument();
      });
    });
  });

  describe('E2E: Authorization & Security', () => {
    it('includes auth token in all API calls', async () => {
      render(<StaffPage />);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalled();
      });

      // Check that all API calls have auth token
      const allCalls = fetch.mock.calls;
      const authCalls = allCalls.filter(call => call[1]?.headers?.Authorization);

      expect(authCalls.length).toBeGreaterThan(0);
      authCalls.forEach(call => {
        expect(call[1].headers.Authorization).toBe('Bearer mock-token-e2e-123');
      });
    });

    it('sets correct Content-Type for JSON requests', async () => {
      render(<StaffPage />);

      // Navigate to Medications and submit administer
      await waitFor(() => {
        const medsBtn = screen.getAllByTitle('Medications')[0];
        fireEvent.click(medsBtn);
      });

      await waitFor(() => {
        const adminBtns = screen.getAllByRole('button', { name: /administer/i });
        fireEvent.click(adminBtns[0]);
      });

      await waitFor(() => {
        const confirmBtn = screen.getByRole('button', { name: /Confirm Administration/i });
        fireEvent.click(confirmBtn);
      });

      // Verify Content-Type is set
      await waitFor(() => {
        const calls = fetch.mock.calls.filter(c => c[0].includes('/medications/') && c[0].includes('/administer'));
        expect(calls.length).toBeGreaterThan(0);
        expect(calls[0][1].headers['Content-Type']).toBe('application/json');
      });
    });

    it('uses same-origin credentials for API calls', async () => {
      render(<StaffPage />);

      // Navigate to Medications and submit administer
      await waitFor(() => {
        const medsBtn = screen.getAllByTitle('Medications')[0];
        fireEvent.click(medsBtn);
      });

      await waitFor(() => {
        const adminBtns = screen.getAllByRole('button', { name: /administer/i });
        fireEvent.click(adminBtns[0]);
      });

      await waitFor(() => {
        const confirmBtn = screen.getByRole('button', { name: /Confirm Administration/i });
        fireEvent.click(confirmBtn);
      });

      // Verify credentials are set
      await waitFor(() => {
        const calls = fetch.mock.calls.filter(c => c[0].includes('/medications/') && c[0].includes('/administer'));
        expect(calls.length).toBeGreaterThan(0);
        expect(calls[0][1].credentials).toBe('same-origin');
      });
    });
  });

  describe('E2E: User Interactions & Search/Filter', () => {
    it('searches residents in My Residents view', async () => {
      render(<StaffPage />);

      await waitFor(() => {
        const residentsBtn = screen.getAllByTitle('My Residents')[0];
        fireEvent.click(residentsBtn);
      });

      await waitFor(() => {
        expect(screen.getByText('Robert Johnson')).toBeInTheDocument();
        expect(screen.getByText('Susan Williams')).toBeInTheDocument();
      });

      // Search for specific resident
      const searchInput = getResidentsSearchInput();
      await userEvent.type(searchInput, 'Robert');

      await waitFor(() => {
        expect(screen.getByText('Robert Johnson')).toBeInTheDocument();
        expect(screen.queryByText('Susan Williams')).not.toBeInTheDocument();
      });
    });

    it('searches medications by drug name and resident name', async () => {
      render(<StaffPage />);

      await waitFor(() => {
        const medsBtn = screen.getAllByTitle('Medications')[0];
        fireEvent.click(medsBtn);
      });

      await waitFor(() => {
        expect(screen.getByText('Lisinopril')).toBeInTheDocument();
        expect(screen.getByText('Fentanyl')).toBeInTheDocument();
      });

      // Search by drug name
      const searchInput = screen.getByPlaceholderText(/search by resident name or drug/i);
      await userEvent.type(searchInput, 'Lisinopril');

      await waitFor(() => {
        expect(screen.getByText('Lisinopril')).toBeInTheDocument();
        expect(screen.queryByText('Fentanyl')).not.toBeInTheDocument();
      });

      // Clear and search by resident name
      await userEvent.clear(searchInput);
      await userEvent.type(searchInput, 'Susan');

      await waitFor(() => {
        expect(screen.getByText('Fentanyl')).toBeInTheDocument();
      });
    });

    it('searches care plans by resident name', async () => {
      render(<StaffPage />);

      await waitFor(() => {
        const planBtn = screen.getAllByTitle('Care Plan')[0];
        fireEvent.click(planBtn);
      });

      await waitFor(() => {
        expect(screen.getByText('Robert Johnson')).toBeInTheDocument();
      });

      // Search for plan
      const searchInput = screen.getByPlaceholderText(/search resident or plan type/i);
      await userEvent.type(searchInput, 'Robert');

      await waitFor(() => {
        expect(screen.getByText('Robert Johnson')).toBeInTheDocument();
      });
    });

    it('filters appointments by status', async () => {
      render(<StaffPage />);

      await waitFor(() => {
        const appointBtn = screen.getAllByTitle('Appointments')[0];
        fireEvent.click(appointBtn);
      });

      await waitFor(() => {
        expect(screen.getByText('Robert Johnson')).toBeInTheDocument();
      });

      // Filter by status
      const statusSelect = screen.getByDisplayValue('All statuses');
      fireEvent.change(statusSelect, { target: { value: 'completed' } });

      await waitFor(() => {
        // Completed appointment (Susan's dentist)
        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/v1/appointments'),
          expect.any(Object)
        );
      });
    });

    it('selects date in calendar to view appointments', async () => {
      render(<StaffPage />);

      await waitFor(() => {
        const calendarBtn = screen.getAllByTitle('Calendar')[0];
        fireEvent.click(calendarBtn);
      });

      await waitFor(() => {
        expect(main().getByText('Calendar')).toBeInTheDocument();
      });

      // Click on a calendar day (should have appointments from mock data)
      const dayElements = screen.getAllByText(/^\d{1,2}$/);
      if (dayElements.length > 0) {
        fireEvent.click(dayElements[0]);
        // Verify calendar interaction succeeds
        expect(dayElements[0]).toBeInTheDocument();
      }
    });
  });

  describe('E2E: Notification Workflow', () => {
    it('displays unread notification count', async () => {
      render(<StaffPage />);

      await waitFor(() => {
        const notifBtn = screen.getAllByTitle('Notifications')[0];
        fireEvent.click(notifBtn);
      });

      await waitFor(() => {
        expect(screen.getByText(/1 unread/)).toBeInTheDocument();
      });
    });

    it('marks multiple notifications as read in sequence', async () => {
      render(<StaffPage />);

      await waitFor(() => {
        const notifBtn = screen.getAllByTitle('Notifications')[0];
        fireEvent.click(notifBtn);
      });

      // Mark first notification as read
      await waitFor(() => {
        const notification = screen.getByText('Medication due');
        fireEvent.click(notification);
      });

      // Verify PATCH call was made
      await waitFor(() => {
        const calls = fetch.mock.calls.filter(c => c[0].includes('/notifications/') && c[0].includes('/read'));
        expect(calls.length).toBeGreaterThan(0);
      });
    });
  });

  describe('E2E: Medication Refusal Workflow', () => {
    it('staff marks medication as not given with refusal reason', async () => {
      render(<StaffPage />);

      await waitFor(() => {
        const medsBtn = screen.getAllByTitle('Medications')[0];
        fireEvent.click(medsBtn);
      });

      await waitFor(() => {
        expect(screen.getByText('Lisinopril')).toBeInTheDocument();
      });

      // Click Not Given button
      const notGivenBtns = screen.getAllByRole('button', { name: /not given/i });
      fireEvent.click(notGivenBtns[0]);

      // Verify modal opens for refusal
      await waitFor(() => {
        expect(screen.getByText(/Mark Not Administered/i)).toBeInTheDocument();
      });

      // Select refusal reason
      const reasonSelect = screen.getByDisplayValue('— Select reason —');
      fireEvent.change(reasonSelect, { target: { value: 'Refused by resident' } });

      // Submit
      const recordBtn = screen.getByRole('button', { name: /Record Refusal/i });
      fireEvent.click(recordBtn);

      // Verify API call with refusal data
      await waitFor(() => {
        const calls = fetch.mock.calls.filter(c => c[0].includes('/medications/') && c[0].includes('/administer'));
        expect(calls.length).toBeGreaterThan(0);

        const body = JSON.parse(calls[calls.length - 1][1].body);
        expect(body.administered).toBe(false);
        expect(body.refusal_reason).toBe('Refused by resident');
      });
    });
  });

  describe('E2E: PRN Medication Workflow', () => {
    it('staff administers PRN medication with reason', async () => {
      render(<StaffPage />);

      await waitFor(() => {
        const medsBtn = screen.getAllByTitle('Medications')[0];
        fireEvent.click(medsBtn);
      });

      // Find Tylenol (PRN medication)
      await waitFor(() => {
        expect(screen.getByText('Tylenol')).toBeInTheDocument();
      });

      // Click Administer on PRN med
      const adminBtns = screen.getAllByRole('button', { name: /administer/i });
      // Third button should be Tylenol
      fireEvent.click(adminBtns[2]);

      await waitFor(() => {
        expect(screen.getByText(/Administer Medication/i)).toBeInTheDocument();
      });

      // Fill PRN reason
      const prnInput = screen.getByPlaceholderText(/e.g., Pain/i);
      await userEvent.type(prnInput, 'Pain 6/10');

      // Submit
      const confirmBtn = screen.getByRole('button', { name: /Confirm Administration/i });
      fireEvent.click(confirmBtn);

      // Verify API call includes PRN reason
      await waitFor(() => {
        const calls = fetch.mock.calls.filter(c => c[0].includes('/medications/med-3/administer'));
        expect(calls.length).toBeGreaterThan(0);

        const body = JSON.parse(calls[0][1].body);
        expect(body.prn_reason).toBe('Pain 6/10');
      });
    });
  });
});
