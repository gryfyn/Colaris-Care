import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RecordFormModal from '@/components/records/RecordFormModal';

const fields = [
  { name: 'name', label: 'Name', required: true },
  { name: 'status', label: 'Status', type: 'select', options: ['Active', 'Pending'], default: 'Pending' },
  { name: 'notes', label: 'Notes', type: 'textarea', span2: true },
];

function setup(overrides = {}) {
  const props = { title: 'Add record', eyebrow: 'Records', fields, onClose: jest.fn(), onSubmit: jest.fn().mockResolvedValue(undefined), ...overrides };
  const result = render(<RecordFormModal {...props} />);
  return { ...result, props };
}

describe('RecordFormModal', () => {
  test('renders configured field types and defaults', () => {
    setup();
    expect(screen.getByRole('dialog', { name: 'Add record' })).toBeInTheDocument();
    expect(screen.getByLabelText(/Name/)).toHaveValue('');
    expect(screen.getByLabelText('Status')).toHaveValue('Pending');
    expect(screen.getByLabelText('Notes').tagName).toBe('TEXTAREA');
  });

  test('rejects missing required fields without submitting', async () => {
    const { props } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByText('Name is required')).toBeInTheDocument();
    expect(props.onSubmit).not.toHaveBeenCalled();
  });

  test('submits the complete values object', async () => {
    const { props } = setup({ submitLabel: 'Create' });
    await userEvent.type(screen.getByLabelText(/Name/), 'Alice');
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'Active');
    await userEvent.type(screen.getByLabelText('Notes'), 'Stable');
    await userEvent.click(screen.getByRole('button', { name: 'Create' }));
    await waitFor(() => expect(props.onSubmit).toHaveBeenCalledWith({ name: 'Alice', status: 'Active', notes: 'Stable' }));
  });

  test('shows a rejected submit error and re-enables actions', async () => {
    const onSubmit = jest.fn().mockRejectedValue(new Error('Server unavailable'));
    setup({ onSubmit });
    await userEvent.type(screen.getByLabelText(/Name/), 'Alice');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Server unavailable')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  });

  test('close and cancel call onClose', async () => {
    const { props } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(props.onClose).toHaveBeenCalledTimes(2);
  });

  test('backdrop closes only when the backdrop itself is clicked', () => {
    const { props, container } = setup();
    fireEvent.click(screen.getByRole('dialog'));
    expect(props.onClose).not.toHaveBeenCalled();
    fireEvent.click(container.querySelector('.cx-ob-backdrop'));
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });
});
