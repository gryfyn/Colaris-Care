'use client';

import { useState } from 'react';
import Link from 'next/link';
import styles from '../../login/login.module.css';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email) {
      setError('Email is required');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/v1/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to process request');
        setLoading(false);
        return;
      }

      setSubmitted(true);
      setEmail('');
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <h1 className={styles.title}>Check Your Email</h1>

          <div className={styles.success}>
            If an account exists with that email address, you will receive a password reset link. Please check your inbox and spam folder.
          </div>

          <div style={{ marginTop: '24px', textAlign: 'center' }}>
            <p style={{ marginBottom: '16px', color: '#4a5568' }}>
              The reset link will expire in 30 minutes.
            </p>
          </div>

          <div className={styles.footer}>
            <p>
              Back to{' '}
              <Link href="/login" className={styles.link}>
                Login
              </Link>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>Forgot Password</h1>

        <p style={{ textAlign: 'center', color: '#4a5568', marginBottom: '24px', fontSize: '14px' }}>
          Enter your email address and we'll send you a link to reset your password.
        </p>

        {error && <div className={styles.error}>{error}</div>}

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formGroup}>
            <label htmlFor="email" className={styles.label}>
              Email Address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={styles.input}
              placeholder="Enter your email"
              disabled={loading}
              autoComplete="email"
            />
          </div>

          <button type="submit" className={styles.button} disabled={loading}>
            {loading ? 'Sending...' : 'Send Reset Link'}
          </button>
        </form>

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
