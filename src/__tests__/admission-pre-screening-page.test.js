import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import PreAdmissionWizard from '../app/admission/pre-screening/page';

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack }),
}));

describe('Pre-Admission Screening Wizard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    expect(() => render(<PreAdmissionWizard />)).not.toThrow();
  });

  it('shows the first step on initial render', () => {
    render(<PreAdmissionWizard />);
    // Step 1: Referral & Funding
    expect(screen.getByText(/referral|funding/i)).toBeInTheDocument();
  });

  it('renders a step progress indicator', () => {
    render(<PreAdmissionWizard />);
    // Progress should show Step 1 of 6
    expect(screen.getByText(/step 1|1.*6|referral/i)).toBeInTheDocument();
  });

  it('renders all 6 step labels in the stepper', () => {
    render(<PreAdmissionWizard />);
    expect(screen.getByText(/referral/i)).toBeInTheDocument();
    expect(screen.getByText(/mental health|mh history/i)).toBeInTheDocument();
    expect(screen.getByText(/medical/i)).toBeInTheDocument();
    expect(screen.getByText(/substance/i)).toBeInTheDocument();
    expect(screen.getByText(/psychosocial/i)).toBeInTheDocument();
    expect(screen.getByText(/summary/i)).toBeInTheDocument();
  });

  it('Next button advances to step 2', () => {
    render(<PreAdmissionWizard />);
    const nextBtn = screen.getByText(/next|continue/i);
    fireEvent.click(nextBtn);
    expect(screen.getByText(/mental health.*history|mh history/i)).toBeInTheDocument();
  });

  it('Back button on step 2 returns to step 1', () => {
    render(<PreAdmissionWizard />);
    fireEvent.click(screen.getByText(/next|continue/i));
    fireEvent.click(screen.getByText(/back|previous/i));
    expect(screen.getByText(/referral|funding/i)).toBeInTheDocument();
  });

  it('can navigate through all 6 steps', () => {
    render(<PreAdmissionWizard />);
    for (let i = 0; i < 5; i++) {
      const nextBtn = screen.queryByText(/next|continue/i);
      if (nextBtn) fireEvent.click(nextBtn);
    }
    expect(screen.getByText(/summary|level of care/i)).toBeInTheDocument();
  });

  it('form fields accept text input', () => {
    render(<PreAdmissionWizard />);
    const inputs = screen.getAllByRole('textbox');
    if (inputs.length > 0) {
      fireEvent.change(inputs[0], { target: { value: 'Test input' } });
      expect(inputs[0].value).toBe('Test input');
    }
  });

  it('submit/save button is present on the final step', () => {
    render(<PreAdmissionWizard />);
    for (let i = 0; i < 5; i++) {
      const nextBtn = screen.queryByText(/next|continue/i);
      if (nextBtn) fireEvent.click(nextBtn);
    }
    expect(
      screen.queryByText(/submit|save|complete|finish/i)
    ).toBeInTheDocument();
  });

  it('submitting on the final step shows success or routes away', () => {
    render(<PreAdmissionWizard />);
    for (let i = 0; i < 5; i++) {
      const nextBtn = screen.queryByText(/next|continue/i);
      if (nextBtn) fireEvent.click(nextBtn);
    }
    const submitBtn = screen.queryByText(/submit|save|complete|finish/i);
    if (submitBtn) {
      fireEvent.click(submitBtn);
      // Either success screen renders or router navigates away
      const success = screen.queryByText(/submitted|saved|complete/i);
      expect(success || mockPush.mock.calls.length > 0 || mockBack.mock.calls.length > 0).toBeTruthy();
    }
  });
});
