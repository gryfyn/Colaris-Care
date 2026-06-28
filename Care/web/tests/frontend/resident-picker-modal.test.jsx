import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ResidentPickerModal from '@/components/residents/ResidentPickerModal';
import { apiData } from '@/lib/client-api';

jest.mock('@/lib/client-api', () => ({ apiData: jest.fn() }));

const residents = [
  { id: 'r1', name: 'Alice Jones', room: '101', careLevel: 'Assisted' },
  { id: 'r2', firstName: 'Bob', lastName: 'Smith', room: '202', careLevel: 'Memory' },
];

function setup(overrides = {}) {
  const props = { onClose: jest.fn(), onSelect: jest.fn(), ...overrides };
  const result = render(<ResidentPickerModal {...props} />);
  return { ...result, props };
}

describe('ResidentPickerModal', () => {
  test('loads and renders residents from the API', async () => {
    apiData.mockResolvedValue(residents);
    setup();
    expect(screen.getByText('Loading residents')).toBeInTheDocument();
    expect(await screen.findByText('Alice Jones')).toBeInTheDocument();
    expect(screen.getByText('Bob Smith')).toBeInTheDocument();
    expect(apiData).toHaveBeenCalledWith('/api/v1/residents');
  });

  test('selects the complete resident object', async () => {
    apiData.mockResolvedValue(residents);
    const { props } = setup();
    await userEvent.click(await screen.findByRole('button', { name: /Alice Jones/ }));
    expect(props.onSelect).toHaveBeenCalledWith(residents[0]);
  });

  test.each([
    ['alice', 'Alice Jones'],
    ['202', 'Bob Smith'],
    ['memory', 'Bob Smith'],
  ])('filters by %s', async (term, visibleName) => {
    apiData.mockResolvedValue(residents);
    setup();
    await screen.findByText('Alice Jones');
    await userEvent.type(screen.getByLabelText('Search residents'), term);
    expect(screen.getByText(visibleName)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Room/ })).toHaveLength(1);
  });

  test('shows an empty result message for unmatched searches', async () => {
    apiData.mockResolvedValue(residents);
    setup();
    await screen.findByText('Alice Jones');
    await userEvent.type(screen.getByLabelText('Search residents'), 'nobody');
    expect(screen.getByText('No residents found')).toBeInTheDocument();
    expect(screen.getByText('Try a different search.')).toBeInTheDocument();
  });

  test('handles non-array and failed responses', async () => {
    apiData.mockResolvedValueOnce({ data: residents });
    const first = setup();
    expect(await screen.findByText('No residents found')).toBeInTheDocument();
    first.unmount();
    apiData.mockRejectedValueOnce(new Error('Network down'));
    setup();
    expect(await screen.findByText('Could not load residents')).toBeInTheDocument();
    expect(screen.getByText('Network down')).toBeInTheDocument();
  });

  test('busy mode disables selection and closing', async () => {
    apiData.mockResolvedValue(residents);
    const { props, container } = setup({ busy: true });
    const resident = await screen.findByRole('button', { name: /Alice Jones/ });
    expect(resident).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Close' })).toBeDisabled();
    fireEvent.click(container.querySelector('.cx-ob-backdrop'));
    expect(props.onClose).not.toHaveBeenCalled();
  });

  test('does not update state after unmounting an in-flight request', async () => {
    let resolve;
    apiData.mockReturnValue(new Promise((done) => { resolve = done; }));
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { unmount } = setup();
    unmount();
    resolve(residents);
    await waitFor(() => expect(consoleError).not.toHaveBeenCalled());
    consoleError.mockRestore();
  });
});
