// Enhanced Frontend API Utility Functions with Fixed Suggestions and Error Handling
// Complete authentication, posts, users, notifications, and reels system

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://instagram-clone-0t5v.onrender.com';

// ============================
// TOKEN MANAGEMENT
// ============================

export const getToken = () => {
  if (typeof window !== 'undefined') {
    // Check both token storage keys for backward compatibility
    return localStorage.getItem('instagram_token') || localStorage.getItem('token');
  }
  return null;
};

export const setToken = (token) => {
  if (typeof window !== 'undefined') {
    // Use consistent token key
    localStorage.setItem('instagram_token', token);
    // Remove old token key if it exists
    localStorage.removeItem('token');
  }
};

export const removeToken = () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('instagram_token');
    localStorage.removeItem('token'); // Remove old key too
  }
};

export const isTokenValid = () => {
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

export const getCurrentUser = () => {
  const token = getToken();
  if (!token || !isTokenValid()) return null;

  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload;
  } catch (error) {
    console.error('Error decoding token:', error);
    return null;
  }
};

// ============================
// CORE API REQUEST HELPER WITH IMPROVED ERROR HANDLING
// ============================

const apiRequest = async (endpoint, options = {}) => {
  const token = getToken();
  
  const defaultHeaders = {
    'Content-Type': 'application/json',
  };

  // Don't set Content-Type for FormData
  if (options.body instanceof FormData) {
    delete defaultHeaders['Content-Type'];
  }

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
    console.log(`API Request: ${config.method || 'GET'} ${API_BASE_URL}${endpoint}`);
    
    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
    
    let data;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    console.log(`API Response (${response.status}):`, data);

    if (!response.ok) {
      // Handle authentication errors
      if (response.status === 401) {
        removeToken();
        if (typeof window !== 'undefined') {
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

// ============================
// AUTHENTICATION FUNCTIONS
// ============================

export const login = async (credentials) => {
  // Support both object and separate email/password parameters
  let requestBody;
  if (typeof credentials === 'object' && credentials.email) {
    requestBody = credentials;
  } else {
    // Handle legacy parameter format
    const [email, password] = arguments;
    requestBody = { email, password };
  }

  const result = await apiRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify(requestBody),
  });

  if (result.success && result.data.token) {
    setToken(result.data.token);
  }

  return result;
};

export const register = async (userData) => {
  // Support both object and individual parameters
  let requestBody;
  if (typeof userData === 'object' && (userData.username || userData.email)) {
    requestBody = userData;
  } else {
    // Handle legacy parameter format
    const [username, email, password, fullName] = arguments;
    requestBody = { username, email, password, fullName };
  }

  const result = await apiRequest('/auth/register', {
    method: 'POST',
    body: JSON.stringify(requestBody),
  });

  if (result.success && result.data.token) {
    setToken(result.data.token);
  }

  return result;
};

export const getCurrentUserProfile = async () => {
  return await apiRequest('/auth/me');
};

export const getProtectedData = async () => {
  return await apiRequest('/auth/protected');
};

export const logout = () => {
  removeToken();
  if (typeof window !== 'undefined') {
    window.location.href = '/login';
  }
};

// ============================
// USER FUNCTIONS
// ============================

export const getUserProfile = async (identifier) => {
  return await apiRequest(`/users/${identifier}`);
};

export const getUserPosts = async (userId, page = 1, limit = 12) => {
  if (!userId || userId === 'undefined' || userId === 'null') {
    console.error('Invalid userId provided to getUserPosts:', userId);
    return {
      success: false,
      error: 'Invalid user ID'
    };
  }

  return await apiRequest(`/posts/user/${userId}?page=${page}&limit=${limit}`);
};

export const followUser = async (userId) => {
  let result = await apiRequest(`/users/follow/${userId}`, {
    method: 'POST',
  });

  // Fallback to alternative endpoint if 404
  if (!result.success && result.status === 404) {
    result = await apiRequest(`/users/${userId}/follow`, {
      method: 'POST',
    });
  }

  return result;
};

export const unfollowUser = async (userId) => {
  let result = await apiRequest(`/users/unfollow/${userId}`, {
    method: 'POST',
  });

  // Fallback to alternative endpoint if 404
  if (!result.success && result.status === 404) {
    result = await apiRequest(`/users/${userId}/follow`, {
      method: 'DELETE',
    });
  }

  return result;
};

export const updateUserProfile = async (profileData) => {
  return await apiRequest('/users/profile', {
    method: 'PUT',
    body: profileData, // FormData object
  });
};

export const searchUsers = async (query, options = {}) => {
  const { page = 1, limit = 20 } = options;
  const encodedQuery = encodeURIComponent(query);
  return await apiRequest(`/users/search/${encodedQuery}?page=${page}&limit=${limit}`);
};

// FIXED: Enhanced user suggestions function with better error handling
export const getUserSuggestions = async (options = {}) => {
  const { page = 1, limit = 5 } = options;
  
  console.log('getUserSuggestions called with:', { page, limit });
  
  try {
    const result = await apiRequest(`/users/suggestions?page=${page}&limit=${limit}`);
    
    console.log('getUserSuggestions raw result:', result);
    
    if (result.success) {
      // Ensure we always return a consistent structure
      const responseData = result.data || {};
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

export const getUserFollowers = async (userId, page = 1, limit = 20) => {
  return await apiRequest(`/users/${userId}/followers?page=${page}&limit=${limit}`);
};

export const getUserFollowing = async (userId, page = 1, limit = 20) => {
  return await apiRequest(`/users/${userId}/following?page=${page}&limit=${limit}`);
};

// ============================
// POST FUNCTIONS
// ============================

export const getFeedPosts = async (page = 1, limit = 10) => {
  return await apiRequest(`/posts/feed?page=${page}&limit=${limit}`);
};

export const getExplorePosts = async (page = 1, limit = 20) => {
  return await apiRequest(`/posts/explore?page=${page}&limit=${limit}`);
};

export const createPost = async (formData) => {
  return await apiRequest('/posts', {
    method: 'POST',
    body: formData, // FormData object
  });
};

export const getPost = async (postId) => {
  return await apiRequest(`/posts/${postId}`);
};

export const updatePost = async (postId, formData) => {
  return await apiRequest(`/posts/${postId}`, {
    method: 'PUT',
    body: formData,
  });
};

export const deletePost = async (postId) => {
  return await apiRequest(`/posts/${postId}`, {
    method: 'DELETE',
  });
};

export const toggleLikePost = async (postId) => {
  return await apiRequest(`/posts/${postId}/like`, {
    method: 'POST',
  });
};

export const getPostLikes = async (postId, page = 1, limit = 20) => {
  return await apiRequest(`/posts/${postId}/likes?page=${page}&limit=${limit}`);
};

// ============================
// COMMENT FUNCTIONS
// ============================

export const addComment = async (postId, text) => {
  return await apiRequest(`/posts/${postId}/comment`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
};

export const getPostComments = async (postId, page = 1, limit = 20) => {
  return await apiRequest(`/posts/${postId}/comments?page=${page}&limit=${limit}`);
};

export const updateComment = async (commentId, text) => {
  return await apiRequest(`/comments/${commentId}`, {
    method: 'PUT',
    body: JSON.stringify({ text }),
  });
};

export const deleteComment = async (commentId) => {
  return await apiRequest(`/comments/${commentId}`, {
    method: 'DELETE',
  });
};

// ============================
// REELS FUNCTIONS - FIXED WITH PROPER VIEW TRACKING
// ============================

export const getReelsFeed = async (page = 1, limit = 10) => {
  return await apiRequest(`/reels/feed?page=${page}&limit=${limit}`);
};

export const getReel = async (reelId) => {
  return await apiRequest(`/reels/${reelId}`);
};

export const createReel = async (formData) => {
  return await apiRequest('/reels', {
    method: 'POST',
    body: formData, // FormData object
  });
};

export const deleteReel = async (reelId) => {
  return await apiRequest(`/reels/${reelId}`, {
    method: 'DELETE',
  });
};

export const toggleLikeReel = async (reelId) => {
  return await apiRequest(`/reels/${reelId}/like`, {
    method: 'POST',
  });
};

export const addReelComment = async (reelId, text) => {
  return await apiRequest(`/reels/${reelId}/comment`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
};

export const getReelComments = async (reelId, page = 1, limit = 20) => {
  return await apiRequest(`/reels/${reelId}/comments?page=${page}&limit=${limit}`);
};

export const shareReel = async (reelId) => {
  return await apiRequest(`/reels/${reelId}/share`, {
    method: 'POST',
  });
};

// FIXED: New dedicated view tracking function
export const trackReelView = async (reelId) => {
  return await apiRequest(`/reels/${reelId}/view`, {
    method: 'POST',
  });
};

export const getUserReels = async (userId, page = 1, limit = 12) => {
  return await apiRequest(`/reels/user/${userId}?page=${page}&limit=${limit}`);
};

export const searchReels = async (hashtag, page = 1, limit = 20) => {
  const encodedHashtag = encodeURIComponent(hashtag);
  return await apiRequest(`/reels/search/${encodedHashtag}?page=${page}&limit=${limit}`);
};

export const getTrendingReels = async (page = 1, limit = 20) => {
  return await apiRequest(`/reels/trending?page=${page}&limit=${limit}`);
};

export const getReelsByMusic = async (trackId, page = 1, limit = 20) => {
  const encodedTrackId = encodeURIComponent(trackId);
  return await apiRequest(`/reels/music/${encodedTrackId}?page=${page}&limit=${limit}`);
};

export const getReelAnalytics = async (reelId) => {
  return await apiRequest(`/reels/${reelId}/analytics`);
};

export const reportReel = async (reelId, reason, description) => {
  return await apiRequest(`/reels/${reelId}/report`, {
    method: 'POST',
    body: JSON.stringify({ reason, description }),
  });
};

// ============================
// NOTIFICATION FUNCTIONS
// ============================

export const getNotifications = async (page = 1, limit = 20) => {
  return await apiRequest(`/notifications?page=${page}&limit=${limit}`);
};

export const getUnreadNotificationCount = async () => {
  return await apiRequest('/notifications/unread-count');
};

export const markNotificationAsRead = async (notificationId) => {
  return await apiRequest(`/notifications/${notificationId}/read`, {
    method: 'PUT',
  });
};

export const markAllNotificationsAsRead = async () => {
  return await apiRequest('/notifications/read-all', {
    method: 'PUT',
  });
};

export const deleteNotification = async (notificationId) => {
  return await apiRequest(`/notifications/${notificationId}`, {
    method: 'DELETE',
  });
};

// ============================
// SEARCH FUNCTIONS
// ============================

export const searchPosts = async (query, page = 1, limit = 20, filters = {}) => {
  const params = new URLSearchParams({
    q: query,
    page: page.toString(),
    limit: limit.toString(),
    ...filters
  });

  return await apiRequest(`/posts/search?${params}`);
};

export const getTrendingPosts = async (timeframe = 'week', limit = 20) => {
  return await apiRequest(`/posts/trending?timeframe=${timeframe}&limit=${limit}`);
};

export const getTrendingTags = async (limit = 10) => {
  return await apiRequest(`/posts/tags/trending?limit=${limit}`);
};

export const getPostsByTag = async (tag, page = 1, limit = 20) => {
  return await apiRequest(`/posts/tag/${encodeURIComponent(tag)}?page=${page}&limit=${limit}`);
};

// ============================
// FILE UPLOAD HELPERS
// ============================

export const uploadImage = async (file, type = 'post') => {
  const formData = new FormData();
  formData.append('image', file);
  formData.append('type', type);

  return await apiRequest('/upload/image', {
    method: 'POST',
    body: formData,
  });
};

export const uploadVideo = async (file, type = 'post') => {
  const formData = new FormData();
  formData.append('video', file);
  formData.append('type', type);

  return await apiRequest('/upload/video', {
    method: 'POST',
    body: formData,
  });
};

// ============================
// ADMIN FUNCTIONS
// ============================

export const reportUser = async (userId, reason, description) => {
  return await apiRequest('/reports/user', {
    method: 'POST',
    body: JSON.stringify({ userId, reason, description }),
  });
};

export const reportPost = async (postId, reason, description) => {
  return await apiRequest('/reports/post', {
    method: 'POST',
    body: JSON.stringify({ postId, reason, description }),
  });
};

export const blockUser = async (userId) => {
  return await apiRequest(`/users/block/${userId}`, {
    method: 'POST',
  });
};

export const unblockUser = async (userId) => {
  return await apiRequest(`/users/unblock/${userId}`, {
    method: 'POST',
  });
};

// ============================
// UTILITY FUNCTIONS
// ============================

export const formatError = (error) => {
  if (typeof error === 'string') return error;
  if (error?.message) return error.message;
  if (error?.error) return error.error;
  return 'An unexpected error occurred';
};

export const formatApiResponse = (response) => {
  if (response.success) {
    return {
      success: true,
      data: response.data,
      status: response.status
    };
  } else {
    return {
      success: false,
      error: formatError(response),
      status: response.status || 500
    };
  }
};

// ============================
// HEALTH CHECK & TESTING
// ============================

export const testApiConnection = async () => {
  try {
    console.log('Testing API connection...');
    
    const response = await fetch(`${API_BASE_URL.replace('/api', '')}/health`);
    const data = await response.json();
    
    if (response.ok) {
      console.log('API connection successful:', data);
      return { success: true, data };
    } else {
      console.log('API connection issues:', data);
      return { success: false, error: data.message || 'API connection failed' };
    }
  } catch (error) {
    console.error('API connection test failed:', error);
    return { success: false, error: error.message };
  }
};

// ============================
// ENHANCED REELS UTILITY FUNCTIONS
// ============================

// FIXED: Helper function for intelligent view tracking
export const smartTrackReelView = async (reelId, options = {}) => {
  const {
    minWatchTime = 1000, // Minimum watch time in milliseconds
    throttle = 5000,     // Throttle subsequent calls
    storage = localStorage // Where to store tracking data
  } = options;

  try {
    const storageKey = `reel_views_${reelId}`;
    const lastTracked = storage.getItem(storageKey);
    const now = Date.now();

    // Check if we recently tracked this view
    if (lastTracked && (now - parseInt(lastTracked)) < throttle) {
      console.log(`View tracking throttled for reel ${reelId}`);
      return { success: true, throttled: true };
    }

    // Track the view
    const result = await trackReelView(reelId);
    
    if (result.success) {
      // Store the timestamp
      storage.setItem(storageKey, now.toString());
      console.log(`Smart view tracked for reel ${reelId}`);
    }

    return result;
  } catch (error) {
    console.error('Error in smart view tracking:', error);
    return { success: false, error: error.message };
  }
};

// FIXED: Batch view tracking for multiple reels
export const batchTrackReelViews = async (reelIds) => {
  const results = [];
  
  for (const reelId of reelIds) {
    try {
      const result = await trackReelView(reelId);
      results.push({ reelId, ...result });
      
      // Small delay to prevent overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      results.push({ reelId, success: false, error: error.message });
    }
  }
  
  return results;
};

// FIXED: Get comprehensive reel metrics
export const getReelMetrics = async (reelId) => {
  try {
    const [reelResult, analyticsResult] = await Promise.all([
      getReel(reelId),
      getReelAnalytics(reelId).catch(() => ({ success: false })) // Analytics might fail if not owner
    ]);

    if (!reelResult.success) {
      return reelResult;
    }

    const reel = reelResult.data.reel;
    const metrics = {
      basic: {
        views: reel.viewsCount || 0,
        likes: reel.likesCount || 0,
        comments: reel.commentsCount || 0,
        shares: reel.shares || 0,
      },
      calculated: {
        engagementRate: reel.viewsCount > 0 ? 
          ((reel.likesCount + reel.commentsCount + reel.shares) / reel.viewsCount * 100).toFixed(2) : '0.00',
        likesPerView: reel.viewsCount > 0 ? (reel.likesCount / reel.viewsCount).toFixed(4) : '0.0000',
        commentsPerView: reel.viewsCount > 0 ? (reel.commentsCount / reel.viewsCount).toFixed(4) : '0.0000',
      }
    };

    if (analyticsResult.success) {
      metrics.detailed = analyticsResult.data.analytics;
    }

    return {
      success: true,
      data: {
        reel,
        metrics
      }
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// ============================
// DEFAULT EXPORT WITH ALL FUNCTIONS INCLUDING FIXED REELS
// ============================

export default {
  // Token management
  getToken,
  setToken,
  removeToken,
  isTokenValid,
  getCurrentUser,
  
  // Authentication
  login,
  register,
  logout,
  getCurrentUserProfile,
  getProtectedData,
  
  // Users
  getUserProfile,
  getUserPosts,
  followUser,
  unfollowUser,
  updateUserProfile,
  searchUsers,
  getUserSuggestions,
  getUserFollowers,
  getUserFollowing,
  blockUser,
  unblockUser,
  
  // Posts
  getFeedPosts,
  getExplorePosts,
  createPost,
  getPost,
  updatePost,
  deletePost,
  toggleLikePost,
  getPostLikes,
  searchPosts,
  getTrendingPosts,
  getTrendingTags,
  getPostsByTag,
  
  // Comments
  addComment,
  getPostComments,
  updateComment,
  deleteComment,
  
  // Reels - FIXED with proper view tracking
  getReelsFeed,
  getReel,
  createReel,
  deleteReel,
  toggleLikeReel,
  addReelComment,
  getReelComments,
  shareReel,
  trackReelView, // NEW: Dedicated view tracking
  smartTrackReelView, // NEW: Intelligent view tracking
  batchTrackReelViews, // NEW: Batch view tracking
  getReelMetrics, // NEW: Comprehensive metrics
  getUserReels,
  searchReels,
  getTrendingReels,
  getReelsByMusic,
  getReelAnalytics,
  reportReel,
  
  // Notifications
  getNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  
  // File uploads
  uploadImage,
  uploadVideo,
  
  // Reports & Admin
  reportUser,
  reportPost,
  
  // Utilities
  formatError,
  formatApiResponse,
  testApiConnection
};
