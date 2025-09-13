// src/app/components/Layout.js
'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { isTokenValid, getCurrentUserProfile, logout } from '../../utils/auth';
import NotificationBadge from '../../components/NotificationBadge';
import styles from '../dashboard/dashboard.module.css';

export default function Layout({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreateSidebar, setShowCreateSidebar] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Check if user is authenticated
    if (!isTokenValid()) {
      router.push('/login');
      return;
    }

    // Fetch user profile
    const fetchUserProfile = async () => {
      try {
        const result = await getCurrentUserProfile();
        if (result.success) {
          const userData = result.data?.user || result.user || result.data;
          setUser(userData);
        } else {
          // Token might be invalid, redirect to login
          router.push('/login');
        }
      } catch (error) {
        console.error('Error fetching user profile:', error);
        router.push('/login');
      } finally {
        setLoading(false);
      }
    };

    fetchUserProfile();
  }, [router]);

  const handleLogout = () => {
    logout();
  };

  // Helper function to check if nav item is active
  const isActiveRoute = (route) => {
    return pathname === route || pathname.startsWith(route + '/');
  };

  const toggleCreateSidebar = () => {
    setShowCreateSidebar(!showCreateSidebar);
  };

  const handleCreateOptionClick = (path) => {
    router.push(path);
    setShowCreateSidebar(false);
  };

  // Close sidebar when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showCreateSidebar && !event.target.closest(`.${styles.createSidebar}`) && !event.target.closest(`.${styles.createButton}`)) {
        setShowCreateSidebar(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showCreateSidebar]);

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner}></div>
        <p>Loading your feed...</p>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect to login
  }

  return (
    <div className={styles.container}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarContent}>
          <h1 className={styles.logo}>Instagram</h1>
          
          <nav className={styles.nav}>
            <Link href="/dashboard" className={`${styles.navItem} ${isActiveRoute('/dashboard') ? styles.active : ''}`}>
              <span className={styles.navIcon}>🏠</span>
              <span className={styles.navText}>Home</span>
            </Link>
            <Link href="/search" className={`${styles.navItem} ${isActiveRoute('/search') ? styles.active : ''}`}>
              <span className={styles.navIcon}>🔍</span>
              <span className={styles.navText}>Search</span>
            </Link>
            <Link href="/explore" className={`${styles.navItem} ${isActiveRoute('/explore') ? styles.active : ''}`}>
              <span className={styles.navIcon}>🧭</span>
              <span className={styles.navText}>Explore</span>
            </Link>
            <Link href="/reels" className={`${styles.navItem} ${isActiveRoute('/reels') ? styles.active : ''}`}>
              <span className={styles.navIcon}>🎬</span>
              <span className={styles.navText}>Reels</span>
            </Link>
            <Link href="/messages" className={`${styles.navItem} ${isActiveRoute('/messages') ? styles.active : ''}`}>
              <div className={styles.navIconContainer}>
                <span className={styles.navIcon}>✈️</span>
                <NotificationBadge type="messages" />
              </div>
              <span className={styles.navText}>Messages</span>
            </Link>
            <Link href="/notifications" className={`${styles.navItem} ${isActiveRoute('/notifications') ? styles.active : ''}`}>
              <div className={styles.navIconContainer}>
                <span className={styles.navIcon}>❤️</span>
                <NotificationBadge type="notifications" />
              </div>
              <span className={styles.navText}>Notifications</span>
            </Link>
            <button 
              onClick={toggleCreateSidebar} 
              className={`${styles.navItem} ${styles.createButton} ${showCreateSidebar ? styles.active : ''}`}
            >
              <span className={styles.navIcon}>➕</span>
              <span className={styles.navText}>Create</span>
            </button>
            <Link href={`/profile/${user.username}`} className={`${styles.navItem} ${isActiveRoute(`/profile/${user.username}`) ? styles.active : ''}`}>
              <span className={styles.navIcon}>👤</span>
              <span className={styles.navText}>Profile</span>
            </Link>
          </nav>

          <div className={styles.sidebarBottom}>
            <button onClick={handleLogout} className={styles.logoutButton}>
              <span className={styles.navIcon}>🚪</span>
              <span className={styles.navText}>Logout</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Create Sidebar */}
      {showCreateSidebar && (
        <>
          <div className={styles.createOverlay} onClick={toggleCreateSidebar}></div>
          <aside className={styles.createSidebar}>
            <div className={styles.createSidebarContent}>
              <div className={styles.createHeader}>
                <h3>Create</h3>
                <button onClick={toggleCreateSidebar} className={styles.closeButton}>
                  ✕
                </button>
              </div>
              
              <div className={styles.createOptions}>
                <button 
                  onClick={() => handleCreateOptionClick('/create')}
                  className={styles.createOption}
                >
                  <span className={styles.createIcon}>📝</span>
                  <div className={styles.createOptionText}>
                    <span className={styles.createOptionTitle}>Post</span>
                    <span className={styles.createOptionDesc}>Share a photo or video</span>
                  </div>
                </button>
                
                <button 
                  onClick={() => handleCreateOptionClick('/create-reel')}
                  className={styles.createOption}
                >
                  <span className={styles.createIcon}>🎥</span>
                  <div className={styles.createOptionText}>
                    <span className={styles.createOptionTitle}>Reel</span>
                    <span className={styles.createOptionDesc}>Create a short video</span>
                  </div>
                </button>
                
                <button 
                  onClick={() => handleCreateOptionClick('/create-story')}
                  className={styles.createOption}
                >
                  <span className={styles.createIcon}>📸</span>
                  <div className={styles.createOptionText}>
                    <span className={styles.createOptionTitle}>Story</span>
                    <span className={styles.createOptionDesc}>Share a moment</span>
                  </div>
                </button>
              </div>
            </div>
          </aside>
        </>
      )}

      <main className={styles.main}>
        <div className={`${styles.mainContent} ${styles.fullWidth}`}>
          {children}
        </div>
      </main>
    </div>
  );
}