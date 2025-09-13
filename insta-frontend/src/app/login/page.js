'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { login, isTokenValid } from '../../utils/auth';
import styles from './login.module.css';

export default function Login() {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  // Redirect if already logged in
  useEffect(() => {
    if (isTokenValid()) {
      router.push('/dashboard');
    }
  }, [router]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    // Clear error when user starts typing
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Basic validation
    if (!formData.email || !formData.password) {
      setError('Please fill in all fields');
      setLoading(false);
      return;
    }

    try {
      const result = await login(formData);
      
      if (result.success) {
        // Redirect to dashboard on successful login
        router.push('/dashboard');
      } else {
        setError(result.error);
      }
    } catch (error) {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.loginBox}>
        <div className={styles.header}>
          <h1 className={styles.logo}>Instagram</h1>
          <p className={styles.subtitle}>Sign in to see photos and videos from your friends.</p>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          {error && (
            <div className={styles.error}>
              {error}
            </div>
          )}

          <div className={styles.inputGroup}>
            <input
              type="email"
              name="email"
              placeholder="Email"
              value={formData.email}
              onChange={handleChange}
              className={styles.input}
              required
            />
          </div>

          <div className={styles.inputGroup}>
            <input
              type="password"
              name="password"
              placeholder="Password"
              value={formData.password}
              onChange={handleChange}
              className={styles.input}
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className={styles.loginButton}
          >
            {loading ? 'Signing in...' : 'Log In'}
          </button>
        </form>

        <div className={styles.divider}>
          <span>OR</span>
        </div>

        <div className={styles.forgotPassword}>
          <Link href="/forgot-password">
            Forgot password?
          </Link>
        </div>
      </div>

      <div className={styles.signupBox}>
        <p>
          Don't have an account?{' '}
          <Link href="/signup" className={styles.signupLink}>
            Sign up
          </Link>
        </p>
      </div>

      <div className={styles.footer}>
        <p>Instagram Clone - Demo App</p>
      </div>
    </div>
  );
}