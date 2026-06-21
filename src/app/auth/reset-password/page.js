'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import styles from '../../login/login.module.css';

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [formData, setFormData] = useState({
    newPassword: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});

  useEffect(() => {
    if (!token) {
      setError('Invalid reset link. Please request a new password reset.');
    }
  }, [token]);

  const validateForm = () => {
    const errors = {};

    if (!formData.newPassword) {
      errors.newPassword = 'Password is required';
    } else if (formData.newPassword.length < 8) {
      errors.newPassword = 'Password must be at least 8 characters';
    }

    if (!formData.confirmPassword) {
      errors.confirmPassword = 'Please confirm your password';
    }

    if (formData.newPassword && formData.confirmPassword && formData.newPassword !== formData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear validation error for this field
    if (validationErrors[name]) {
      setValidationErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/v1/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          newPassword: formData.newPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to reset password');
        setLoading(false);
        return;
      }

      setSuccess('Password reset successfully! Redirecting to login...');
      setFormData({ newPassword: '', confirmPassword: '' });

      // Redirect to login after 2 seconds
      setTimeout(() => {
        router.push('/login');
      }, 2000);
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>Reset Password</h1>

        {error && <div className={styles.error}>{error}</div>}
        {success && <div className={styles.success}>{success}</div>}

        {token && (
          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.formGroup}>
              <label htmlFor="newPassword" className={styles.label}>
                New Password
              </label>
              <input
                id="newPassword"
                name="newPassword"
                type="password"
                value={formData.newPassword}
                onChange={handleChange}
                className={`${styles.input} ${validationErrors.newPassword ? styles.inputError : ''}`}
                placeholder="Enter new password"
                disabled={loading}
              />
              {validationErrors.newPassword && (
                <span className={styles.fieldError}>{validationErrors.newPassword}</span>
              )}
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="confirmPassword" className={styles.label}>
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={handleChange}
                className={`${styles.input} ${validationErrors.confirmPassword ? styles.inputError : ''}`}
                placeholder="Confirm your password"
                disabled={loading}
              />
              {validationErrors.confirmPassword && (
                <span className={styles.fieldError}>{validationErrors.confirmPassword}</span>
              )}
            </div>

            <button
              type="submit"
              className={styles.button}
              disabled={loading || !token}
            >
              {loading ? 'Resetting...' : 'Reset Password'}
            </button>
          </form>
        )}

        <div className={styles.footer}>
          <p>
            Remember your password?{' '}
            <Link href="/login" className={styles.link}>
              Back to Login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div style={{ padding: 20 }}>Loading...</div>}>
      <ResetPasswordContent />
    </Suspense>
  );
}
