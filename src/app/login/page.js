'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import styles from './login.module.css';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const year = new Date().getFullYear();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Email and password are required');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 423) {
          setError(`Account locked. Try again at ${new Date(data.unlockAt).toLocaleTimeString()}`);
        } else {
          setError(data.error || 'Login failed');
        }
        setLoading(false);
        return;
      }

      await login(data.accessToken, {
        id: data.user.id,
        firstName: data.user.firstName,
        lastName: data.user.lastName,
        role: data.user.role,
        staffId: data.user.staffId,
        residentId: data.user.residentId,
        tenantId: data.user.tenantId,
        passwordChangedRequired: data.user.passwordChangedRequired,
      });

      if (data.user.passwordChangedRequired) {
        router.push('/auth/change-password-required');
        return;
      }

      const role = data.user.role;
      if (role === 'superadmin' || role === 'admin' || role === 'manager') {
        router.push('/admin');
      } else if (role === 'staff') {
        router.push('/staff');
      } else if (role === 'resident_care_of') {
        router.push('/residents');
      } else {
        router.push('/dashboard');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
      setLoading(false);
    }
  };

  return (
    <main className={styles.shell}>
      <div className={styles.column}>

        {/* Header — logo set to the left of the welcome */}
        <header className={styles.header}>
          <div className={styles.logoMark}>
            <Image src="/logo.png" alt="Dependable Care Wellness Centre" width={84} height={84} priority />
          </div>
          <div className={styles.headings}>
            <span className={styles.brandName}>
              Dependable Care{' '}
              <span className={styles.brandNameAccent}>Wellness Centre</span>
            </span>
            <h1 className={styles.title}>
              Welcome <em>back.</em>
            </h1>
            <p className={styles.subtitle}>
              Sign in to continue your care journey.
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
            <label htmlFor="email" className={styles.label}>
              <Mail size={13} aria-hidden="true" />
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={styles.input}
              placeholder="you@dependablecare.com"
              disabled={loading}
              autoComplete="email"
              spellCheck={false}
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="password" className={styles.label}>
              <Lock size={13} aria-hidden="true" />
              Password
            </label>
            <div className={styles.passwordWrap}>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={styles.input}
                placeholder="••••••••"
                disabled={loading}
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className={styles.peek}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                tabIndex={loading ? -1 : 0}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className={styles.submit}
            disabled={loading}
            data-loading={loading ? 'true' : 'false'}
          >
            <span className={styles.submitLabel}>
              {loading ? 'Signing in' : 'Sign in'}
            </span>
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        </form>

        <div className={styles.divider}>
          <span>Need access?</span>
        </div>

        <p className={styles.help}>
          Accounts are provisioned by your administrator. Reach out to them to
          request access.
        </p>

        <footer className={styles.foot}>
          <span>Est. 2026</span>
          <span className={styles.footDot}>·</span>
          <span>Oregon</span>
          <span className={styles.footDot}>·</span>
          <span>© {year}</span>
        </footer>
      </div>
    </main>
  );
}
