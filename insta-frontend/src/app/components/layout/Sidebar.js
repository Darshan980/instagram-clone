// dashboard/components/Sidebar.js
'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import styles from '../../dashboard/dashboard.module.css';

export default function Sidebar({ user, onLogout, onCreateClick, showCreateActive }) {
  const router = useRouter();

  return (
    <>
      {/* Desktop/Tablet Sidebar - Hidden on mobile */}
      <aside className={`${styles.sidebar} ${styles.desktopSidebar}`}>
        <div className={styles.sidebarContent}>
          <h1 className={styles.logo}>Instagram</h1>
          
          <nav className={styles.nav}>
            <Link href="/" className={styles.navItem}>
              <span className={styles.navIcon}>🏠</span>
              <span className={styles.navText}>Home</span>
            </Link>
            <Link href="/search" className={styles.navItem}>
              <span className={styles.navIcon}>🔍</span>
              <span className={styles.navText}>Search</span>
            </Link>
            <Link href="/explore" className={styles.navItem}>
              <span className={styles.navIcon}>🧭</span>
              <span className={styles.navText}>Explore</span>
            </Link>
            <Link href="/reels" className={styles.navItem}>
              <span className={styles.navIcon}>🎬</span>
              <span className={styles.navText}>Reels</span>
            </Link>
 .            <Link href="/live" className={styles.navItem}>
              <span className={styles.navIcon}>🔴</span>
              <span className={styles.navText}>Live</span>
            </Link>
            <Link href="/messages" className={styles.navItem}>
              <span className={styles.navIcon}>✈���</span>
              <span className={styles.navText}>Messages</span>
            </Link>
            <Link href="/notifications" className={styles.navItem}>
              <span className={styles.navIcon}>❤️</span>
              <span className={styles.navText}>Notifications</span>
            </Link>
            <button 
              onClick={onCreateClick}
              className={`${styles.navItem} ${styles.createButton} ${showCreateActive ? styles.active : ''}`}
            >
              <span className={styles.navIcon}>➕</span>
              <span className={styles.navText}>Create</span>
            </button>
            <Link href={`/profile/${user.username}`} className={styles.navItem}>
              <span className={styles.navIcon}>👤</span>
              <span className={styles.navText}>Profile</span>
            </Link>
          </nav>

          <div className={styles.sidebarBottom}>
            <button onClick={onLogout} className={styles.logoutButton}>
              <span className={styles.navIcon}>🚪</span>
              <span className={styles.navText}>Logout</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Bottom Navigation */}
      <aside className={`${styles.sidebar} ${styles.mobileNav}`}>
        <div className={styles.sidebarContent}>
          <nav className={styles.nav}>
            <Link href="/" className={styles.navItem}>
              <span className={styles.navIcon}>🏠</span>
            </Link>
            <Link href="/search" className={styles.navItem}>
              <span className={styles.navIcon}>🔍</span>
            </Link>
            <button 
              onClick={onCreateClick}
              className={`${styles.navItem} ${styles.createButton}`}
            >
              <span className={styles.navIcon}>➕</span>
            </button>
            <Link href="/live" className={styles.navItem}>
              <span className={styles.navIcon}>🔴</span>
            </Link>
            <Link href="/reels" className={styles.navItem}>
              <span className={styles.navIcon}>🎬</span>
            </Link>
            <Link href={`/profile/${user.username}`} className={styles.navItem}>
              <span className={styles.navIcon}>👤</span>
            </Link>
          </nav>
        </div>
      </aside>

      {/* Floating Messages Button (Mobile Only) */}
      <button 
        onClick={() => router.push('/messages')}
        className={styles.floatingMessagesButton}
        aria-label="Messages"
      >
        ✈️
      </button>
    </>
  );
}
