'use client';

import { useEffect, useState } from 'react';

/**
 * FormCompletionModal: Displays PDF download options after form submission
 * Props: {
 *   formType: 'nursing-assessment' | 'pre-screening' | 'advance-directive',
 *   fileName: string (e.g., 'nursing_assessment_john_doe_2026-05-17.pdf'),
 *   isGenerating: boolean (shows loading state during PDF generation),
 *   onDownload: (filename) => void (triggers PDF download),
 *   onContinue: () => void (navigates to next form),
 *   error: string | null (error message if generation failed)
 * }
 * Client component for animations and modal state management
 */

const FORM_CONFIG = {
  'nursing-assessment': {
    icon: '◉',
    title: 'Nursing Assessment Complete',
    subtitle: 'Your assessment has been submitted successfully',
    nextStep: 'pre-screening',
    nextLabel: 'Continue to Pre-Screening →',
    accentColor: '#6c3fc5', // purple
    lightColor: '#f3effe',
  },
  'pre-screening': {
    icon: '⬡',
    title: 'Pre-Screening Submitted',
    subtitle: 'The form was saved successfully and is ready for admin review.',
    nextStep: 'admin',
    nextLabel: 'View Pending Admissions →',
    accentColor: '#0d7377', // teal
    lightColor: '#f0f9f8',
  },
  'advance-directive': {
    icon: '✓',
    title: 'Admission Package Complete',
    subtitle: 'All forms have been successfully submitted and are ready for admin review',
    nextStep: 'admin',
    nextLabel: 'View Pending Admissions →',
    accentColor: '#0ea571', // green
    lightColor: '#e6f9f1',
  },
};

export default function FormCompletionModal({
  formType = 'nursing-assessment',
  fileName = 'form.pdf',
  isGenerating = false,
  onDownload = () => {},
  onContinue = () => {},
  continueHref,
  continueLabel,
  error = null,
}) {
  const config = FORM_CONFIG[formType] || FORM_CONFIG['nursing-assessment'];
  const [isAnimating, setIsAnimating] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

  // Trigger entrance animation
  useEffect(() => {
    const timer = setTimeout(() => setIsAnimating(true), 50);
    return () => clearTimeout(timer);
  }, []);

  // Simulate download progress during generation
  useEffect(() => {
    if (!isGenerating) {
      return;
    }

    let progress = 20;
    const interval = setInterval(() => {
      progress = Math.min(progress + Math.random() * 30, 90);
      setDownloadProgress(progress);
    }, 300);

    return () => clearInterval(interval);
  }, [isGenerating]);

  const estimatedSize = '~2.5 MB';
  const timestamp = new Date().toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{
        background: 'rgba(15, 21, 56, 0.6)',
        backdropFilter: 'blur(8px)',
      }}
    >
      {/* Modal Container */}
      <div
        className="relative w-full max-w-md overflow-hidden rounded-2xl shadow-2xl"
        style={{
          background: '#ffffff',
          transform: isAnimating ? 'scale(1) opacity(1)' : 'scale(0.85) opacity(0)',
          transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Top accent bar */}
        <div
          className="h-1.5 w-full"
          style={{ background: config.accentColor }}
        />

        {/* Content */}
        <div className="p-8">
          {/* Icon & Title */}
          <div className="mb-8 text-center">
            <div
              className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full text-4xl"
              style={{
                background: config.lightColor,
                color: config.accentColor,
              }}
            >
              {config.icon}
            </div>
            <h2
              className="text-2xl font-bold"
              style={{ color: '#1e1538' }}
            >
              {config.title}
            </h2>
            <p
              className="mt-2 text-sm"
              style={{ color: '#6b5f8a' }}
            >
              {config.subtitle}
            </p>
          </div>

          {/* Error State */}
          {error && (
            <div
              className="mb-6 rounded-lg border-l-4 p-4"
              style={{
                background: '#fef2f2',
                borderLeftColor: '#dc2626',
              }}
            >
              <p className="text-sm font-semibold" style={{ color: '#dc2626' }}>
                ⚠ PDF Generation Failed
              </p>
              <p className="mt-1 text-xs" style={{ color: '#991b1b' }}>
                {error}
              </p>
            </div>
          )}

          {/* PDF Info Box */}
          {!error && (
            <div
              className="mb-6 rounded-lg border p-4"
              style={{
                background: config.lightColor,
                borderColor: config.accentColor + '40',
              }}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xl">📄</span>
                  <div>
                    <p
                      className="text-sm font-semibold"
                      style={{ color: '#1e1538' }}
                    >
                      {fileName}
                    </p>
                    <p
                      className="mt-1 text-xs"
                      style={{ color: '#6b5f8a' }}
                    >
                      {estimatedSize} • Generated {timestamp}
                    </p>
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              {isGenerating && (
                <div className="mt-4">
                  <div
                    className="h-1.5 w-full overflow-hidden rounded-full"
                    style={{
                      background: 'rgba(108, 63, 197, 0.1)',
                    }}
                  >
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${downloadProgress}%`,
                        background: config.accentColor,
                      }}
                    />
                  </div>
                  <p
                    className="mt-2 text-center text-xs font-medium"
                    style={{ color: config.accentColor }}
                  >
                    {downloadProgress < 100 ? 'Generating PDF...' : 'Ready to download'}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-3">
            {/* Primary: Download PDF */}
            {!error && (
              <button
                onClick={() => onDownload(fileName)}
                disabled={isGenerating}
                className="w-full rounded-lg px-4 py-3 font-semibold transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
                style={{
                  background: config.accentColor,
                  color: '#ffffff',
                  opacity: isGenerating ? 0.7 : 1,
                  cursor: isGenerating ? 'not-allowed' : 'pointer',
                }}
                onMouseEnter={(e) => {
                  if (!isGenerating) {
                    e.target.style.opacity = '0.9';
                    e.target.style.transform = 'translateY(-2px)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.target.style.opacity = '1';
                  e.target.style.transform = 'translateY(0)';
                }}
              >
                {isGenerating ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Generating PDF...
                  </span>
                ) : (
                  '⬇ Download PDF'
                )}
              </button>
            )}

            {/* Secondary: Continue to Next Form */}
            {continueHref && (
              <a
                href={continueHref}
                onClick={(event) => {
                  event.preventDefault();
                  if (!isGenerating) onContinue();
                }}
                className="block w-full rounded-lg px-4 py-3 text-center font-semibold transition-all duration-200"
                style={{
                  background: error ? config.accentColor : '#f3effe',
                  color: error ? '#ffffff' : config.accentColor,
                  borderWidth: error ? '0' : '1px',
                  borderColor: error ? 'transparent' : config.accentColor,
                  cursor: isGenerating ? 'not-allowed' : 'pointer',
                  opacity: isGenerating ? 0.6 : 1,
                }}
              >
                {error ? 'Continue Without PDF' : (continueLabel || config.nextLabel)}
              </a>
            )}
            {!continueHref && (
            <button
              onClick={onContinue}
              disabled={isGenerating}
              className="w-full rounded-lg px-4 py-3 font-semibold transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
              style={{
                background: error ? config.accentColor : '#f3effe',
                color: error ? '#ffffff' : config.accentColor,
                borderWidth: error ? '0' : '1px',
                borderColor: error ? 'transparent' : config.accentColor,
                cursor: isGenerating ? 'not-allowed' : 'pointer',
              }}
              onMouseEnter={(e) => {
                if (!isGenerating && !error) {
                  e.target.style.background = config.accentColor + '15';
                }
              }}
              onMouseLeave={(e) => {
                if (!error) {
                  e.target.style.background = '#f3effe';
                }
              }}
            >
              {error ? '✓ Continue Without PDF' : config.nextLabel}
            </button>
            )}

            {/* Tertiary: Retry (if error) */}
            {error && (
              <button
                onClick={() => window.location.reload()}
                className="w-full rounded-lg border px-4 py-3 font-semibold transition-all duration-200"
                style={{
                  background: '#ffffff',
                  color: '#dc2626',
                  borderColor: '#fecaca',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = '#fee2e2';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = '#ffffff';
                }}
              >
                🔄 Try Again
              </button>
            )}
          </div>

          {/* Footer hint */}
          <p
            className="mt-6 text-center text-xs"
            style={{ color: '#9ca3af' }}
          >
            {error
              ? 'Your form has been submitted. You can download the PDF later.'
              : 'Keep a copy for your records. Admin will review your submission.'}
          </p>
        </div>
      </div>

      {/* Prevent closing by clicking outside */}
      <style jsx>{`
        @keyframes popIn {
          0% {
            transform: scale(0.85);
            opacity: 0;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
