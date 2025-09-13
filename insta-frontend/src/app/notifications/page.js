'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  isTokenValid, 
  getNotifications, 
  markNotificationAsRead, 
  markAllNotificationsAsRead,
  deleteNotification,
  getPost,
  getPostComments,
  toggleLikePost,
  addComment
} from '../../utils/auth';
import Layout from '../components/Layout';
import PostModal from '../components/PostModal'; // Import the PostModal component
import styles from './notifications.module.css';

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  
  // PostModal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState(null);
  
  const router = useRouter();

  // API object to pass to PostModal
  const api = {
    getPost,
    getPostComments,
    toggleLikePost,
    addComment
  };

  useEffect(() => {
    // Check if user is authenticated
    if (!isTokenValid()) {
      router.push('/login');
      return;
    }

    fetchNotifications();
  }, [router]);

  const fetchNotifications = async (pageNum = 1, append = false) => {
    try {
      if (pageNum === 1) setLoading(true);
      else setLoadingMore(true);

      const result = await getNotifications(pageNum, 20);
      
      if (result.success) {
        const { notifications: newNotifications, unreadCount: newUnreadCount, pagination } = result.data;
        
        if (append) {
          setNotifications(prev => [...prev, ...newNotifications]);
        } else {
          setNotifications(newNotifications);
        }
        
        setUnreadCount(newUnreadCount);
        setHasMore(pagination.hasNextPage);
        setPage(pageNum);
      } else {
        setError(result.error);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
      setError('Failed to load notifications');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleMarkAsRead = async (notificationId) => {
    try {
      const result = await markNotificationAsRead(notificationId);
      if (result.success) {
        setNotifications(prev => 
          prev.map(notification => 
            notification._id === notificationId 
              ? { ...notification, isRead: true }
              : notification
          )
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const result = await markAllNotificationsAsRead();
      if (result.success) {
        setNotifications(prev => 
          prev.map(notification => ({ ...notification, isRead: true }))
        );
        setUnreadCount(0);
      }
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const handleDeleteNotification = async (notificationId) => {
    try {
      const result = await deleteNotification(notificationId);
      if (result.success) {
        const deletedNotification = notifications.find(n => n._id === notificationId);
        setNotifications(prev => prev.filter(n => n._id !== notificationId));
        
        if (deletedNotification && !deletedNotification.isRead) {
          setUnreadCount(prev => Math.max(0, prev - 1));
        }
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const loadMore = () => {
    if (hasMore && !loadingMore) {
      fetchNotifications(page + 1, true);
    }
  };

  const formatTimeAgo = (dateString) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInSeconds = Math.floor((now - date) / 1000);

    if (diffInSeconds < 60) return 'just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    return date.toLocaleDateString();
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'like': return '❤️';
      case 'comment': return '💬';
      case 'follow': return '👤';
      default: return '🔔';
    }
  };

  const handlePostClick = (notification) => {
    // Only open modal for post-related notifications
    if (notification.postId && notification.postId._id) {
      setSelectedPostId(notification.postId._id);
      setIsModalOpen(true);
      
      // Mark as read when opening the post
      if (!notification.isRead) {
        handleMarkAsRead(notification._id);
      }
    }
  };

  const handleProfileClick = (notification) => {
    // For follow notifications, navigate to profile
    if (notification.type === 'follow' && notification.senderId?.username) {
      router.push(`/profile/${notification.senderId.username}`);
      
      // Mark as read when navigating
      if (!notification.isRead) {
        handleMarkAsRead(notification._id);
      }
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedPostId(null);
  };

  if (loading) {
    return (
      <Layout>
        <div className={styles.container}>
          <div className={styles.header}>
            <h1>Notifications</h1>
          </div>
          <div className={styles.loading}>Loading notifications...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1>Notifications</h1>
          {unreadCount > 0 && (
            <button 
              onClick={handleMarkAllAsRead}
              className={styles.markAllButton}
            >
              Mark all as read ({unreadCount})
            </button>
          )}
        </div>

        {error && (
          <div className={styles.error}>
            {error}
          </div>
        )}

        <div className={styles.notificationsList}>
          {notifications.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>🔔</div>
              <h3>No notifications yet</h3>
              <p>When someone likes your posts, comments, or follows you, you'll see it here.</p>
            </div>
          ) : (
            <>
              {notifications.map((notification) => (
                <div key={notification._id}>
                  <div 
                    className={`${styles.notification} ${!notification.isRead ? styles.unread : ''}`}
                    onClick={() => {
                      if (notification.postId) {
                        handlePostClick(notification);
                      } else if (notification.type === 'follow') {
                        handleProfileClick(notification);
                      }
                    }}
                    style={{ 
                      cursor: notification.postId || notification.type === 'follow' ? 'pointer' : 'default' 
                    }}
                  >
                    <div className={styles.notificationIcon}>
                      {getNotificationIcon(notification.type)}
                    </div>
                    
                    <div className={styles.notificationContent}>
                      <div className={styles.notificationText}>
                        <span className={styles.senderName}>
                          {notification.senderId?.fullName || notification.senderId?.username || 'Someone'}
                        </span>
                        <span className={styles.message}>
                          {notification.type === 'like' && ' liked your post'}
                          {notification.type === 'comment' && ' commented on your post'}
                          {notification.type === 'follow' && ' started following you'}
                        </span>
                      </div>
                      <div className={styles.notificationTime}>
                        {formatTimeAgo(notification.createdAt)}
                      </div>
                    </div>

                    {notification.postId && notification.postId.imageUrl && (
                      <div className={styles.postPreview}>
                        <img 
                          src={notification.postId.imageUrl} 
                          alt="Post preview"
                          className={styles.postImage}
                        />
                      </div>
                    )}

                    <div className={styles.notificationActions}>
                      {!notification.isRead && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMarkAsRead(notification._id);
                          }}
                          className={styles.markReadButton}
                          title="Mark as read"
                        >
                          ✓
                        </button>
                      )}
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteNotification(notification._id);
                        }}
                        className={styles.deleteButton}
                        title="Delete notification"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {hasMore && (
                <div className={styles.loadMoreContainer}>
                  <button 
                    onClick={loadMore}
                    disabled={loadingMore}
                    className={styles.loadMoreButton}
                  >
                    {loadingMore ? 'Loading...' : 'Load More'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Post Modal */}
        <PostModal
          postId={selectedPostId}
          isOpen={isModalOpen}
          onClose={closeModal}
          api={api}
        />
      </div>
    </Layout>
  );
}