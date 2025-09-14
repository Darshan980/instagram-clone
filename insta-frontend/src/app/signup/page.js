'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { register, isTokenValid } from '../../utils/auth';
import styles from './signup.module.css';

export default function Signup() {
  const [formData, setFormData] = useState({
    email: '',
    fullName: '',
    username: '',
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
    if (!formData.email || !formData.fullName || !formData.username || !formData.password) {
      setError('Please fill in all fields');
      setLoading(false);
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long');
      setLoading(false);
      return;
    }

    if (formData.username.length < 3) {
      setError('Username must be at least 3 characters long');
      setLoading(false);
      return;
    }

    try {
      const result = await register(formData);
      
      if (result.success) {
        // Redirect to dashboard on successful registration
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
      <div className={styles.signupBox}>
        <div className={styles.header}>
          <h1 className={styles.logo}>Instagram</h1>
          <p className={styles.subtitle}>Sign up to see photos and videos from your friends.</p>
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
              type="text"
              name="fullName"
              placeholder="Full Name"
              value={formData.fullName}
              onChange={handleChange}
              className={styles.input}
              required
            />
          </div>

          <div className={styles.inputGroup}>
            <input
              type="text"
              name="username"
              placeholder="Username"
              value={formData.username}
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
            className={styles.signupButton}
          >
            {loading ? 'Signing up...' : 'Sign Up'}
          </button>
        </form>

        <div className={styles.terms}>
          <p>
            By signing up, you agree to our{' '}
            <Link href="/terms">Terms</Link>,{' '}
            <Link href="/privacy">Privacy Policy</Link> and{' '}
            <Link href="/cookies">Cookies Policy</Link>.
          </p>
        </div>
      </div>

      <div className={styles.loginBox}>
        <p>
          Have an account?{' '}
          <Link href="/login" className={styles.loginLink}>
            Log in
          </Link>
        </p>
      </div>

      <div className={styles.footer}>
        <p>InstaApp clone</p>
      </div>
    </div>
  );
}
