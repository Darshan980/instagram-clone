'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isTokenValid } from '../utils/auth';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Check if user is already logged in
    if (isTokenValid()) {
      router.push('/dashboard');
    } else {
      router.push('/login');
    }
  }, [router]);

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh',
      backgroundColor: '#fafafa'
    }}>
      <div>Redirecting...</div>
    </div>
  );
}