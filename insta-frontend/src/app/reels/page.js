"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Heart, MessageCircle, Share, Eye, Music, Plus, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { isTokenValid, getCurrentUserProfile } from '../../utils/auth';
import Layout from '../components/Layout';
import styles from './reels.module.css';

const ReelsFeed = () => {
  const router = useRouter();
  const [reels, setReels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(true);
  const [showComments, setShowComments] = useState(false);
  const [currentReelId, setCurrentReelId] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [loadingComments, setLoadingComments] = useState(false);
  const [viewedReels, setViewedReels] = useState(new Set()); // Track viewed reels
  const containerRef = useRef(null);

  // Backend API base URL
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://instagram-clone-0t5v.onrender.com';

  useEffect(() => {
    // Check authentication first
    if (!isTokenValid()) {
      router.push('/login');
      return;
    }
    
    fetchCurrentUser();
    loadReels();
  }, [router]);

  const fetchCurrentUser = async () => {
    try {
      const result = await getCurrentUserProfile();
      if (result.success) {
        setCurrentUser(result.data.user);
      } else {
        console.error('Failed to fetch user profile');
      }
    } catch (error) {
      console.error('Error fetching current user:', error);
    }
  };

  const getAuthToken = () => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('instagram_token') || 
             localStorage.getItem('instagram-token') || 
             localStorage.getItem('auth-token') || 
             localStorage.getItem('token') ||
             localStorage.getItem('jwt-token');
    }
    return null;
  };

  const loadReels = async (page = 1) => {
    try {
      setLoading(true);
      setError('');
      
      const authToken = getAuthToken();
      
      if (!authToken) {
        throw new Error('Authentication required. Please log in first.');
      }

      console.log('Fetching reels from API:', `${API_BASE_URL}/reels/feed`);

      const response = await fetch(`${API_BASE_URL}/reels/feed?page=${page}&limit=10`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('Reels API response status:', response.status);

      if (!response.ok) {
        let errorMessage = 'Failed to load reels';
        
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
          
          if (errorData.code === 'NO_TOKEN' || errorData.code === 'INVALID_TOKEN' || response.status === 401) {
            throw new Error('Session expired. Please log in again.');
          }
        } catch (jsonError) {
          if (response.status === 404) {
            errorMessage = 'Reels API not found. Make sure the server is running.';
          } else if (response.status >= 500) {
            errorMessage = `Server error (${response.status}): ${response.statusText}`;
          }
        }
        
        throw new Error(errorMessage);
      }

      const result = await response.json();
      console.log('Reels loaded successfully:', result);

      if (result.success) {
        if (page === 1) {
          setReels(result.reels || []);
        } else {
          setReels(prev => [...prev, ...(result.reels || [])]);
        }
        
        setHasNextPage(result.pagination?.hasNextPage || false);
        setCurrentPage(page);
      } else {
        throw new Error(result.message || 'Failed to load reels');
      }

    } catch (error) {
      console.error('Error loading reels:', error);
      setError(error.message || 'Failed to load reels. Please try again.');
      
      // Redirect to login if authentication error
      if (error.message.includes('log in') || 
          error.message.includes('Session expired') ||
          error.message.includes('Authentication')) {
        setTimeout(() => {
          router.push('/login');
        }, 3000);
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleLike = async (reelId) => {
    try {
      const authToken = getAuthToken();
      
      if (!authToken) {
        throw new Error('Authentication required');
      }

      const response = await fetch(`${API_BASE_URL}/reels/${reelId}/like`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to toggle like');
      }

      const result = await response.json();
      
      if (result.success) {
        setReels(prevReels => 
          prevReels.map(reel => {
            if (reel._id === reelId) {
              return {
                ...reel,
                isLikedByUser: result.isLiked,
                likesCount: result.likesCount
              };
            }
            return reel;
          })
        );
      }

    } catch (error) {
      console.error('Error toggling like:', error);
      // Show a temporary error message or handle silently
    }
  };

  // FIXED: Enhanced view tracking with better logic
  const trackView = async (reelId) => {
    try {
      // Don't track if already viewed in this session
      if (viewedReels.has(reelId)) {
        console.log(`📊 Reel ${reelId} already viewed in this session`);
        return;
      }

      const authToken = getAuthToken();
      
      if (!authToken) {
        console.log('⚠️ No auth token for view tracking');
        return;
      }

      console.log(`📊 Tracking view for reel ${reelId}`);

      // Method 1: Use the dedicated view tracking endpoint
      const response = await fetch(`${API_BASE_URL}/reels/${reelId}/view`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          // Update the reel in the local state with updated view count
          setReels(prevReels => 
            prevReels.map(reel => {
              if (reel._id === reelId) {
                return {
                  ...reel,
                  viewsCount: result.viewsCount
                };
              }
              return reel;
            })
          );
          
          // Mark as viewed in this session
          setViewedReels(prev => new Set([...prev, reelId]));
          console.log(`✅ View tracked successfully for reel ${reelId}. New count: ${result.viewsCount}`);
        }
      } else {
        console.error('❌ Failed to track view:', response.status);
      }
    } catch (error) {
      console.error('❌ Error tracking view:', error);
    }
  };

  // FIXED: Alternative method - track view when reel comes into viewport
  const trackViewOnVisibility = async (reelId) => {
    try {
      // Don't track if already viewed
      if (viewedReels.has(reelId)) return;

      const authToken = getAuthToken();
      if (!authToken) return;

      // Method 2: Fetch the reel to trigger view tracking
      const response = await fetch(`${API_BASE_URL}/reels/${reelId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.reel) {
          // Update the reel in the local state
          setReels(prevReels => 
            prevReels.map(reel => {
              if (reel._id === reelId) {
                return {
                  ...reel,
                  viewsCount: result.reel.viewsCount
                };
              }
              return reel;
            })
          );
          
          // Mark as viewed
          setViewedReels(prev => new Set([...prev, reelId]));
          console.log(`✅ View tracked via fetch for reel ${reelId}. Count: ${result.reel.viewsCount}`);
        }
      }
    } catch (error) {
      console.error('Error tracking view on visibility:', error);
    }
  };

  const openComments = async (reelId) => {
    try {
      const reel = reels.find(r => r._id === reelId);
      setCurrentReelId(reelId);
      setShowComments(true);

      // Set comments from the reel data that already includes comments
      if (reel && reel.comments) {
        setComments(reel.comments);
      } else {
        // Fallback: fetch comments separately if not included
        await fetchComments(reelId);
      }
    } catch (error) {
      console.error('Error opening comments:', error);
    }
  };

  const fetchComments = async (reelId) => {
    try {
      setLoadingComments(true);
      const authToken = getAuthToken();
      
      if (!authToken) {
        throw new Error('Authentication required');
      }

      const response = await fetch(`${API_BASE_URL}/reels/${reelId}/comments`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch comments');
      }

      const result = await response.json();
      
      if (result.success) {
        setComments(result.comments || []);
      }

    } catch (error) {
      console.error('Error fetching comments:', error);
    } finally {
      setLoadingComments(false);
    }
  };

  const closeComments = () => {
    setShowComments(false);
    setCurrentReelId(null);
    setComments([]);
    setCommentText('');
  };

  const addComment = async () => {
    if (!commentText.trim() || !currentReelId) return;

    try {
      const authToken = getAuthToken();
      
      if (!authToken) {
        throw new Error('Authentication required');
      }

      const response = await fetch(`${API_BASE_URL}/reels/${currentReelId}/comment`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: commentText.trim()
        })
      });

      if (!response.ok) {
        throw new Error('Failed to add comment');
      }

      const result = await response.json();
      
      if (result.success) {
        const newComment = {
          _id: result.comment._id,
          user: result.comment.user,
          text: result.comment.text,
          createdAt: result.comment.createdAt
        };

        // Add comment to local state
        setComments(prev => [newComment, ...prev]);
        
        // Update reel comments count in the main feed
        setReels(prevReels => 
          prevReels.map(reel => {
            if (reel._id === currentReelId) {
              return {
                ...reel,
                commentsCount: result.commentsCount,
                comments: [newComment, ...(reel.comments || [])]
              };
            }
            return reel;
          })
        );
        
        setCommentText('');
      }

    } catch (error) {
      console.error('Error adding comment:', error);
      // Handle error silently or show message
    }
  };

  const shareReel = async (reelId) => {
    try {
      const authToken = getAuthToken();
      
      if (authToken) {
        // Track share on backend
        fetch(`${API_BASE_URL}/reels/${reelId}/share`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }).catch(console.error);
      }

      const reelUrl = `${window.location.origin}/reel/${reelId}`;
      
      if (navigator.share) {
        try {
          await navigator.share({
            title: 'Check out this reel!',
            url: reelUrl
          });
        } catch (err) {
          console.log('Share cancelled');
        }
      } else {
        try {
          await navigator.clipboard.writeText(reelUrl);
          // You might want to show a toast notification here
          console.log('Reel link copied to clipboard!');
        } catch (err) {
          console.error('Failed to copy link');
        }
      }
    } catch (error) {
      console.error('Error sharing reel:', error);
    }
  };

  const formatCount = (count) => {
    if (count < 1000) return count.toString();
    if (count < 1000000) return (count / 1000).toFixed(1) + 'K';
    return (count / 1000000).toFixed(1) + 'M';
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    
    return date.toLocaleDateString();
  };

  // Better avatar URL generation with proper size
  const getUserAvatar = (user, size = 150) => {
    if (user?.profilePicture) {
      return user.profilePicture;
    }
    const name = encodeURIComponent(user?.fullName || user?.username || 'User');
    return `https://ui-avatars.com/api/?name=${name}&size=${size}&background=0095f6&color=fff`;
  };

  const handleCreateReel = () => {
    router.push('/create-reel');
  };

  // FIXED: Enhanced video handling with proper view tracking
  const handleVideoClick = (e, reelId) => {
    const video = e.target;
    
    if (video.paused) {
      // Pause all other videos
      document.querySelectorAll('video').forEach(v => {
        if (v !== video) v.pause();
      });
      video.play();
      
      // Track view when video starts playing
      trackView(reelId);
    } else {
      video.pause();
    }
  };

  // ADDED: Intersection Observer for automatic view tracking
  useEffect(() => {
    const observerOptions = {
      root: null,
      rootMargin: '0px',
      threshold: 0.5 // Trigger when 50% of video is visible
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const reelId = entry.target.getAttribute('data-reel-id');
          if (reelId) {
            // Track view when reel comes into view
            setTimeout(() => {
              trackViewOnVisibility(reelId);
            }, 1000); // Wait 1 second before tracking view
          }
        }
      });
    }, observerOptions);

    // Observe all video elements
    const videos = document.querySelectorAll('[data-reel-id]');
    videos.forEach(video => observer.observe(video));

    return () => {
      observer.disconnect();
    };
  }, [reels]);

  if (loading && reels.length === 0) {
    return (
      <Layout>
        <div className={styles.loadingContainer}>
          <div className={styles.loadingContent}>
            <div className={styles.spinner}></div>
            <p className={styles.loadingText}>Loading reels...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className={styles.reelsContainer}>
        {/* Page Header */}
        <div className={styles.pageHeader}>
          <h1 className={styles.title}>Reels</h1>
          <button 
            onClick={handleCreateReel}
            className={`${styles.createButton} ${styles.buttonHover}`}
          >
            <Plus size={16} />
            Create Reel
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className={styles.errorContainer}>
            <div className={styles.errorContent}>
              <AlertCircle size={24} />
              <p>{error}</p>
              <button 
                onClick={() => {
                  setError('');
                  loadReels();
                }}
                className={styles.retryButton}
              >
                Try Again
              </button>
            </div>
          </div>
        )}

        {/* Main Container */}
        <div className={styles.mainContainer} ref={containerRef}>
          <div className={styles.feedWrapper}>
            {!loading && reels.length === 0 && !error ? (
              // Empty State
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>
                  📹
                </div>
                <h3 className={styles.emptyTitle}>No reels yet</h3>
                <p className={styles.emptyDescription}>Be the first to create a reel and share your moment!</p>
                <button 
                  onClick={handleCreateReel}
                  className={`${styles.emptyButton} ${styles.buttonHover}`}
                >
                  <Plus size={16} />
                  Create Your First Reel
                </button>
              </div>
            ) : (
              // Reels Feed
              reels.map((reel) => (
                <div key={reel._id} className={`${styles.reelContainer} ${styles.fadeIn}`}>
                  {/* Video with view tracking attributes */}
                  <video 
                    className={styles.video}
                    src={reel.videoUrl}
                    poster={reel.thumbnailUrl}
                    muted
                    loop
                    playsInline
                    preload="metadata"
                    data-reel-id={reel._id} // For intersection observer
                    onClick={(e) => handleVideoClick(e, reel._id)}
                  />

                  {/* Overlay */}
                  <div className={styles.overlay}>
                    <div className={styles.overlayContent}>
                      {/* Reel Details */}
                      <div className={styles.reelDetails}>
                        {/* User Info */}
                        <div className={styles.userInfo}>
                          <img 
                            className={styles.avatar}
                            src={getUserAvatar(reel.user, 40)}
                            alt={reel.user?.username || 'User'}
                          />
                          <span className={styles.username}>{reel.user?.username || 'Unknown User'}</span>
                          <button className={`${styles.followButton} ${styles.buttonHover}`}>
                            Follow
                          </button>
                        </div>

                        {/* Caption */}
                        {reel.caption && (
                          <div className={styles.caption}>{reel.caption}</div>
                        )}

                        {/* Hashtags */}
                        {reel.hashtags && reel.hashtags.length > 0 && (
                          <div className={styles.hashtags}>
                            {reel.hashtags.map((tag, index) => (
                              <span key={index} className={styles.hashtag}>
                                {tag.startsWith('#') ? tag : `#${tag}`}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Music Info */}
                        {reel.musicTrack && (
                          <div className={styles.musicInfo}>
                            <Music size={12} className={styles.musicIcon} />
                            <span>{reel.musicTrack.name} - {reel.musicTrack.artist}</span>
                          </div>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div className={styles.actionButtons}>
                        {/* Like */}
                        <div>
                          <button 
                            onClick={() => toggleLike(reel._id)}
                            className={`${styles.actionButton} ${styles.buttonHover} ${
                              reel.isLikedByUser ? styles.liked : ''
                            }`}
                          >
                            <Heart size={20} fill={reel.isLikedByUser ? 'currentColor' : 'none'} />
                          </button>
                          <div className={styles.actionCount}>{formatCount(reel.likesCount || 0)}</div>
                        </div>

                        {/* Comment */}
                        <div>
                          <button 
                            onClick={() => openComments(reel._id)}
                            className={`${styles.actionButton} ${styles.buttonHover}`}
                          >
                            <MessageCircle size={20} />
                          </button>
                          <div className={styles.actionCount}>{formatCount(reel.commentsCount || 0)}</div>
                        </div>

                        {/* Share */}
                        <div>
                          <button 
                            onClick={() => shareReel(reel._id)}
                            className={`${styles.actionButton} ${styles.buttonHover}`}
                          >
                            <Share size={20} />
                          </button>
                          <div className={styles.actionCount}>{formatCount(reel.shares || 0)}</div>
                        </div>

                        {/* Views - FIXED: Now shows actual view count with proper tracking */}
                        <div>
                          <button 
                            className={styles.actionButton}
                            onClick={() => trackView(reel._id)} // Manual view tracking on click
                          >
                            <Eye size={20} />
                          </button>
                          <div className={styles.actionCount}>
                            {formatCount(reel.viewsCount || 0)}
                            {/* Show if viewed in this session */}
                            {viewedReels.has(reel._id) && (
                              <span className={styles.viewedIndicator}>•</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}

            {/* Load More */}
            {hasNextPage && !loading && (
              <div className={styles.loadMore}>
                <button 
                  onClick={() => loadReels(currentPage + 1)}
                  className={styles.loadMoreButton}
                >
                  Load More Reels
                </button>
              </div>
            )}

            {/* Loading More */}
            {loading && reels.length > 0 && (
              <div className={styles.loadingMore}>
                <div className={styles.spinner}></div>
                <p>Loading more reels...</p>
              </div>
            )}
          </div>
        </div>

        {/* Comments Modal - Proper avatar sizing */}
        {showComments && (
          <div className={styles.commentsModal}>
            <div className={`${styles.commentsContainer} ${styles.scaleIn}`}>
              {/* Header */}
              <div className={styles.commentsHeader}>
                <h3 className={styles.commentsTitle}>Comments ({comments.length})</h3>
                <button 
                  onClick={closeComments}
                  className={styles.closeButton}
                >
                  ×
                </button>
              </div>

              {/* Comments List */}
              <div className={styles.commentsList}>
                {loadingComments ? (
                  <div className={styles.loadingComments}>
                    <div className={styles.spinner}></div>
                    <p>Loading comments...</p>
                  </div>
                ) : comments.length === 0 ? (
                  <p className={styles.emptyComments}>
                    No comments yet. Be the first to comment!
                  </p>
                ) : (
                  comments.map(comment => (
                    <div key={comment._id} className={styles.comment}>
                      <img 
                        className={styles.commentAvatar}
                        src={getUserAvatar(comment.user, 40)} 
                        alt={comment.user?.username || 'User'}
                      />
                      <div className={styles.commentContent}>
                        <div className={styles.commentHeader}>
                          <span className={styles.commentUsername}>
                            {comment.user?.username || 'Unknown User'}
                          </span>
                          <span className={styles.commentTime}>
                            {formatTime(comment.createdAt)}
                          </span>
                        </div>
                        <div className={styles.commentText}>{comment.text}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Comment Input */}
              <div className={styles.commentInput}>
                <img 
                  className={styles.commentInputAvatar}
                  src={getUserAvatar(currentUser, 40)} 
                  alt={currentUser?.username || 'You'}
                />
                <input 
                  type="text"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Add a comment..."
                  className={styles.commentInputField}
                  onKeyPress={(e) => e.key === 'Enter' && addComment()}
                  maxLength={500}
                />
                <button 
                  onClick={addComment}
                  className={`${styles.postButton} ${styles.buttonHover}`}
                  disabled={!commentText.trim()}
                >
                  Post
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default ReelsFeed;
