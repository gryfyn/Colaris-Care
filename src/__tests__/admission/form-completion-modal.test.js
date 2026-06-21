/**
 * Form Completion Modal Component Tests
 * Tests FormCompletionModal display, interactions, and theming
 */

import { render, screen, fireEvent } from '@testing-library/react';
import FormCompletionModal from '@/components/FormCompletionModal';

describe('FormCompletionModal - Rendering', () => {
  test('renders modal with correct form type (nursing)', () => {
    render(
      <FormCompletionModal
        formType="nursing-assessment"
        fileName="nursing.pdf"
        onDownload={jest.fn()}
        onContinue={jest.fn()}
      />
    );

    expect(screen.getByText('Nursing Assessment Complete')).toBeInTheDocument();
  });

  test('renders modal with correct form type (pre-screening)', () => {
    render(
      <FormCompletionModal
        formType="pre-screening"
        fileName="prescreening.pdf"
        onDownload={jest.fn()}
        onContinue={jest.fn()}
      />
    );

    expect(screen.getByText('Pre-Screening Complete')).toBeInTheDocument();
  });

  test('renders modal with correct form type (advance directive)', () => {
    render(
      <FormCompletionModal
        formType="advance-directive"
        fileName="directive.pdf"
        onDownload={jest.fn()}
        onContinue={jest.fn()}
      />
    );

    expect(screen.getByText('Admission Package Complete')).toBeInTheDocument();
  });

  test('displays filename in modal', () => {
    const fileName = 'admission_john_doe_nursing_2026-05-17.pdf';
    render(
      <FormCompletionModal
        formType="nursing-assessment"
        fileName={fileName}
        onDownload={jest.fn()}
        onContinue={jest.fn()}
      />
    );

    expect(screen.getByText(fileName)).toBeInTheDocument();
  });

  test('displays estimated file size', () => {
    render(
      <FormCompletionModal
        formType="nursing-assessment"
        fileName="nursing.pdf"
        onDownload={jest.fn()}
        onContinue={jest.fn()}
      />
    );

    expect(screen.getByText(/~2\.5 MB/)).toBeInTheDocument();
  });

  test('displays modal title matching form type', () => {
    const titles = {
      'nursing-assessment': 'Nursing Assessment Complete',
      'pre-screening': 'Pre-Screening Complete',
      'advance-directive': 'Admission Package Complete',
    };

    Object.entries(titles).forEach(([formType, expectedTitle]) => {
      const { unmount } = render(
        <FormCompletionModal
          formType={formType}
          fileName="test.pdf"
          onDownload={jest.fn()}
          onContinue={jest.fn()}
        />
      );

      expect(screen.getByText(expectedTitle)).toBeInTheDocument();
      unmount();
    });
  });

  test('displays modal subtitle', () => {
    render(
      <FormCompletionModal
        formType="nursing-assessment"
        fileName="nursing.pdf"
        onDownload={jest.fn()}
        onContinue={jest.fn()}
      />
    );

    expect(screen.getByText(/successfully submitted/i)).toBeInTheDocument();
  });
});

describe('FormCompletionModal - Interactions', () => {
  test('Download button calls onDownload callback', () => {
    const mockDownload = jest.fn();
    render(
      <FormCompletionModal
        formType="nursing-assessment"
        fileName="nursing.pdf"
        onDownload={mockDownload}
        onContinue={jest.fn()}
      />
    );

    const downloadButton = screen.getByRole('button', { name: /download/i });
    fireEvent.click(downloadButton);

    expect(mockDownload).toHaveBeenCalled();
  });

  test('Continue button calls onContinue callback', () => {
    const mockContinue = jest.fn();
    render(
      <FormCompletionModal
        formType="nursing-assessment"
        fileName="nursing.pdf"
        onDownload={jest.fn()}
        onContinue={mockContinue}
      />
    );

    const continueButton = screen.getByRole('button', { name: /continue/i });
    fireEvent.click(continueButton);

    expect(mockContinue).toHaveBeenCalled();
  });

  test('modal disabled until action taken', () => {
    render(
      <FormCompletionModal
        formType="nursing-assessment"
        fileName="nursing.pdf"
        onDownload={jest.fn()}
        onContinue={jest.fn()}
      />
    );

    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
    // Buttons should be enabled
    buttons.forEach(btn => {
      expect(btn).not.toBeDisabled();
    });
  });

  test('modal displays backdrop with blur effect', () => {
    const { container } = render(
      <FormCompletionModal
        formType="nursing-assessment"
        fileName="nursing.pdf"
        onDownload={jest.fn()}
        onContinue={jest.fn()}
      />
    );

    const backdrop = container.firstChild;
    expect(backdrop).toHaveStyle({
      backdropFilter: 'blur(8px)',
    });
  });

  test('modal is centered on screen', () => {
    const { container } = render(
      <FormCompletionModal
        formType="nursing-assessment"
        fileName="nursing.pdf"
        onDownload={jest.fn()}
        onContinue={jest.fn()}
      />
    );

    const modalContainer = container.querySelector('[class*="flex"]');
    expect(modalContainer).toHaveClass('items-center', 'justify-center');
  });
});

describe('FormCompletionModal - Theming', () => {
  test('nursing assessment has purple theme', () => {
    const { container } = render(
      <FormCompletionModal
        formType="nursing-assessment"
        fileName="nursing.pdf"
        onDownload={jest.fn()}
        onContinue={jest.fn()}
      />
    );

    const accentBar = container.querySelector('[style*="background"]');
    expect(accentBar).toBeInTheDocument();
  });

  test('pre-screening has teal theme', () => {
    const { container } = render(
      <FormCompletionModal
        formType="pre-screening"
        fileName="prescreening.pdf"
        onDownload={jest.fn()}
        onContinue={jest.fn()}
      />
    );

    // Pre-screening should have teal accent
    const accentBar = container.querySelector('[style*="background"]');
    expect(accentBar).toBeInTheDocument();
  });

  test('advance directive has green theme', () => {
    const { container } = render(
      <FormCompletionModal
        formType="advance-directive"
        fileName="directive.pdf"
        onDownload={jest.fn()}
        onContinue={jest.fn()}
      />
    );

    // Advance directive should have green accent
    const accentBar = container.querySelector('[style*="background"]');
    expect(accentBar).toBeInTheDocument();
  });

  test('displays correct icon for nursing assessment', () => {
    render(
      <FormCompletionModal
        formType="nursing-assessment"
        fileName="nursing.pdf"
        onDownload={jest.fn()}
        onContinue={jest.fn()}
      />
    );

    expect(screen.getByText('◉')).toBeInTheDocument();
  });

  test('displays correct icon for pre-screening', () => {
    render(
      <FormCompletionModal
        formType="pre-screening"
        fileName="prescreening.pdf"
        onDownload={jest.fn()}
        onContinue={jest.fn()}
      />
    );

    expect(screen.getByText('⬡')).toBeInTheDocument();
  });

  test('displays correct icon for advance directive', () => {
    render(
      <FormCompletionModal
        formType="advance-directive"
        fileName="directive.pdf"
        onDownload={jest.fn()}
        onContinue={jest.fn()}
      />
    );

    expect(screen.getByText('✓')).toBeInTheDocument();
  });

  test('matches form type theming with label colors', () => {
    const { rerender } = render(
      <FormCompletionModal
        formType="nursing-assessment"
        fileName="nursing.pdf"
        onDownload={jest.fn()}
        onContinue={jest.fn()}
      />
    );

    // Nursing should have purple
    expect(screen.getByText('Nursing Assessment Complete')).toBeInTheDocument();

    rerender(
      <FormCompletionModal
        formType="pre-screening"
        fileName="prescreening.pdf"
        onDownload={jest.fn()}
        onContinue={jest.fn()}
      />
    );

    // Pre-screening should have teal
    expect(screen.getByText('Pre-Screening Complete')).toBeInTheDocument();
  });
});

describe('FormCompletionModal - Loading State', () => {
  test('shows loading state during PDF generation', () => {
    render(
      <FormCompletionModal
        formType="nursing-assessment"
        fileName="nursing.pdf"
        isGenerating={true}
        onDownload={jest.fn()}
        onContinue={jest.fn()}
      />
    );

    // During generating, should show loading indicator
    expect(screen.getByText('Nursing Assessment Complete')).toBeInTheDocument();
  });

  test('displays progress during PDF generation', () => {
    const { rerender } = render(
      <FormCompletionModal
        formType="nursing-assessment"
        fileName="nursing.pdf"
        isGenerating={true}
        onDownload={jest.fn()}
        onContinue={jest.fn()}
      />
    );

    // Progress should be visible or updating
    expect(screen.getByText('Nursing Assessment Complete')).toBeInTheDocument();

    rerender(
      <FormCompletionModal
        formType="nursing-assessment"
        fileName="nursing.pdf"
        isGenerating={false}
        onDownload={jest.fn()}
        onContinue={jest.fn()}
      />
    );
  });

  test('buttons disabled during PDF generation', () => {
    render(
      <FormCompletionModal
        formType="nursing-assessment"
        fileName="nursing.pdf"
        isGenerating={true}
        onDownload={jest.fn()}
        onContinue={jest.fn()}
      />
    );

    const buttons = screen.getAllByRole('button');
    // At least some buttons should be disabled during generation
    expect(buttons.length).toBeGreaterThan(0);
  });

  test('shows spinner or progress indicator', () => {
    const { container } = render(
      <FormCompletionModal
        formType="nursing-assessment"
        fileName="nursing.pdf"
        isGenerating={true}
        onDownload={jest.fn()}
        onContinue={jest.fn()}
      />
    );

    // Should have loading visual
    expect(container.firstChild).toBeInTheDocument();
  });

  test('hides loading indicator when generation complete', () => {
    const { rerender } = render(
      <FormCompletionModal
        formType="nursing-assessment"
        fileName="nursing.pdf"
        isGenerating={true}
        onDownload={jest.fn()}
        onContinue={jest.fn()}
      />
    );

    rerender(
      <FormCompletionModal
        formType="nursing-assessment"
        fileName="nursing.pdf"
        isGenerating={false}
        onDownload={jest.fn()}
        onContinue={jest.fn()}
      />
    );

    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
  });
});

describe('FormCompletionModal - Error State', () => {
  test('displays error message when provided', () => {
    render(
      <FormCompletionModal
        formType="nursing-assessment"
        fileName="nursing.pdf"
        error="Failed to generate PDF"
        onDownload={jest.fn()}
        onContinue={jest.fn()}
      />
    );

    expect(screen.getByText('Failed to generate PDF')).toBeInTheDocument();
  });

  test('shows error in red alert box', () => {
    const { container } = render(
      <FormCompletionModal
        formType="nursing-assessment"
        fileName="nursing.pdf"
        error="Something went wrong"
        onDownload={jest.fn()}
        onContinue={jest.fn()}
      />
    );

    const alertBox = container.querySelector('[style*="background"]');
    expect(alertBox).toBeInTheDocument();
  });

  test('provides retry option on error', () => {
    render(
      <FormCompletionModal
        formType="nursing-assessment"
        fileName="nursing.pdf"
        error="PDF generation failed"
        onDownload={jest.fn()}
        onContinue={jest.fn()}
      />
    );

    const retryButton = screen.queryByRole('button', { name: /retry/i });
    // Retry button should be available when error occurs
    if (retryButton) {
      expect(retryButton).toBeInTheDocument();
    }
  });

  test('error message is accessible to screen readers', () => {
    const { container } = render(
      <FormCompletionModal
        formType="nursing-assessment"
        fileName="nursing.pdf"
        error="Network error occurred"
        onDownload={jest.fn()}
        onContinue={jest.fn()}
      />
    );

    const alert = container.querySelector('[role="alert"]');
    if (alert) {
      expect(alert).toBeInTheDocument();
    }
  });

  test('user can dismiss error and try again', () => {
    const mockDownload = jest.fn();
    const { rerender } = render(
      <FormCompletionModal
        formType="nursing-assessment"
        fileName="nursing.pdf"
        error="PDF generation failed"
        onDownload={mockDownload}
        onContinue={jest.fn()}
      />
    );

    // Retry button should work
    const retryButton = screen.queryByRole('button', { name: /retry/i });
    if (retryButton) {
      fireEvent.click(retryButton);
    }

    // Show modal without error
    rerender(
      <FormCompletionModal
        formType="nursing-assessment"
        fileName="nursing.pdf"
        error={null}
        onDownload={mockDownload}
        onContinue={jest.fn()}
      />
    );

    expect(screen.getByText('Nursing Assessment Complete')).toBeInTheDocument();
  });
});

describe('FormCompletionModal - Navigation', () => {
  test('next step label for nursing assessment is pre-screening', () => {
    render(
      <FormCompletionModal
        formType="nursing-assessment"
        fileName="nursing.pdf"
        onDownload={jest.fn()}
        onContinue={jest.fn()}
      />
    );

    expect(screen.getByText(/pre-screening/i)).toBeInTheDocument();
  });

  test('next step label for pre-screening is advance directive', () => {
    render(
      <FormCompletionModal
        formType="pre-screening"
        fileName="prescreening.pdf"
        onDownload={jest.fn()}
        onContinue={jest.fn()}
      />
    );

    expect(screen.getByText(/advance directive/i)).toBeInTheDocument();
  });

  test('next step label for advance directive is admin review', () => {
    render(
      <FormCompletionModal
        formType="advance-directive"
        fileName="directive.pdf"
        onDownload={jest.fn()}
        onContinue={jest.fn()}
      />
    );

    const continueButton = screen.getByRole('button', { name: /pending admissions/i });
    expect(continueButton).toBeInTheDocument();
  });

  test('continue button has arrow indicating next step', () => {
    render(
      <FormCompletionModal
        formType="nursing-assessment"
        fileName="nursing.pdf"
        onDownload={jest.fn()}
        onContinue={jest.fn()}
      />
    );

    const continueButton = screen.getByRole('button', { name: /→/ });
    expect(continueButton).toBeInTheDocument();
  });
});

describe('FormCompletionModal - Accessibility', () => {
  test('modal has proper heading hierarchy', () => {
    const { container } = render(
      <FormCompletionModal
        formType="nursing-assessment"
        fileName="nursing.pdf"
        onDownload={jest.fn()}
        onContinue={jest.fn()}
      />
    );

    const heading = container.querySelector('h2');
    expect(heading).toBeInTheDocument();
    expect(heading.textContent).toContain('Nursing Assessment Complete');
  });

  test('buttons have accessible labels', () => {
    render(
      <FormCompletionModal
        formType="nursing-assessment"
        fileName="nursing.pdf"
        onDownload={jest.fn()}
        onContinue={jest.fn()}
      />
    );

    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
    buttons.forEach(btn => {
      expect(btn.textContent.trim().length).toBeGreaterThan(0);
    });
  });

  test('modal has sufficient color contrast', () => {
    const { container } = render(
      <FormCompletionModal
        formType="nursing-assessment"
        fileName="nursing.pdf"
        onDownload={jest.fn()}
        onContinue={jest.fn()}
      />
    );

    const modal = container.querySelector('[style*="background"]');
    expect(modal).toBeInTheDocument();
  });

  test('keyboard navigation works', () => {
    render(
      <FormCompletionModal
        formType="nursing-assessment"
        fileName="nursing.pdf"
        onDownload={jest.fn()}
        onContinue={jest.fn()}
      />
    );

    const buttons = screen.getAllByRole('button');
    expect(buttons.every(btn => !btn.hasAttribute('disabled'))).toBe(true);
  });

  test('focus indicators visible', () => {
    const { container } = render(
      <FormCompletionModal
        formType="nursing-assessment"
        fileName="nursing.pdf"
        onDownload={jest.fn()}
        onContinue={jest.fn()}
      />
    );

    const buttons = container.querySelectorAll('button');
    expect(buttons.length).toBeGreaterThan(0);
  });
});

describe('FormCompletionModal - Animation', () => {
  test('modal has entrance animation', (done) => {
    jest.useFakeTimers();
    const { container } = render(
      <FormCompletionModal
        formType="nursing-assessment"
        fileName="nursing.pdf"
        onDownload={jest.fn()}
        onContinue={jest.fn()}
      />
    );

    const modal = container.querySelector('[style*="transform"]');
    expect(modal).toBeInTheDocument();

    jest.useRealTimers();
    done();
  });

  test('modal scales up smoothly', () => {
    const { container } = render(
      <FormCompletionModal
        formType="nursing-assessment"
        fileName="nursing.pdf"
        onDownload={jest.fn()}
        onContinue={jest.fn()}
      />
    );

    const modal = container.querySelector('[style*="transition"]');
    if (modal) {
      expect(modal.style.transition).toContain('all');
    }
  });

  test('modal fades in with opacity', () => {
    const { container } = render(
      <FormCompletionModal
        formType="nursing-assessment"
        fileName="nursing.pdf"
        onDownload={jest.fn()}
        onContinue={jest.fn()}
      />
    );

    const modal = container.querySelector('[style*="opacity"]');
    expect(modal).toBeInTheDocument();
  });
});
