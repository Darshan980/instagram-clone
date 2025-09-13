"use client";
import React, { useState, useEffect } from 'react';
import { User, UserPlus, X, RefreshCw, Users, Search } from 'lucide-react';

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
      // The API returns data in result.data format, and users are in result.data.data.users
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

const FollowSuggestions = ({ 
  limit = 10, 
  showHeader = true, 
  compact = false, 
  sidebar = false,
  onDismiss
}) => {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [followingStates, setFollowingStates] = useState({});
  const [error, setError] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);

  // Handle client-side mounting
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
        
        // Initialize following states
        const initialStates = {};
        users.forEach(user => {
          if (user && user._id) {
            initialStates[user._id] = user.isFollowing || false;
          }
        });
        setFollowingStates(initialStates);
        
        // Clear any previous errors if we got data successfully
        if (users.length > 0) {
          setError(null);
        }
      } else {
        console.error('API Error:', result.error);
        setError(result.error || 'Failed to load suggestions');
        // Don't clear suggestions on refresh error, keep the existing ones
        if (!isRefresh) {
          setSuggestions([]);
        }
      }
    } catch (err) {
      console.error('Network error:', err);
      const errorMessage = 'Network error occurred: ' + err.message;
      setError(errorMessage);
      // Don't clear suggestions on refresh error, keep the existing ones
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
        // Update the user in suggestions to reflect new status
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
    
    // Call parent's onDismiss if provided
    if (onDismiss) {
      onDismiss();
    }
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
  }, [mounted, limit]);

  // Don't render until mounted (prevents hydration mismatch)
  if (!mounted) {
    return null;
  }

  const displayLimit = compact ? Math.min(limit, 5) : limit;
  const displaySuggestions = showAll ? suggestions : suggestions.slice(0, displayLimit);
  const hasValidSuggestions = suggestions.length > 0;

  // Container classes based on props
  const containerClasses = sidebar 
    ? "bg-transparent" 
    : compact 
    ? "max-w-sm bg-white rounded-lg shadow-sm border border-gray-200"
    : "max-w-md mx-auto bg-white rounded-lg shadow-sm border border-gray-200";

  // Loading state for initial load
  if (initialLoad && loading) {
    return (
      <div className={containerClasses}>
        <div className={sidebar ? "space-y-3" : "p-4"}>
          {showHeader && (
            <div className="flex items-center justify-between mb-4">
              <h2 className={`text-gray-500 font-medium ${compact ? 'text-xs' : 'text-sm'}`}>
                Suggested for you
              </h2>
              <div className="animate-spin">
                <RefreshCw className="w-4 h-4 text-gray-400" />
              </div>
            </div>
          )}
          <div className="space-y-3">
            {[...Array(displayLimit)].map((_, i) => (
              <div key={i} className="flex items-center space-x-3 animate-pulse">
                <div className={`bg-gray-200 rounded-full ${compact ? 'w-10 h-10' : 'w-12 h-12'}`}></div>
                <div className="flex-1">
                  <div className={`h-4 bg-gray-200 rounded w-24 mb-2 ${compact ? 'h-3' : ''}`}></div>
                  <div className={`h-3 bg-gray-200 rounded w-32 ${compact ? 'h-2' : ''}`}></div>
                </div>
                <div className={`bg-gray-200 rounded ${compact ? 'w-12 h-6' : 'w-16 h-8'}`}></div>
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
      <div className={containerClasses}>
        <div className={sidebar ? "py-4" : "p-4"}>
          <div className="text-center py-4">
            <Users className={`text-gray-300 mx-auto mb-3 ${compact ? 'w-8 h-8' : 'w-12 h-12'}`} />
            <p className={`text-gray-500 mb-2 ${compact ? 'text-xs' : 'text-sm'}`}>
              Failed to load suggestions
            </p>
            {!compact && (
              <p className="text-gray-400 text-xs mb-3">{error}</p>
            )}
            <button
              onClick={() => loadSuggestions()}
              className={`text-blue-500 font-medium hover:text-blue-600 transition-colors ${compact ? 'text-xs' : 'text-sm'}`}
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Empty state when no suggestions but no error
  if (!hasValidSuggestions && !error && !loading) {
    return (
      <div className={containerClasses}>
        <div className={sidebar ? "py-4" : "p-4"}>
          <div className="text-center py-4">
            <Search className={`text-gray-300 mx-auto mb-3 ${compact ? 'w-8 h-8' : 'w-12 h-12'}`} />
            <p className={`text-gray-500 mb-2 ${compact ? 'text-xs' : 'text-sm'}`}>
              No suggestions available
            </p>
            {!compact && (
              <p className="text-gray-400 text-xs mb-3">Check back later for new suggestions</p>
            )}
            <button
              onClick={() => loadSuggestions()}
              className={`text-blue-500 font-medium hover:text-blue-600 transition-colors ${compact ? 'text-xs' : 'text-sm'}`}
            >
              Refresh suggestions
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Main suggestions view
  return (
    <div className={containerClasses}>
      <div className={sidebar ? "space-y-3" : "p-4"}>
        {/* Header */}
        {showHeader && (
          <div className="flex items-center justify-between mb-4">
            <h2 className={`text-gray-500 font-medium ${compact ? 'text-xs' : 'text-sm'}`}>
              Suggested for you
            </h2>
            <button
              onClick={() => loadSuggestions(true)}
              disabled={refreshing}
              className={`text-blue-500 font-medium hover:text-blue-600 disabled:opacity-50 flex items-center space-x-1 transition-colors ${compact ? 'text-xs' : 'text-sm'}`}
            >
              <RefreshCw className={`${refreshing ? 'animate-spin' : ''} ${compact ? 'w-3 h-3' : 'w-4 h-4'}`} />
              {!compact && <span>Refresh</span>}
            </button>
          </div>
        )}

        {/* Error message - show but don't block the content */}
        {error && hasValidSuggestions && !compact && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        {/* Suggestions list */}
        <div className="space-y-3">
          {displaySuggestions.map((user) => {
            const isFollowing = followingStates[user._id];
            const isPending = isFollowing === 'pending';
            const isNew = user.daysSinceJoined <= 30;

            return (
              <div key={user._id} className={`flex items-center space-x-3 ${compact ? '' : 'p-2 border border-gray-100 rounded'}`}>
                {/* Profile picture */}
                <div className="relative">
                  <div className={`rounded-full overflow-hidden border border-gray-200 bg-gray-100 ${compact ? 'w-10 h-10' : 'w-12 h-12'}`}>
                    <img
                      src={getProfileImageSrc(user)}
                      alt={user.fullName || user.username}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.src = getProfileImageSrc(user);
                      }}
                    />
                  </div>
                  {isNew && !compact && (
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-xs font-bold">!</span>
                    </div>
                  )}
                </div>

                {/* User info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <p className={`font-medium text-gray-900 truncate ${compact ? 'text-xs' : 'text-sm'}`}>
                      {user.username}
                    </p>
                    {user.daysSinceJoined <= 7 && !compact && (
                      <span className="px-2 py-0.5 bg-green-100 text-green-600 text-xs rounded-full font-medium">
                        New
                      </span>
                    )}
                  </div>
                  {!compact && (
                    <p className="text-xs text-gray-500 truncate">{user.fullName}</p>
                  )}
                  <p className={`text-gray-400 mt-0.5 ${compact ? 'text-xs' : 'text-xs'}`}>
                    {compact 
                      ? `${formatFollowerCount(user.followersCount || 0)} followers`
                      : `${user.suggestionReason || 'Suggested for you'} • ${formatFollowerCount(user.followersCount || 0)} followers`
                    }
                  </p>
                  {user.bio && !compact && (
                    <p className="text-xs text-gray-500 truncate mt-1">{user.bio}</p>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex items-center space-x-2">
                  {!isFollowing && (
                    <button
                      onClick={() => handleFollow(user._id)}
                      disabled={isPending}
                      className={`bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white font-medium rounded-md transition-colors flex items-center space-x-1 ${
                        compact ? 'px-2 py-1 text-xs' : 'px-4 py-1.5 text-sm'
                      }`}
                    >
                      {isPending ? (
                        <RefreshCw className={`animate-spin ${compact ? 'w-2 h-2' : 'w-3 h-3'}`} />
                      ) : (
                        <UserPlus className={compact ? 'w-2 h-2' : 'w-3 h-3'} />
                      )}
                      {!compact && <span>{isPending ? 'Following...' : 'Follow'}</span>}
                    </button>
                  )}
                  {isFollowing === true && (
                    <div className={`bg-green-50 text-green-600 font-medium rounded-md border border-green-200 ${
                      compact ? 'px-2 py-1 text-xs' : 'px-4 py-1.5 text-sm'
                    }`}>
                      {compact ? '✓' : 'Following'}
                    </div>
                  )}
                  <button
                    onClick={() => handleDismiss(user._id)}
                    className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                    title="Dismiss suggestion"
                  >
                    <X className={compact ? 'w-3 h-3' : 'w-4 h-4'} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Show more/less button */}
        {suggestions.length > displayLimit && !compact && (
          <div className="mt-4 pt-3 border-t border-gray-100">
            <button
              onClick={() => setShowAll(!showAll)}
              className="w-full text-center text-blue-500 text-sm font-medium hover:text-blue-600 transition-colors"
            >
              {showAll ? 'Show less' : `See all ${suggestions.length} suggestions`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default FollowSuggestions;