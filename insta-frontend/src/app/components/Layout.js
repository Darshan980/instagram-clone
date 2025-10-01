// src/app/components/Layout.js
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isTokenValid, getCurrentUserProfile, logout } from '../../utils/auth';
import Sidebar from '../dashboard/components/Sidebar';
import CreateSidebar from '../dashboard/components/CreateSidebar';
import styles from '../dashboard/dashboard.module.css';

// Cache user data outside component to persist across route changes
let cachedUser = null;

export default function Layout({ children }) {
  const [user, setUser] = useState(cachedUser);
  const [showCreate, setShowCreate] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!isTokenValid()) {
      router.push('/login');
      return;
    }

    // Only fetch if we don't have cached user
    if (!cachedUser) {
      getCurrentUserProfile()
        .then(result => {
          if (result.success) {
            const userData = result.data?.user || result.user || result.data;
            cachedUser = userData;
            setUser(userData);
          } else {
            router.push('/login');
          }
        })
        .catch(() => router.push('/login'));
    }
  }, [router]);

  const handleLogout = () => {
    cachedUser = null; // Clear cache on logout
    logout();
  };

  const handleCreateClick = () => {
    setShowCreate(!showCreate);
  };

  const handleCreateOptionClick = (path) => {
    router.push(path);
    setShowCreate(false);
  };

  if (!user) return null;

  return (
    <div className={styles.container}>
      <Sidebar 
        user={user}
        onLogout={handleLogout}
        onCreateClick={handleCreateClick}
        showCreateActive={showCreate}
      />

      {showCreate && (
        <CreateSidebar 
          onClose={() => setShowCreate(false)}
          onOptionClick={handleCreateOptionClick}
        />
      )}

      <main className={styles.main}>
        <div className={`${styles.mainContent} ${styles.fullWidth}`}>
          {children}
        </div>
      </main>
    </div>
  );
}
