import FormTopBar from '@/app/components/FormTopBar';

// Wraps the admission form routes (pre-screening, nursing assessment, advance
// directive) with the shared brand top bar. These forms render as fixed
// `inset` takeovers offset below the bar (top: 52px) so the bar stays visible.
export default function AdmissionFormLayout({ children }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <FormTopBar />
      {children}
    </div>
  );
}
