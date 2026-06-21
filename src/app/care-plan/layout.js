import FormTopBar from '@/app/components/FormTopBar';

// Wraps the care plan create + edit routes with the shared brand top bar.
export default function CarePlanFormLayout({ children }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <FormTopBar />
      {children}
    </div>
  );
}
