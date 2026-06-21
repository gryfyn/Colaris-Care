'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdmissionIndexPage() {
  const router = useRouter();

  useEffect(() => {
    // Start at pre-screening so the client-facing workflow begins with the
    // screening packet that the admin reviews before the resident is admitted.
    router.replace('/admission/pre-screening');
  }, [router]);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: '#f8f9fa',
      fontFamily: 'sans-serif',
    }}>
      <p style={{ color: '#6b7280' }}>Redirecting to admission form...</p>
    </div>
  );
}
