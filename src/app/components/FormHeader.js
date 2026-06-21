'use client';

export default function FormHeader({ formTitle }) {
  return (
    <div
      className="form-header-bar"
      style={{
        background: 'linear-gradient(135deg, #0f2d5e 0%, #1a3a5c 100%)',
        borderBottom: '3px solid #1a56db',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      {/* Logo and facility name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <img
          src="/logo.png"
          alt="Logo"
          style={{ height: '40px', width: 'auto' }}
        />
        <div>
          <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.7)', margin: 0 }}>
            FACILITY
          </div>
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#fff', margin: 0 }}>
            Dependable Care Residential Center
          </div>
        </div>
      </div>

      {/* Form title */}
      <div style={{ flex: 1, textAlign: 'center' }}>
        <h1
          style={{
            fontSize: '18px',
            fontWeight: 700,
            color: '#fff',
            margin: 0,
            letterSpacing: '-0.01em',
          }}
        >
          {formTitle}
        </h1>
      </div>

      {/* Right spacer for balance (desktop only) */}
      <div className="app-hide-mobile" style={{ width: '150px' }} />
    </div>
  );
}
