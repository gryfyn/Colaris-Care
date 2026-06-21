'use client';

import FormHeader from './FormHeader';

export default function FormLayout({ formTitle, children }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        background: '#f5f5f5',
      }}
    >
      <FormHeader formTitle={formTitle} />

      <main
        className="form-main-pad app-main"
        style={{
          flex: 1,
          overflowY: 'auto',
        }}
      >
        <div
          style={{
            maxWidth: '800px',
            margin: '0 auto',
          }}
        >
          {children}
        </div>
      </main>
    </div>
  );
}
