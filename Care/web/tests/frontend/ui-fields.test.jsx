import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Field, SegmentedField, SelectField, TextAreaField, TextField } from '@/components/ui/fields';

describe('form field primitives', () => {
  test('Field associates its label with a render-prop control', () => {
    render(<Field label="Legal name" required hint="As shown on ID">{(id) => <input id={id} />}</Field>);
    expect(screen.getByLabelText(/Legal name/)).toBeInTheDocument();
    expect(screen.getByText('As shown on ID')).toBeInTheDocument();
    expect(screen.getByText('*')).toHaveAttribute('aria-hidden', 'true');
  });

  test('an error replaces the hint and exposes an alert', () => {
    render(<Field label="Email" hint="Work email" error="Email is invalid"><input /></Field>);
    expect(screen.queryByText('Work email')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Email is invalid');
    expect(screen.getByRole('alert').parentElement).toHaveAttribute('data-error', 'true');
  });

  test('TextField emits the new string and forwards input attributes', async () => {
    const onChange = jest.fn();
    render(<TextField label="Room" value="" onChange={onChange} type="number" min="1" />);
    const input = screen.getByLabelText('Room');
    await userEvent.type(input, '4');
    expect(onChange).toHaveBeenCalledWith('4');
    expect(input).toHaveAttribute('type', 'number');
    expect(input).toHaveAttribute('min', '1');
  });

  test('TextField marks invalid controls for assistive technology', () => {
    render(<TextField label="Room" value="" onChange={() => {}} error="Required" />);
    expect(screen.getByLabelText('Room')).toHaveAttribute('aria-invalid', 'true');
  });

  test('SelectField supports string and object options', async () => {
    const onChange = jest.fn();
    render(<SelectField label="Status" value="" onChange={onChange} options={['Active', { value: 'hold', label: 'On hold' }]} />);
    const select = screen.getByLabelText('Status');
    expect(screen.getByRole('option', { name: /Select/ })).toBeDisabled();
    await userEvent.selectOptions(select, 'hold');
    expect(onChange).toHaveBeenCalledWith('hold');
  });

  test('TextAreaField uses the requested size and emits text', async () => {
    const onChange = jest.fn();
    render(<TextAreaField label="Notes" value="" onChange={onChange} rows={6} />);
    const textarea = screen.getByLabelText('Notes');
    await userEvent.type(textarea, 'A');
    expect(textarea).toHaveAttribute('rows', '6');
    expect(onChange).toHaveBeenCalledWith('A');
  });

  test('SegmentedField toggles selected options and exposes pressed state', async () => {
    const onChange = jest.fn();
    const { rerender } = render(<SegmentedField label="Risk" value="" onChange={onChange} options={[{ value: 'high', label: 'High', tone: 'danger' }, 'Low']} />);
    const high = screen.getByRole('button', { name: 'High' });
    expect(high).toHaveAttribute('aria-pressed', 'false');
    expect(high).toHaveClass('cx-seg-danger');
    await userEvent.click(high);
    expect(onChange).toHaveBeenLastCalledWith('high');
    rerender(<SegmentedField label="Risk" value="high" onChange={onChange} options={[{ value: 'high', label: 'High', tone: 'danger' }, 'Low']} />);
    await userEvent.click(screen.getByRole('button', { name: 'High' }));
    expect(onChange).toHaveBeenLastCalledWith('');
  });
});
