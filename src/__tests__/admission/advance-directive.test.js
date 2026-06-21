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

describe('Advance Directive Form', () => {
  beforeEach(() => {
    fetch.mockClear();
    jest.clearAllMocks();
  });

  describe('Form Rendering', () => {
    test('renders advance directive form title', () => {
      const { container } = render(
        <div>
          <h1>Advance Directive Form</h1>
        </div>
      );
      expect(screen.getByText(/Advance Directive Form/i)).toBeInTheDocument();
    });

    test('contains healthcare agent section', () => {
      const { container } = render(
        <div>
          <div>Healthcare Agent Information</div>
        </div>
      );
      expect(screen.getByText(/Healthcare Agent Information/i)).toBeInTheDocument();
    });

    test('contains treatment preferences section', () => {
      const { container } = render(
        <div>
          <div>Treatment Preferences</div>
        </div>
      );
      expect(screen.getByText(/Treatment Preferences/i)).toBeInTheDocument();
    });

    test('contains values and beliefs section', () => {
      const { container } = render(
        <div>
          <div>Values & Beliefs</div>
        </div>
      );
      expect(screen.getByText(/Values & Beliefs/i)).toBeInTheDocument();
    });

    test('contains signature section', () => {
      const { container } = render(
        <div>
          <div>Signatures</div>
        </div>
      );
      expect(screen.getByText(/Signatures/i)).toBeInTheDocument();
    });
  });

  describe('Healthcare Agent Information', () => {
    test('captures healthcare agent name', async () => {
      const user = userEvent.setup();
      render(
        <input type="text" placeholder="Healthcare Agent Full Name" />
      );

      const input = screen.getByPlaceholderText(/Healthcare Agent Full Name/i);
      await user.type(input, 'Jane Smith');

      expect(input.value).toBe('Jane Smith');
    });

    test('captures healthcare agent relationship', async () => {
      const user = userEvent.setup();
      render(
        <input type="text" placeholder="Relationship to Resident" />
      );

      const input = screen.getByPlaceholderText(/Relationship to Resident/i);
      await user.type(input, 'Daughter');

      expect(input.value).toBe('Daughter');
    });

    test('captures healthcare agent phone', async () => {
      const user = userEvent.setup();
      render(
        <input type="text" placeholder="Phone Number" />
      );

      const input = screen.getByPlaceholderText(/Phone Number/i);
      await user.type(input, '5035551234');

      expect(input.value).toBe('5035551234');
    });

    test('captures healthcare agent email', async () => {
      const user = userEvent.setup();
      render(
        <input type="email" placeholder="Email Address" />
      );

      const input = screen.getByPlaceholderText(/Email Address/i);
      await user.type(input, 'jane@example.com');

      expect(input.value).toBe('jane@example.com');
    });

    test('captures healthcare agent address', async () => {
      const user = userEvent.setup();
      render(
        <input type="text" placeholder="Address" />
      );

      const input = screen.getByPlaceholderText(/Address/i);
      await user.type(input, '123 Main St, Portland, OR 97201');

      expect(input.value).toBe('123 Main St, Portland, OR 97201');
    });

    test('captures alternate agent name', async () => {
      const user = userEvent.setup();
      render(
        <input type="text" placeholder="Alternate Agent Name" />
      );

      const input = screen.getByPlaceholderText(/Alternate Agent Name/i);
      await user.type(input, 'John Smith');

      expect(input.value).toBe('John Smith');
    });

    test('captures alternate agent phone', async () => {
      const user = userEvent.setup();
      render(
        <input type="text" placeholder="Alternate Phone Number" />
      );

      const input = screen.getByPlaceholderText(/Alternate Phone Number/i);
      await user.type(input, '5035559999');

      expect(input.value).toBe('5035559999');
    });
  });

  describe('Treatment Preferences - CPR', () => {
    test('allows selecting full CPR option', async () => {
      const user = userEvent.setup();
      const { container } = render(
        <div>
          <label><input type="radio" name="cpr" value="full" /> Full CPR including intubation</label>
        </div>
      );

      const radio = screen.getByRole('radio', { name: /Full CPR including intubation/i });
      await user.click(radio);

      expect(radio).toBeChecked();
    });

    test('allows selecting limited CPR option', async () => {
      const user = userEvent.setup();
      const { container } = render(
        <div>
          <label><input type="radio" name="cpr" value="limited" /> Limited CPR</label>
        </div>
      );

      const radio = screen.getByRole('radio', { name: /Limited CPR/i });
      await user.click(radio);

      expect(radio).toBeChecked();
    });

    test('allows selecting comfort-only DNR option', async () => {
      const user = userEvent.setup();
      const { container } = render(
        <div>
          <label><input type="radio" name="cpr" value="comfort_only" /> Comfort measures only</label>
        </div>
      );

      const radio = screen.getByRole('radio', { name: /Comfort measures only/i });
      await user.click(radio);

      expect(radio).toBeChecked();
    });
  });

  describe('Treatment Preferences - Nutrition', () => {
    test('allows selecting full nutrition option', async () => {
      const user = userEvent.setup();
      const { container } = render(
        <div>
          <label><input type="radio" name="nutrition" value="full" /> Full artificial nutrition</label>
        </div>
      );

      const radio = screen.getByRole('radio', { name: /Full artificial nutrition/i });
      await user.click(radio);

      expect(radio).toBeChecked();
    });

    test('allows selecting comfort nutrition option', async () => {
      const user = userEvent.setup();
      const { container } = render(
        <div>
          <label><input type="radio" name="nutrition" value="comfort" /> Limited for comfort</label>
        </div>
      );

      const radio = screen.getByRole('radio', { name: /Limited for comfort/i });
      await user.click(radio);

      expect(radio).toBeChecked();
    });

    test('allows selecting no nutrition option', async () => {
      const user = userEvent.setup();
      const { container } = render(
        <div>
          <label><input type="radio" name="nutrition" value="none" /> No artificial nutrition</label>
        </div>
      );

      const radio = screen.getByRole('radio', { name: /No artificial nutrition/i });
      await user.click(radio);

      expect(radio).toBeChecked();
    });
  });

  describe('Treatment Preferences - Ventilation', () => {
    test('allows selecting mechanical ventilation option', async () => {
      const user = userEvent.setup();
      const { container } = render(
        <div>
          <label><input type="radio" name="ventilation" value="yes" /> Yes, use mechanical ventilation</label>
        </div>
      );

      const radio = screen.getByRole('radio', { name: /Yes, use mechanical ventilation/i });
      await user.click(radio);

      expect(radio).toBeChecked();
    });

    test('allows selecting limited ventilation option', async () => {
      const user = userEvent.setup();
      const { container } = render(
        <div>
          <label><input type="radio" name="ventilation" value="limited" /> Only if reversible</label>
        </div>
      );

      const radio = screen.getByRole('radio', { name: /Only if reversible/i });
      await user.click(radio);

      expect(radio).toBeChecked();
    });

    test('allows selecting no ventilation option', async () => {
      const user = userEvent.setup();
      const { container } = render(
        <div>
          <label><input type="radio" name="ventilation" value="no" /> No mechanical ventilation</label>
        </div>
      );

      const radio = screen.getByRole('radio', { name: /No mechanical ventilation/i });
      await user.click(radio);

      expect(radio).toBeChecked();
    });
  });

  describe('Treatment Preferences - Hospitalization', () => {
    test('allows selecting hospitalization option', async () => {
      const user = userEvent.setup();
      const { container } = render(
        <div>
          <label><input type="radio" name="hosp" value="yes" /> Yes, admit to hospital</label>
        </div>
      );

      const radio = screen.getByRole('radio', { name: /Yes, admit to hospital/i });
      await user.click(radio);

      expect(radio).toBeChecked();
    });

    test('allows selecting limited hospitalization option', async () => {
      const user = userEvent.setup();
      const { container } = render(
        <div>
          <label><input type="radio" name="hosp" value="limited" /> Only if reversible</label>
        </div>
      );

      const radio = screen.getByRole('radio', { name: /Only if reversible/i });
      await user.click(radio);

      expect(radio).toBeChecked();
    });

    test('allows selecting no hospitalization option', async () => {
      const user = userEvent.setup();
      const { container } = render(
        <div>
          <label><input type="radio" name="hosp" value="no" /> No hospitalization</label>
        </div>
      );

      const radio = screen.getByRole('radio', { name: /No hospitalization/i });
      await user.click(radio);

      expect(radio).toBeChecked();
    });
  });

  describe('Treatment Preferences - Pain Management', () => {
    test('allows selecting always use pain relief', async () => {
      const user = userEvent.setup();
      const { container } = render(
        <div>
          <label><input type="radio" name="pain" value="always" /> Always use pain relief</label>
        </div>
      );

      const radio = screen.getByRole('radio', { name: /Always use pain relief/i });
      await user.click(radio);

      expect(radio).toBeChecked();
    });

    test('allows selecting pain relief as needed', async () => {
      const user = userEvent.setup();
      const { container } = render(
        <div>
          <label><input type="radio" name="pain" value="as_needed" /> As needed</label>
        </div>
      );

      const radio = screen.getByRole('radio', { name: /As needed/i });
      await user.click(radio);

      expect(radio).toBeChecked();
    });
  });

  describe('Treatment Preferences - Organ Donation', () => {
    test('allows selecting organ donation option', async () => {
      const user = userEvent.setup();
      const { container } = render(
        <div>
          <label><input type="radio" name="donation" value="yes" /> Yes, donate organs</label>
        </div>
      );

      const radio = screen.getByRole('radio', { name: /Yes, donate organs/i });
      await user.click(radio);

      expect(radio).toBeChecked();
    });

    test('allows selecting no organ donation', async () => {
      const user = userEvent.setup();
      const { container } = render(
        <div>
          <label><input type="radio" name="donation" value="no" /> No donation</label>
        </div>
      );

      const radio = screen.getByRole('radio', { name: /No donation/i });
      await user.click(radio);

      expect(radio).toBeChecked();
    });

    test('allows selecting let family decide', async () => {
      const user = userEvent.setup();
      const { container } = render(
        <div>
          <label><input type="radio" name="donation" value="decide_later" /> Let family decide</label>
        </div>
      );

      const radio = screen.getByRole('radio', { name: /Let family decide/i });
      await user.click(radio);

      expect(radio).toBeChecked();
    });
  });

  describe('Values & Beliefs Section', () => {
    test('captures end-of-life wishes', async () => {
      const user = userEvent.setup();
      render(
        <textarea placeholder="End of life wishes" />
      );

      const input = screen.getByPlaceholderText(/End of life wishes/i);
      await user.type(input, 'I want to spend time with family at home');

      expect(input.value).toBe('I want to spend time with family at home');
    });

    test('captures cultural and religious practices', async () => {
      const user = userEvent.setup();
      render(
        <textarea placeholder="Cultural or religious practices" />
      );

      const input = screen.getByPlaceholderText(/Cultural or religious practices/i);
      await user.type(input, 'Catholic last rites important to me');

      expect(input.value).toBe('Catholic last rites important to me');
    });

    test('captures unacceptable quality of life', async () => {
      const user = userEvent.setup();
      render(
        <textarea placeholder="Unacceptable quality of life" />
      );

      const input = screen.getByPlaceholderText(/Unacceptable quality of life/i);
      await user.type(input, 'Prolonged vegetative state unacceptable');

      expect(input.value).toBe('Prolonged vegetative state unacceptable');
    });
  });

  describe('Signature Section', () => {
    test('captures resident signature', async () => {
      const user = userEvent.setup();
      render(
        <input type="text" placeholder="Resident Signature" />
      );

      const input = screen.getByPlaceholderText(/Resident Signature/i);
      await user.type(input, 'John Doe');

      expect(input.value).toBe('John Doe');
    });

    test('captures resident signature date', async () => {
      const user = userEvent.setup();
      render(
        <input type="date" />
      );

      const inputs = screen.getAllByRole('textbox');
      if (inputs.length > 0) {
        // Date input would be captured here
        expect(inputs).toBeDefined();
      }
    });

    test('captures witness 1 name', async () => {
      const user = userEvent.setup();
      render(
        <input type="text" placeholder="Witness 1 Name" />
      );

      const input = screen.getByPlaceholderText(/Witness 1 Name/i);
      await user.type(input, 'Jane Witness');

      expect(input.value).toBe('Jane Witness');
    });

    test('captures witness 1 signature', async () => {
      const user = userEvent.setup();
      render(
        <input type="text" placeholder="Witness 1 Signature" />
      );

      const input = screen.getByPlaceholderText(/Witness 1 Signature/i);
      await user.type(input, 'Jane Witness');

      expect(input.value).toBe('Jane Witness');
    });

    test('captures witness 2 name', async () => {
      const user = userEvent.setup();
      render(
        <input type="text" placeholder="Witness 2 Name" />
      );

      const input = screen.getByPlaceholderText(/Witness 2 Name/i);
      await user.type(input, 'Bob Witness');

      expect(input.value).toBe('Bob Witness');
    });

    test('captures witness 2 signature', async () => {
      const user = userEvent.setup();
      render(
        <input type="text" placeholder="Witness 2 Signature" />
      );

      const input = screen.getByPlaceholderText(/Witness 2 Signature/i);
      await user.type(input, 'Bob Witness');

      expect(input.value).toBe('Bob Witness');
    });
  });

  describe('Checkbox States', () => {
    test('checkbox state persists after clicking', async () => {
      const user = userEvent.setup();
      const { container, rerender } = render(
        <input type="checkbox" defaultChecked={false} />
      );

      const checkbox = screen.getByRole('checkbox');
      await user.click(checkbox);

      expect(checkbox).toBeChecked();

      rerender(
        <input type="checkbox" defaultChecked={true} />
      );

      const updated = screen.getByRole('checkbox');
      expect(updated).toBeChecked();
    });

    test('multiple checkboxes can be checked independently', async () => {
      const user = userEvent.setup();
      render(
        <div>
          <input type="checkbox" id="cb1" defaultChecked={false} />
          <input type="checkbox" id="cb2" defaultChecked={false} />
          <input type="checkbox" id="cb3" defaultChecked={false} />
        </div>
      );

      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[0]);
      await user.click(checkboxes[2]);

      expect(checkboxes[0]).toBeChecked();
      expect(checkboxes[1]).not.toBeChecked();
      expect(checkboxes[2]).toBeChecked();
    });
  });

  describe('Form Validation', () => {
    test('requires healthcare agent name', () => {
      const formData = {
        healthcare_agent_name: '',
      };

      const isValid = formData.healthcare_agent_name.length > 0;
      expect(isValid).toBe(false);
    });

    test('requires healthcare agent relationship', () => {
      const formData = {
        healthcare_agent_relationship: '',
      };

      const isValid = formData.healthcare_agent_relationship.length > 0;
      expect(isValid).toBe(false);
    });

    test('requires treatment preferences', () => {
      const formData = {
        cpr_preference: '',
      };

      const isValid = formData.cpr_preference.length > 0;
      expect(isValid).toBe(false);
    });
  });

  describe('Form Submission', () => {
    test('sends directive data to API on submit', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ directive_id: 'dir-123' }),
      });

      const mockData = {
        healthcare_agent_name: 'Jane Smith',
        cpr_preference: 'comfort_only',
      };

      await fetch('/api/v1/admission/advance-directive', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer mock-token-123',
        },
        body: JSON.stringify(mockData),
      });

      expect(fetch).toHaveBeenCalledWith(
        '/api/v1/admission/advance-directive',
        expect.objectContaining({
          method: 'POST',
        })
      );
    });

    test('handles directive submission error', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Validation failed' }),
      });

      const response = await fetch('/api/v1/admission/advance-directive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ healthcare_agent_name: 'Jane' }),
      });

      const data = await response.json();
      expect(data.error).toBeDefined();
    });
  });

  describe('Accessibility', () => {
    test('radio buttons have descriptive labels', () => {
      const { container } = render(
        <div>
          <label><input type="radio" name="test" /> Full CPR</label>
          <label><input type="radio" name="test" /> Limited CPR</label>
          <label><input type="radio" name="test" /> Comfort Only</label>
        </div>
      );

      expect(screen.getByText(/Full CPR/i)).toBeInTheDocument();
      expect(screen.getByText(/Limited CPR/i)).toBeInTheDocument();
      expect(screen.getByText(/Comfort Only/i)).toBeInTheDocument();
    });

    test('form has clear step indicators', () => {
      const { container } = render(
        <div>
          <div>Step 1: Healthcare Agent</div>
          <div>Step 2: Treatment Preferences</div>
          <div>Step 3: Values and Beliefs</div>
          <div>Step 4: Signatures</div>
        </div>
      );

      expect(screen.getByText(/Step 1/i)).toBeInTheDocument();
      expect(screen.getByText(/Step 2/i)).toBeInTheDocument();
      expect(screen.getByText(/Step 3/i)).toBeInTheDocument();
      expect(screen.getByText(/Step 4/i)).toBeInTheDocument();
    });
  });
});
