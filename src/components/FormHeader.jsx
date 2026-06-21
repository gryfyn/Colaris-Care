'use client';

/** Form header with tenant branding, user info, form title, and navigation */
export default function FormHeader({
  formTitle,
  stepLabel,
  currentStep,
  totalSteps,
  tenantName = 'Dependable Care Residential Center',
  userName = 'Current User',
  onClose
}) {
  const progressPercent = totalSteps > 0 ? Math.round((currentStep / totalSteps) * 100) : 0;

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200">
      {/* Top bar: Tenant branding & user info */}
      <div className="px-6 py-3 flex items-center justify-between bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200">
        <div className="flex items-center gap-4">
          {/* Logo placeholder */}
          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-600 to-purple-700 flex items-center justify-center">
            <span className="text-white font-bold text-lg">DC</span>
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Admission Portal</div>
            <div className="text-sm font-medium text-slate-900">{tenantName}</div>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className="text-xs font-semibold text-slate-500 uppercase">Logged In As</div>
            <div className="text-sm font-medium text-slate-900">{userName}</div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
            aria-label="Close form"
          >
            <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Form title & progress */}
      <div className="px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{formTitle}</h1>
          {stepLabel && (
            <p className="text-sm text-slate-600 mt-1">
              {stepLabel} · Step {currentStep} of {totalSteps}
            </p>
          )}
        </div>

        {/* Progress bar */}
        <div className="flex items-center gap-4">
          <div className="w-48 h-1.5 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-purple-600 to-purple-500 rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="text-xs font-semibold text-slate-500 min-w-12 text-right">
            {progressPercent}%
          </span>
        </div>
      </div>
    </header>
  );
}
