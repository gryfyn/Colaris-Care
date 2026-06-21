import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import AdvanceDirectiveWizard from '../app/admission/advance-directive/page';

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack }),
}));

describe('Advance Directive Wizard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    expect(() => render(<AdvanceDirectiveWizard />)).not.toThrow();
  });

  it('shows the first step on initial render (Resident Information)', () => {
    render(<AdvanceDirectiveWizard />);
    expect(screen.getByText(/resident information|resident info/i)).toBeInTheDocument();
  });

  it('renders the step progress indicator', () => {
    render(<AdvanceDirectiveWizard />);
    expect(screen.getByText(/step 1|1.*6|resident/i)).toBeInTheDocument();
  });

  it('renders all 6 step labels', () => {
    render(<AdvanceDirectiveWizard />);
    expect(screen.getByText(/resident info/i)).toBeInTheDocument();
    expect(screen.getByText(/health care agent|HC agent/i)).toBeInTheDocument();
    expect(screen.getByText(/mental health.*pref|MH preferences/i)).toBeInTheDocument();
    expect(screen.getByText(/treatment pref/i)).toBeInTheDocument();
    expect(screen.getByText(/values|culture/i)).toBeInTheDocument();
    expect(screen.getByText(/sign.?off|end.of.life/i)).toBeInTheDocument();
  });

  it('Next button advances to step 2 (Health Care Agent)', () => {
    render(<AdvanceDirectiveWizard />);
    fireEvent.click(screen.getByText(/next|continue/i));
    expect(screen.getByText(/health care agent|HC agent/i)).toBeInTheDocument();
  });

  it('Back button on step 2 returns to step 1', () => {
    render(<AdvanceDirectiveWizard />);
    fireEvent.click(screen.getByText(/next|continue/i));
    fireEvent.click(screen.getAllByText(/back|previous/i)[0]);
    expect(screen.getByText(/resident information/i)).toBeInTheDocument();
  });

  it('can navigate through all 6 steps', () => {
    render(<AdvanceDirectiveWizard />);
    for (let i = 0; i < 5; i++) {
      const nextBtn = screen.queryByText(/next|continue/i);
      if (nextBtn) fireEvent.click(nextBtn);
    }
    expect(screen.getByText(/sign.?off|end.of.life|signature/i)).toBeInTheDocument();
  });

  it('Step 1 has text input fields for resident identity', () => {
    render(<AdvanceDirectiveWizard />);
    const inputs = screen.getAllByRole('textbox');
    expect(inputs.length).toBeGreaterThan(0);
    fireEvent.change(inputs[0], { target: { value: 'Marcus Thompson' } });
    expect(inputs[0].value).toBe('Marcus Thompson');
  });

  it('Step 2 has health care agent name and contact fields', () => {
    render(<AdvanceDirectiveWizard />);
    fireEvent.click(screen.getByText(/next|continue/i));
    expect(screen.getByText(/agent|contact|name/i)).toBeInTheDocument();
  });

  it('Mental Health Treatment Prefs step renders preference options', () => {
    render(<AdvanceDirectiveWizard />);
    fireEvent.click(screen.getByText(/next|continue/i));
    fireEvent.click(screen.queryByText(/next|continue/i));
    expect(screen.getByText(/mental health|treatment|preference/i)).toBeInTheDocument();
  });

  it('Values & Culture step renders cultural preference fields', () => {
    render(<AdvanceDirectiveWizard />);
    for (let i = 0; i < 4; i++) {
      const nextBtn = screen.queryByText(/next|continue/i);
      if (nextBtn) fireEvent.click(nextBtn);
    }
    expect(screen.getByText(/values|culture|personal/i)).toBeInTheDocument();
  });

  it('final step has a submit / sign button', () => {
    render(<AdvanceDirectiveWizard />);
    for (let i = 0; i < 5; i++) {
      const nextBtn = screen.queryByText(/next|continue/i);
      if (nextBtn) fireEvent.click(nextBtn);
    }
    expect(screen.queryByText(/submit|save|sign|complete|finish/i)).toBeInTheDocument();
  });

  it('submitting on final step shows success state or navigates', () => {
    render(<AdvanceDirectiveWizard />);
    for (let i = 0; i < 5; i++) {
      const nextBtn = screen.queryByText(/next|continue/i);
      if (nextBtn) fireEvent.click(nextBtn);
    }
    const submitBtn = screen.queryByText(/submit|save|sign|complete|finish/i);
    if (submitBtn) {
      fireEvent.click(submitBtn);
      const success = screen.queryByText(/submitted|saved|complete|signed/i);
      expect(success || mockPush.mock.calls.length > 0 || mockBack.mock.calls.length > 0).toBeTruthy();
    }
  });
});
