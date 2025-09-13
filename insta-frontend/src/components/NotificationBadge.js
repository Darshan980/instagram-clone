// components/NotificationBadge.js
'use client';

import { useState, useEffect } from 'react';
import { notificationAPI } from '../utils/notifications';
import styles from './NotificationBadge.module.css';

export default function NotificationBadge({ type = 'notifications', className = '' }) {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Initialize API token
    if (typeof window !== 'undefined') {
      notificationAPI.initializeFromStorage();
    }

    // Load initial count
    loadCount();

    // Set up polling for real-time updates
    const interval = setInterval(loadCount, 30000); // Poll every 30 seconds

    return () => clearInterval(interval);
  }, [type]);

  const loadCount = async () => {
    try {
      let response;
      
      if (type === 'notifications') {
        response = await notificationAPI.getUnreadNotificationCount();
        setCount(response.unreadCount || 0);
      } else if (type === 'messages') {
        response = await notificationAPI.getUnreadMessageCount();
        setCount(response.unreadCount || 0);
      } else if (type === 'combined') {
        response = await notificationAPI.getCombinedCounts();
        setCount(response.total || 0);
      }
      
      setLoading(false);
    } catch (error) {
      console.error(`Error loading ${type} count:`, error);
      setCount(0);
      setLoading(false);
    }
  };

  // Don't render if no count or loading
  if (loading || count === 0) {
    return null;
  }

  // Format count display (show 99+ for counts over 99)
  const displayCount = count > 99 ? '99+' : count.toString();

  return (
    <span className={`${styles.badge} ${className}`}>
      {displayCount}
    </span>
  );
}