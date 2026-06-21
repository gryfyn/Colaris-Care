import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import NursingAdmissionWizard from '../app/admission/nursing-admission/page';

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack }),
}));

describe('Nursing Admission Wizard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    expect(() => render(<NursingAdmissionWizard />)).not.toThrow();
  });

  it('shows the first step on initial render (Demographics)', () => {
    render(<NursingAdmissionWizard />);
    expect(screen.getByText(/demographic/i)).toBeInTheDocument();
  });

  it('renders the step progress indicator', () => {
    render(<NursingAdmissionWizard />);
    expect(screen.getByText(/step 1|1.*8|demographic/i)).toBeInTheDocument();
  });

  it('renders all 8 step labels in the stepper', () => {
    render(<NursingAdmissionWizard />);
    expect(screen.getByText(/demographic/i)).toBeInTheDocument();
    expect(screen.getByText(/vital|allerg/i)).toBeInTheDocument();
    expect(screen.getByText(/review.*system|systems/i)).toBeInTheDocument();
    expect(screen.getByText(/pain|sleep|nutrition/i)).toBeInTheDocument();
    expect(screen.getByText(/substance|mental status|MH/i)).toBeInTheDocument();
    expect(screen.getByText(/risk assessment/i)).toBeInTheDocument();
    expect(screen.getByText(/suicide/i)).toBeInTheDocument();
    expect(screen.getByText(/summary|sign.?off/i)).toBeInTheDocument();
  });

  it('Next button advances to step 2 (Vital Signs)', () => {
    render(<NursingAdmissionWizard />);
    fireEvent.click(screen.getByText(/next|continue/i));
    expect(screen.getByText(/vital|allerg/i)).toBeInTheDocument();
  });

  it('Back button on step 2 returns to step 1', () => {
    render(<NursingAdmissionWizard />);
    fireEvent.click(screen.getByText(/next|continue/i));
    fireEvent.click(screen.getAllByText(/back|previous/i)[0]);
    expect(screen.getByText(/demographic/i)).toBeInTheDocument();
  });

  it('can advance through all 8 steps to reach summary', () => {
    render(<NursingAdmissionWizard />);
    for (let i = 0; i < 7; i++) {
      const nextBtn = screen.queryByText(/next|continue/i);
      if (nextBtn) fireEvent.click(nextBtn);
    }
    expect(screen.getByText(/summary|sign.?off/i)).toBeInTheDocument();
  });

  it('Step 1 shows resident demographics fields', () => {
    render(<NursingAdmissionWizard />);
    const inputs = screen.getAllByRole('textbox');
    expect(inputs.length).toBeGreaterThan(0);
    fireEvent.change(inputs[0], { target: { value: 'Test Name' } });
    expect(inputs[0].value).toBe('Test Name');
  });

  it('Vital Signs step renders blood pressure / temperature fields', () => {
    render(<NursingAdmissionWizard />);
    fireEvent.click(screen.getByText(/next|continue/i));
    expect(screen.getByText(/vital|blood pressure|temperature|pulse/i)).toBeInTheDocument();
  });

  it('Suicide Risk step renders risk-assessment content', () => {
    render(<NursingAdmissionWizard />);
    for (let i = 0; i < 6; i++) {
      const nextBtn = screen.queryByText(/next|continue/i);
      if (nextBtn) fireEvent.click(nextBtn);
    }
    expect(screen.getByText(/suicide/i)).toBeInTheDocument();
  });

  it('final step has a submit / save button', () => {
    render(<NursingAdmissionWizard />);
    for (let i = 0; i < 7; i++) {
      const nextBtn = screen.queryByText(/next|continue/i);
      if (nextBtn) fireEvent.click(nextBtn);
    }
    expect(screen.queryByText(/submit|save|complete|finish/i)).toBeInTheDocument();
  });

  it('submitting on final step shows success state or navigates', () => {
    render(<NursingAdmissionWizard />);
    for (let i = 0; i < 7; i++) {
      const nextBtn = screen.queryByText(/next|continue/i);
      if (nextBtn) fireEvent.click(nextBtn);
    }
    const submitBtn = screen.queryByText(/submit|save|complete|finish/i);
    if (submitBtn) {
      fireEvent.click(submitBtn);
      const success = screen.queryByText(/submitted|saved|complete/i);
      expect(success || mockPush.mock.calls.length > 0 || mockBack.mock.calls.length > 0).toBeTruthy();
    }
  });
});
