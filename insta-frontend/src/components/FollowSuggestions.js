"use client";
import React, { useState, useEffect } from 'react';
import { User, UserPlus, X, RefreshCw, Users, Search } from 'lucide-react';
import styles from './FollowSuggestions.module.css';

// API configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

const getToken = () => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('instagram_token') || localStorage.getItem('token');
  }
  return null;
};

const isTokenValid = () => {
  const token = getToken();
  if (!token) return false;
  
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    
    const payload = JSON.parse(atob(parts[1]));
    const currentTime = Math.floor(Date.now() / 1000);
    
    return payload.exp > currentTime;
  } catch (error) {
    console.error('Token validation error:', error);
    return false;
  }
};

const apiRequest = async (endpoint, options = {}) => {
  const token = getToken();
  
  const defaultHeaders = {
    'Content-Type': 'application/json',
  };

  if (token && isTokenValid()) {
    defaultHeaders['Authorization'] = `Bearer ${token}`;
  }

  const config = {
    headers: defaultHeaders,
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  };

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
    
    let data;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    if (!response.ok) {
      if (response.status === 401) {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('instagram_token');
          localStorage.removeItem('token');
          window.location.href = '/login';
        }
        throw new Error('Authentication failed. Please log in again.');
      }
      
      const errorMessage = data?.message || data?.error || `HTTP error! status: ${response.status}`;
      return {
        success: false,
        error: errorMessage,
        status: response.status,
        data: data
      };
    }

    return {
      success: true,
      data,
      status: response.status
    };

  } catch (error) {
    console.error(`API Error for ${endpoint}:`, error);
    
    return {
      success: false,
      error: error.message || 'Network error occurred',
      status: error.status || 500
    };
  }
};

const getUserSuggestions = async (options = {}) => {
  const { page = 1, limit = 5 } = options;
  
  try {
    const result = await apiRequest(`/users/suggestions?page=${page}&limit=${limit}`);
    
    if (result.success) {
      const responseData = result.data?.data || result.data || {};
      const users = responseData.users || [];
      
      return {
        success: true,
        data: {
          users: Array.isArray(users) ? users : [],
          totalSuggestions: responseData.totalSuggestions || users.length,
          hasMore: responseData.hasMore || false,
          page: responseData.page || page
        }
      };
    } else {
      console.error('getUserSuggestions API error:', result.error);
      return {
        success: false,
        error: result.error || 'Failed to get user suggestions',
        data: {
          users: [],
          totalSuggestions: 0,
          hasMore: false,
          page: 1
        }
      };
    }
  } catch (error) {
    console.error('getUserSuggestions catch error:', error);
    return {
      success: false,
      error: 'Network error while getting suggestions',
      data: {
        users: [],
        totalSuggestions: 0,
        hasMore: false,
        page: 1
      }
    };
  }
};

const followUser = async (userId) => {
  let result = await apiRequest(`/users/follow/${userId}`, {
    method: 'POST',
  });

  if (!result.success && result.status === 404) {
    result = await apiRequest(`/users/${userId}/follow`, {
      method: 'POST',
    });
  }

  return result;
};

const FollowSuggestions = ({ limit = 5, showHeader = true, compact = false, sidebar = false }) => {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [followingStates, setFollowingStates] = useState({});
  const [error, setError] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);

  useEffect(() => {
    setMounted(true);
  }, []);

  const loadSuggestions = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const result = await getUserSuggestions({ page: 1, limit: limit * 2 });
      
      if (result.success) {
        const users = result.data?.users || [];
        setSuggestions(users);
        
        const initialStates = {};
        users.forEach(user => {
          if (user && user._id) {
            initialStates[user._id] = user.isFollowing || false;
          }
        });
        setFollowingStates(initialStates);
        
        if (users.length > 0) {
          setError(null);
        }
      } else {
        setError(result.error || 'Failed to load suggestions');
        if (!isRefresh) {
          setSuggestions([]);
        }
      }
    } catch (err) {
      const errorMessage = 'Network error occurred: ' + err.message;
      setError(errorMessage);
      if (!isRefresh) {
        setSuggestions([]);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
      setInitialLoad(false);
    }
  };

  const handleFollow = async (userId) => {
    setFollowingStates(prev => ({ ...prev, [userId]: 'pending' }));

    try {
      const result = await followUser(userId);
      
      if (result.success) {
        setFollowingStates(prev => ({ ...prev, [userId]: true }));
        setSuggestions(prev => prev.map(user => 
          user._id === userId 
            ? { ...user, isFollowing: true, followersCount: (user.followersCount || 0) + 1 }
            : user
        ));
      } else {
        setFollowingStates(prev => ({ ...prev, [userId]: false }));
        setError('Failed to follow user: ' + (result.error || 'Unknown error'));
      }
    } catch (err) {
      setFollowingStates(prev => ({ ...prev, [userId]: false }));
      setError('Network error occurred while following user');
      console.error('Follow error:', err);
    }
  };

  const handleDismiss = (userId) => {
    setSuggestions(prev => prev.filter(user => user._id !== userId));
    setFollowingStates(prev => {
      const newState = { ...prev };
      delete newState[userId];
      return newState;
    });
  };

  const formatFollowerCount = (count) => {
    if (!count || count === 0) return '0';
    
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    } else if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
  };

  const getProfileImageSrc = (user) => {
    if (user.profilePicture && user.profilePicture.startsWith('http')) {
      return user.profilePicture;
    }
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(user.fullName || user.username)}&background=e5e7eb&color=6b7280&size=96`;
  };

  useEffect(() => {
    if (mounted) {
      loadSuggestions();
    }
  }, [mounted]);

  if (!mounted) {
    return null;
  }

  const displaySuggestions = showAll ? suggestions : suggestions.slice(0, limit);
  const hasValidSuggestions = suggestions.length > 0;

  // Generate CSS class names
  const containerClass = sidebar ? styles.containerSidebar : styles.container;
  const titleClass = compact ? `${styles.title} ${styles.titleCompact}` : styles.title;
  const suggestionsListClass = compact ? `${styles.suggestionsList} ${styles.suggestionsListCompact}` : styles.suggestionsList;
  const loadingItemClass = compact ? `${styles.loadingItem} ${styles.loadingItemCompact}` : styles.loadingItem;
  const loadingAvatarClass = compact ? `${styles.loadingAvatar} ${styles.loadingAvatarCompact}` : styles.loadingAvatar;

  // Loading state for initial load
  if (initialLoad && loading) {
    return (
      <div className={containerClass}>
        <div className={styles.loadingState}>
          {showHeader && (
            <div className={styles.header}>
              <h2 className={titleClass}>Suggested for you</h2>
              <RefreshCw className={`${styles.spinning}`} size={16} />
            </div>
          )}
          <div className={suggestionsListClass}>
            {[...Array(limit)].map((_, i) => (
              <div key={i} className={loadingItemClass}>
                <div className={loadingAvatarClass}></div>
                <div className={styles.loadingContent}>
                  <div className={styles.loadingUsername}></div>
                  <div className={styles.loadingDescription}></div>
                </div>
                <div className={styles.loadingButton}></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Error state when no suggestions and there's an error
  if (!hasValidSuggestions && error && !loading) {
    return (
      <div className={containerClass}>
        <div className={styles.emptyState}>
          <Users className={styles.emptyIcon} />
          <p className={styles.emptyTitle}>Failed to load suggestions</p>
          <p className={styles.emptyDescription}>{error}</p>
          <button
            onClick={() => loadSuggestions()}
            className={styles.retryButton}
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  // Empty state when no suggestions but no error
  if (!hasValidSuggestions && !error && !loading) {
    return (
      <div className={containerClass}>
        <div className={styles.emptyState}>
          <Search className={styles.emptyIcon} />
          <p className={styles.emptyTitle}>No suggestions available</p>
          <p className={styles.emptyDescription}>Check back later for new suggestions</p>
          <button
            onClick={() => loadSuggestions()}
            className={styles.retryButton}
          >
            Refresh suggestions
          </button>
        </div>
      </div>
    );
  }

  // Main suggestions view
  return (
    <div className={containerClass}>
      {/* Header */}
      {showHeader && (
        <div className={styles.header}>
          <h2 className={titleClass}>Suggested for you</h2>
          <button
            onClick={() => loadSuggestions(true)}
            disabled={refreshing}
            className={styles.refreshButton}
          >
            <RefreshCw className={refreshing ? styles.spinning : ''} size={16} />
            <span>Refresh</span>
          </button>
        </div>
      )}

      {/* Error message */}
      {error && hasValidSuggestions && (
        <div className={styles.errorMessage}>
          <p>{error}</p>
        </div>
      )}

      {/* Suggestions list */}
      <div className={suggestionsListClass}>
        {displaySuggestions.map((user) => {
          const isFollowing = followingStates[user._id];
          const isPending = isFollowing === 'pending';
          const isNew = user.daysSinceJoined <= 30;

          // Generate item-specific CSS classes
          const suggestionItemClasses = [
            styles.suggestionItem,
            compact && styles.suggestionItemCompact,
            sidebar && styles.suggestionItemSidebar
          ].filter(Boolean).join(' ');

          const profilePictureClasses = [
            styles.profilePicture,
            compact && styles.profilePictureCompact
          ].filter(Boolean).join(' ');

          const usernameClasses = [
            styles.username,
            compact && styles.usernameCompact
          ].filter(Boolean).join(' ');

          const fullNameClasses = [
            styles.fullName,
            compact && styles.fullNameCompact
          ].filter(Boolean).join(' ');

          const followButtonClasses = [
            styles.followButton,
            compact && styles.followButtonCompact
          ].filter(Boolean).join(' ');

          const followingButtonClasses = [
            styles.followingButton,
            compact && styles.followingButtonCompact
          ].filter(Boolean).join(' ');

          return (
            <div key={user._id} className={suggestionItemClasses}>
              {/* Profile picture */}
              <div className={styles.profilePictureContainer}>
                <div className={profilePictureClasses}>
                  <img
                    src={getProfileImageSrc(user)}
                    alt={user.fullName || user.username}
                    className={styles.profilePictureImg}
                    onError={(e) => {
                      e.target.src = getProfileImageSrc(user);
                    }}
                  />
                </div>
                {isNew && (
                  <div className={styles.newUserBadge}>
                    <span>!</span>
                  </div>
                )}
              </div>

              {/* User info */}
              <div className={styles.userInfo}>
                <div className={styles.userHeader}>
                  <p className={usernameClasses}>{user.username}</p>
                  {user.daysSinceJoined <= 7 && (
                    <span className={styles.newBadge}>New</span>
                  )}
                </div>
                <p className={fullNameClasses}>{user.fullName}</p>
                <p className={styles.userStats}>
                  {user.suggestionReason || 'Suggested for you'} • {formatFollowerCount(user.followersCount || 0)} followers
                </p>
                {user.bio && (
                  <p className={styles.userBio}>{user.bio}</p>
                )}
              </div>

              {/* Action buttons */}
              <div className={styles.actionButtons}>
                {!isFollowing && (
                  <button
                    onClick={() => handleFollow(user._id)}
                    disabled={isPending}
                    className={followButtonClasses}
                  >
                    {isPending ? (
                      <RefreshCw className={styles.spinning} size={compact ? 12 : 16} />
                    ) : (
                      <UserPlus size={compact ? 12 : 16} />
                    )}
                    <span>{isPending ? 'Following...' : 'Follow'}</span>
                  </button>
                )}
                {isFollowing === true && (
                  <div className={followingButtonClasses}>
                    Following
                  </div>
                )}
                <button
                  onClick={() => handleDismiss(user._id)}
                  className={styles.dismissButton}
                  title="Dismiss suggestion"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Show more/less button */}
      {suggestions.length > limit && (
        <div className={styles.showMoreSection}>
          <button
            onClick={() => setShowAll(!showAll)}
            className={styles.showMoreButton}
          >
            {showAll ? 'Show less' : `See all ${suggestions.length} suggestions`}
          </button>
        </div>
      )}
    </div>
  );
};

export default FollowSuggestions;