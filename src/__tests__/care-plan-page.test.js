import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import CarePlanPage from '../app/care-plan/page';

const mockPush = jest.fn();
const mockBack = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack }),
}));

describe('Care Plan Page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    expect(() => render(<CarePlanPage />)).not.toThrow();
  });

  it('renders the Care Plan heading', () => {
    render(<CarePlanPage />);
    expect(screen.getAllByText(/care plan/i)[0]).toBeInTheDocument();
  });

  it('renders a Back to Dashboard button', () => {
    render(<CarePlanPage />);
    // Sidebar has "← Back to Dashboard"; step nav has "← Previous"
    expect(screen.getAllByText(/back|← /i)[0]).toBeInTheDocument();
  });

  it('back button navigates to the main dashboard', () => {
    render(<CarePlanPage />);
    // Click the sidebar "← Back to Dashboard" button (first back-type element)
    const backBtn = screen.getAllByText(/back|← /i)[0];
    fireEvent.click(backBtn);
    expect(mockPush).toHaveBeenCalledWith('/');
  });

  it('renders form sections for goal entry', () => {
    render(<CarePlanPage />);
    expect(screen.getByText(/goal|domain|objective/i)).toBeInTheDocument();
  });

  it('renders Patient Selection field', () => {
    render(<CarePlanPage />);
    // Step 1 shows "Patient Selection" as the section heading
    expect(screen.getByText('Patient Selection')).toBeInTheDocument();
  });

  it('form accepts text input', () => {
    render(<CarePlanPage />);
    const inputs = screen.getAllByRole('textbox');
    expect(inputs.length).toBeGreaterThan(0);
    fireEvent.change(inputs[0], { target: { value: 'Test value' } });
    expect(inputs[0].value).toBe('Test value');
  });
});
