"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { isTokenValid, getCurrentUserProfile } from '../../utils/auth';
import Layout from '../components/Layout';
import ReelCard from './components/ReelCard';
import CommentsModal from './components/CommentsModal';
import ErrorMessage from './components/ErrorMessage';
import EmptyState from './components/EmptyState';
import { useReelsData } from './hooks/useReelsData';
import { useViewTracking } from './hooks/useViewTracking';
import styles from './reels.module.css';

const ReelsFeed = () => {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState(null);
  const [showComments, setShowComments] = useState(false);
  const [currentReelId, setCurrentReelId] = useState(null);
  const containerRef = useRef(null);

  const {
    reels,
    loading,
    error,
    hasNextPage,
    currentPage,
    loadReels,
    toggleLike,
    addComment: submitComment,
    shareReel,
    setError
  } = useReelsData();

  const { viewedReels, trackView } = useViewTracking(reels);

  useEffect(() => {
    if (!isTokenValid()) {
      router.push('/login');
      return;
    }
    fetchCurrentUser();
    loadReels();
  }, []);

  const fetchCurrentUser = async () => {
    const result = await getCurrentUserProfile();
    if (result.success) setCurrentUser(result.data.user);
  };

  const openComments = (reelId) => {
    setCurrentReelId(reelId);
    setShowComments(true);
  };

  const closeComments = () => {
    setShowComments(false);
    setCurrentReelId(null);
  };

  const handleAddComment = async (text) => {
    await submitComment(currentReelId, text);
  };

  const currentReel = reels.find(r => r._id === currentReelId);

  if (loading && reels.length === 0) {
    return (
      <Layout>
        <div className={styles.loadingContainer}>
          <div className={styles.spinner}></div>
          <p>Loading reels...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className={styles.reelsContainer}>
        {error && (
          <ErrorMessage 
            error={error} 
            onRetry={() => { setError(''); loadReels(); }} 
          />
        )}

        <div className={styles.mainContainer} ref={containerRef}>
          {reels.length === 0 && !error ? (
            <EmptyState onCreateClick={() => router.push('/create-reel')} />
          ) : (
            <div className={styles.reelsWrapper}>
              {reels.map((reel) => (
                <ReelCard
                  key={reel._id}
                  reel={reel}
                  onLike={toggleLike}
                  onComment={openComments}
                  onShare={shareReel}
                  onView={trackView}
                  isViewed={viewedReels.has(reel._id)}
                />
              ))}
            </div>
          )}

          {hasNextPage && !loading && reels.length > 0 && (
            <div className={styles.loadMore}>
              <button onClick={() => loadReels(currentPage + 1)}>
                Load More
              </button>
            </div>
          )}
        </div>

        {showComments && currentReel && (
          <CommentsModal
            reel={currentReel}
            currentUser={currentUser}
            onClose={closeComments}
            onAddComment={handleAddComment}
          />
        )}
      </div>
    </Layout>
  );
};

export default ReelsFeed;
