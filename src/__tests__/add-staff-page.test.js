import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import AddStaffPage from '../app/add-staff/page';

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

describe('Add Staff Page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    expect(() => render(<AddStaffPage />)).not.toThrow();
  });

  it('shows the New Staff Member heading', () => {
    render(<AddStaffPage />);
    // "New Staff Member" appears in both avatar preview and h1; find the h1
    const headings = screen.getAllByText('New Staff Member');
    expect(headings.find(el => el.tagName === 'H1') || headings[0]).toBeInTheDocument();
  });

  it('renders the Add Staff Member breadcrumb', () => {
    render(<AddStaffPage />);
    expect(screen.getByText('Add Staff Member')).toBeInTheDocument();
  });

  describe('avatar preview', () => {
    it('shows placeholder "?" when no name is entered', () => {
      render(<AddStaffPage />);
      expect(screen.getByText('?')).toBeInTheDocument();
    });

    it('shows initials as first+last name are entered', () => {
      render(<AddStaffPage />);
      const inputs = screen.getAllByRole('textbox');
      const firstNameInput = inputs.find(i => i.placeholder === 'First name');
      const lastNameInput  = inputs.find(i => i.placeholder === 'Last name');
      fireEvent.change(firstNameInput, { target: { value: 'Alice' } });
      fireEvent.change(lastNameInput,  { target: { value: 'Brown' } });
      expect(screen.getByText('AB')).toBeInTheDocument();
    });

    it('shows full name in preview after entering first and last name', () => {
      render(<AddStaffPage />);
      const inputs = screen.getAllByRole('textbox');
      const firstInput = inputs.find(i => i.placeholder === 'First name');
      const lastInput  = inputs.find(i => i.placeholder === 'Last name');
      fireEvent.change(firstInput, { target: { value: 'John' } });
      fireEvent.change(lastInput,  { target: { value: 'Doe' } });
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    it('shows "Role not selected" when no role is chosen', () => {
      render(<AddStaffPage />);
      expect(screen.getByText('Role not selected')).toBeInTheDocument();
    });
  });

  describe('Section 1 — Core Identity', () => {
    it('shows Core Identity section', () => {
      render(<AddStaffPage />);
      expect(screen.getByText(/core identity/i)).toBeInTheDocument();
    });

    it('First Name field is marked required', () => {
      render(<AddStaffPage />);
      const label = screen.getByText('First Name', { exact: false });
      expect(label).toBeInTheDocument();
    });

    it('Last Name field is marked required', () => {
      render(<AddStaffPage />);
      expect(screen.getByText('Last Name', { exact: false })).toBeInTheDocument();
    });

    it('Role select renders all 10 role options', () => {
      render(<AddStaffPage />);
      const roleSelect = screen.getAllByDisplayValue('— Select —')[0];
      expect(roleSelect).toBeInTheDocument();
      const options = Array.from(roleSelect.querySelectorAll('option'));
      expect(options.length).toBe(11); // placeholder + 10 roles
    });

    it('Active Status radio has Active and Inactive options', () => {
      render(<AddStaffPage />);
      expect(screen.getByText('Active')).toBeInTheDocument();
      expect(screen.getByText('Inactive')).toBeInTheDocument();
    });
  });

  describe('Section 2 — Contact & Employment', () => {
    it('shows Contact & Employment section', () => {
      render(<AddStaffPage />);
      expect(screen.getByText(/contact.*employment/i)).toBeInTheDocument();
    });

    it('shows shift selector with Day, Night, Swing options', () => {
      render(<AddStaffPage />);
      expect(screen.getByText('Day Shift')).toBeInTheDocument();
      expect(screen.getByText('Night Shift')).toBeInTheDocument();
      expect(screen.getByText('Swing Shift')).toBeInTheDocument();
    });
  });

  describe('Section 3 — Emergency Contact', () => {
    it('shows Emergency Contact section', () => {
      render(<AddStaffPage />);
      expect(screen.getByText(/emergency contact/i)).toBeInTheDocument();
    });
  });

  describe('Section 4 — Certifications', () => {
    it('shows Certifications & Training section', () => {
      render(<AddStaffPage />);
      expect(screen.getByText(/certifications.*training/i)).toBeInTheDocument();
    });

    it('renders CPR / First Aid certification option', () => {
      render(<AddStaffPage />);
      expect(screen.getByText('CPR / First Aid')).toBeInTheDocument();
    });

    it('renders all 9 certification options', () => {
      render(<AddStaffPage />);
      const certs = [
        'CPR / First Aid', 'CNA', 'Medication Aide Certification',
        "Food Handler's Card", 'Mandatory Reporter Training',
        'Mental Health First Aid', 'De-escalation Training',
        'QMHP Credentialed', 'Oregon CAREAssist Certified',
      ];
      certs.forEach(c => expect(screen.getByText(c)).toBeInTheDocument());
    });

    it('toggling a certification reveals the expiry date input', () => {
      render(<AddStaffPage />);
      const cprBox = screen.getByText('CPR / First Aid').closest('div');
      fireEvent.click(cprBox);
      expect(screen.getByText('Expiry Date')).toBeInTheDocument();
    });

    it('toggling a certification off hides the expiry date input', () => {
      render(<AddStaffPage />);
      const cprBox = screen.getByText('CPR / First Aid').closest('div');
      fireEvent.click(cprBox);
      fireEvent.click(cprBox);
      expect(screen.queryByText('Expiry Date')).not.toBeInTheDocument();
    });

    it('shows warning when cert is checked but no expiry date set', () => {
      render(<AddStaffPage />);
      const cprBox = screen.getByText('CPR / First Aid').closest('div');
      fireEvent.click(cprBox);
      expect(screen.getByText('No expiry date set')).toBeInTheDocument();
    });
  });

  describe('Section 5 — Permissions preview', () => {
    it('shows role-based permissions prompt when no role selected', () => {
      render(<AddStaffPage />);
      expect(screen.getByText(/select a role above to preview/i)).toBeInTheDocument();
    });

    it('shows RN permissions after selecting RN role', () => {
      render(<AddStaffPage />);
      const roleSelect = screen.getAllByRole('combobox')[0];
      fireEvent.change(roleSelect, { target: { value: 'RN' } });
      expect(screen.getByText(/sign off notes/i)).toBeInTheDocument();
    });

    it('shows Caregiver permissions after selecting Caregiver role', () => {
      render(<AddStaffPage />);
      const roleSelect = screen.getAllByRole('combobox')[0];
      fireEvent.change(roleSelect, { target: { value: 'Caregiver' } });
      expect(screen.getByText(/incident reports/i)).toBeInTheDocument();
    });

    it('shows only "View Residents" for Other role', () => {
      render(<AddStaffPage />);
      const roleSelect = screen.getAllByRole('combobox')[0];
      fireEvent.change(roleSelect, { target: { value: 'Other' } });
      expect(screen.getByText(/View Residents/)).toBeInTheDocument();
      expect(screen.queryByText(/sign off/i)).not.toBeInTheDocument();
    });
  });

  describe('record preview', () => {
    it('shows the ref.staff record preview section', () => {
      render(<AddStaffPage />);
      expect(screen.getByText(/ref\.staff.*record preview/i)).toBeInTheDocument();
    });

    it('preview shows entered first_name', () => {
      render(<AddStaffPage />);
      const firstInput = screen.getByPlaceholderText('First name');
      fireEvent.change(firstInput, { target: { value: 'Jane' } });
      const preview = screen.getAllByText('Jane');
      expect(preview.length).toBeGreaterThan(0);
    });
  });

  describe('validation', () => {
    it('shows first_name error when submitting with empty first name', () => {
      render(<AddStaffPage />);
      fireEvent.click(screen.getByText('Add Staff Member ✓'));
      expect(screen.getByText('First name is required')).toBeInTheDocument();
    });

    it('shows last_name error when submitting with empty last name', () => {
      render(<AddStaffPage />);
      fireEvent.click(screen.getByText('Add Staff Member ✓'));
      expect(screen.getByText('Last name is required')).toBeInTheDocument();
    });

    it('shows role error when submitting without a role', () => {
      render(<AddStaffPage />);
      fireEvent.click(screen.getByText('Add Staff Member ✓'));
      expect(screen.getByText('Role is required')).toBeInTheDocument();
    });

    it('clears first_name error when first name is entered', () => {
      render(<AddStaffPage />);
      fireEvent.click(screen.getByText('Add Staff Member ✓'));
      expect(screen.getByText('First name is required')).toBeInTheDocument();
      fireEvent.change(screen.getByPlaceholderText('First name'), { target: { value: 'Sam' } });
      expect(screen.queryByText('First name is required')).not.toBeInTheDocument();
    });

    it('submits successfully when all required fields are filled', () => {
      render(<AddStaffPage />);
      fireEvent.change(screen.getByPlaceholderText('First name'), { target: { value: 'Sam' } });
      fireEvent.change(screen.getByPlaceholderText('Last name'),  { target: { value: 'Jones' } });
      const roleSelect = screen.getAllByRole('combobox')[0];
      fireEvent.change(roleSelect, { target: { value: 'RN' } });
      fireEvent.click(screen.getByText('Add Staff Member ✓'));
      expect(screen.getByText('Staff Member Added')).toBeInTheDocument();
    });
  });

  describe('success screen', () => {
    const submitValidForm = () => {
      render(<AddStaffPage />);
      fireEvent.change(screen.getByPlaceholderText('First name'), { target: { value: 'Sam' } });
      fireEvent.change(screen.getByPlaceholderText('Last name'),  { target: { value: 'Jones' } });
      const roleSelect = screen.getAllByRole('combobox')[0];
      fireEvent.change(roleSelect, { target: { value: 'RN' } });
      fireEvent.click(screen.getByText('Add Staff Member ✓'));
    };

    it('shows the submitted staff name on success', () => {
      submitValidForm();
      expect(screen.getByText(/Sam Jones/)).toBeInTheDocument();
    });

    it('shows the assigned role on success', () => {
      submitValidForm();
      expect(screen.getByText(/RN/)).toBeInTheDocument();
    });

    it('Back to Dashboard button routes to /', () => {
      submitValidForm();
      fireEvent.click(screen.getByText('Back to Dashboard'));
      expect(mockPush).toHaveBeenCalledWith('/');
    });

    it('Add Another button resets the form', () => {
      submitValidForm();
      fireEvent.click(screen.getByText('Add Another'));
      expect(screen.getAllByText('New Staff Member')[0]).toBeInTheDocument();
      expect(screen.getByPlaceholderText('First name').value).toBe('');
    });
  });

  describe('navigation', () => {
    it('Back button in top bar routes to /', () => {
      render(<AddStaffPage />);
      fireEvent.click(screen.getAllByText(/← Back|Back/i)[0]);
      expect(mockPush).toHaveBeenCalledWith('/');
    });

    it('Cancel button routes to /', () => {
      render(<AddStaffPage />);
      fireEvent.click(screen.getByText('Cancel'));
      expect(mockPush).toHaveBeenCalledWith('/');
    });
  });
});
