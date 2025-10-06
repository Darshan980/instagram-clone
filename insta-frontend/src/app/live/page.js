'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import styles from './live.module.css';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:10000/api';

export default function LivePage() {
  const router = useRouter();
  const [activeStreams, setActiveStreams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [myActiveStream, setMyActiveStream] = useState(null);

  useEffect(() => {
    fetchActiveStreams();
    checkMyActiveStream();
  }, []);

  const fetchActiveStreams = async () => {
    try {
      const token = localStorage.getItem('instagram_token');
      if (!token) {
        router.push('/login');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/live/active`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      
      if (data.success) {
        setActiveStreams(data.data.streams || []);
      } else {
        setError(data.error || 'Failed to load streams');
      }
    } catch (err) {
      console.error('Error fetching streams:', err);
      setError('Failed to load live streams');
    } finally {
      setLoading(false);
    }
  };

  const checkMyActiveStream = async () => {
    try {
      const token = localStorage.getItem('instagram_token');
      if (!token) return;

      const response = await fetch(`${API_BASE_URL}/live/my/active`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      
      if (data.success && data.data.hasActiveStream) {
        setMyActiveStream(data.data.stream);
      }
    } catch (err) {
      console.error('Error checking active stream:', err);
    }
  };

  const handleStartStream = () => {
    router.push('/live/start');
  };

  const handleJoinStream = (streamId) => {
    router.push(`/live/${streamId}`);
  };

  const handleManageStream = () => {
    if (myActiveStream) {
      router.push(`/live/${myActiveStream._id}`);
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <p>Loading live streams...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>🔴 Live Streams</h1>
        <div className={styles.headerActions}>
          {myActiveStream ? (
            <button onClick={handleManageStream} className={styles.manageButton}>
              Manage Your Stream
            </button>
          ) : (
            <button onClick={handleStartStream} className={styles.startButton}>
              Go Live
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className={styles.error}>
          {error}
        </div>
      )}

      {myActiveStream && (
        <div className={styles.myStreamBanner}>
          <div className={styles.bannerContent}>
            <span className={styles.liveIndicator}>● LIVE</span>
            <span>You are currently streaming: {myActiveStream.title}</span>
            <span className={styles.viewerCount}>
              👁️ {myActiveStream.currentViewerCount} viewers
            </span>
          </div>
          <button onClick={handleManageStream} className={styles.bannerButton}>
            View Stream
          </button>
        </div>
      )}

      <div className={styles.content}>
        {activeStreams.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>📹</div>
            <h2>No Live Streams</h2>
            <p>Be the first to go live!</p>
            <button onClick={handleStartStream} className={styles.startButton}>
              Start Streaming
            </button>
          </div>
        ) : (
          <div className={styles.streamsGrid}>
            {activeStreams.map((stream) => (
              <div 
                key={stream._id} 
                className={styles.streamCard}
                onClick={() => handleJoinStream(stream._id)}
              >
                <div className={styles.streamThumbnail}>
                  <img 
                    src={stream.user.profilePicture || '/default-avatar.png'} 
                    alt={stream.user.username}
                    onError={(e) => { e.target.src = '/default-avatar.png'; }}
                  />
                  <div className={styles.liveBadge}>
                    <span className={styles.liveDot}>●</span>
                    LIVE
                  </div>
                  <div className={styles.viewerBadge}>
                    👁️ {stream.currentViewerCount}
                  </div>
                </div>
                
                <div className={styles.streamInfo}>
                  <div className={styles.streamUser}>
                    <img 
                      src={stream.user.profilePicture || '/default-avatar.png'} 
                      alt={stream.user.username}
                      className={styles.userAvatar}
                      onError={(e) => { e.target.src = '/default-avatar.png'; }}
                    />
                    <div>
                      <h3>{stream.user.fullName}</h3>
                      <p>@{stream.user.username}</p>
                    </div>
                  </div>
                  
                  <h4 className={styles.streamTitle}>{stream.title}</h4>
                  
                  {stream.description && (
                    <p className={styles.streamDescription}>{stream.description}</p>
                  )}
                  
                  <div className={styles.streamStats}>
                    <span>❤️ {stream.likeCount}</span>
                    <span>💬 {stream.commentCount}</span>
                    <span>👁️ {stream.totalViews} views</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
