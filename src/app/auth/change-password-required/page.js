'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, ArrowRight, Lock } from 'lucide-react';
import { useAuth, authHeaders } from '@/contexts/AuthContext';
import styles from '../../login/login.module.css';

export default function ChangePasswordRequiredPage() {
  const router = useRouter();
  const { auth, csrfToken, login } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const destinationFor = (role) => {
    if (role === 'superadmin' || role === 'admin' || role === 'manager') return '/admin';
    if (role === 'staff') return '/staff';
    if (role === 'resident_care_of') return '/residents';
    return '/dashboard';
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (!auth?.accessToken) {
      setError('Please sign in again before changing your password');
      return;
    }
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('All fields are required');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }
    if (newPassword.length < 10) {
      setError('New password must be at least 10 characters');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/v1/auth/change-password-required', {
        method: 'POST',
        headers: authHeaders(auth.accessToken, csrfToken),
        credentials: 'include',
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error || 'Failed to change password');
      }

      await login(auth.accessToken, {
        ...auth.user,
        passwordChangedRequired: false,
      });
      router.replace(destinationFor(auth.user?.role));
    } catch (err) {
      setError(err.message || 'Failed to change password');
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className={styles.shell}>
      <div className={styles.column}>
        <header className={styles.header}>
          <div className={styles.logoMark}>
            <Lock size={54} aria-hidden="true" />
          </div>
          <div className={styles.headings}>
            <span className={styles.brandName}>Dependable Care</span>
            <h1 className={styles.title}>Set password.</h1>
            <p className={styles.subtitle}>
              Replace your temporary password before entering the portal.
            </p>
          </div>
        </header>

        {error && (
          <div className={styles.alert} role="alert">
            <AlertCircle size={16} aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className={styles.form} noValidate>
          <div className={styles.field}>
            <label htmlFor="currentPassword" className={styles.label}>Current Password</label>
            <input
              id="currentPassword"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className={styles.input}
              autoComplete="current-password"
              disabled={saving}
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="newPassword" className={styles.label}>New Password</label>
            <input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className={styles.input}
              autoComplete="new-password"
              disabled={saving}
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="confirmPassword" className={styles.label}>Confirm Password</label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={styles.input}
              autoComplete="new-password"
              disabled={saving}
            />
          </div>

          <button type="submit" className={styles.submit} disabled={saving} data-loading={saving ? 'true' : 'false'}>
            <span className={styles.submitLabel}>{saving ? 'Saving' : 'Continue'}</span>
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        </form>
      </div>
    </main>
  );
}
