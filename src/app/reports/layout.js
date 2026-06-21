import FormTopBar from '@/app/components/FormTopBar';

// Wraps the standalone report form routes (drug disposal, incident, evacuation
// drill, daily progress notes) with the shared brand top bar so users can
// always get back to their dashboard.
export default function ReportsFormLayout({ children }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <FormTopBar />
      {children}
    </div>
  );
}
