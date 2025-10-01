// src/app/components/Layout.js
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isTokenValid, getCurrentUserProfile, logout } from '../../utils/auth';
import Sidebar from './layout/Sidebar';
import CreateSidebar from './layout/CreateSidebar';
import styles from '../dashboard/dashboard.module.css';

export default function Layout({ children }) {
  const [user, setUser] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!isTokenValid()) {
      router.push('/login');
      return;
    }

    getCurrentUserProfile()
      .then(result => {
        if (result.success) {
          setUser(result.data?.user || result.user || result.data);
        } else {
          router.push('/login');
        }
      })
      .catch(() => router.push('/login'));
  }, [router]);

  const handleLogout = () => {
    logout();
  };

  const handleCreateClick = () => {
    setShowCreate(!showCreate);
  };

  const handleCreateOptionClick = (path) => {
    router.push(path);
    setShowCreate(false);
  };

  // Don't render anything until we have user data
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
