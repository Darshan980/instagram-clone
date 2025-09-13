// Complete Frontend API Utility Functions
// Consolidated authentication, posts, users, and notifications
//backend/utils/auth.js
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

// ============================
// TOKEN MANAGEMENT
// ============================

export const getToken = () => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('token');
  }
  return null;
};

export const setToken = (token) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('token', token);
  }
};

export const removeToken = () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('token');
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

// ============================
// CORE API REQUEST HELPER
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
    console.log(`🔍 API Request: ${config.method || 'GET'} ${API_BASE_URL}${endpoint}`);
    
    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
    
    let data;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    console.log(`📦 API Response (${response.status}):`, data);

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
      throw new Error(errorMessage);
    }

    return {
      success: true,
      data,
      status: response.status
    };

  } catch (error) {
    console.error(`❌ API Error for ${endpoint}:`, error);
    
    return {
      success: false,
      error: error.message || 'An unexpected error occurred',
      status: error.status || 500
    };
  }
};

// ============================
// AUTHENTICATION FUNCTIONS
// ============================

export const login = async (email, password) => {
  const result = await apiRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

  if (result.success && result.data.token) {
    setToken(result.data.token);
  }

  return result;
};

export const register = async (userData) => {
  // Support both object and individual parameters
  let requestBody;
  if (typeof userData === 'object' && userData.username) {
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

export const getCurrentUser = async () => {
  return await apiRequest('/auth/me');
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

export const getUserPosts = async (userId, page = 1, limit = 10) => {
  if (!userId || userId === 'undefined' || userId === 'null') {
    console.error('❌ Invalid userId provided to getUserPosts:', userId);
    return {
      success: false,
      error: 'Invalid user ID'
    };
  }

  return await apiRequest(`/posts/user/${userId}?page=${page}&limit=${limit}`);
};

export const followUser = async (userId) => {
  const result = await apiRequest(`/users/follow/${userId}`, {
    method: 'POST',
  });

  // Create follow notification if successful
  if (result.success) {
    await createFollowNotification(userId);
  }

  return result;
};

export const unfollowUser = async (userId) => {
  return await apiRequest(`/users/unfollow/${userId}`, {
    method: 'POST',
  });
};

export const updateUserProfile = async (formData) => {
  return await apiRequest('/users/profile', {
    method: 'PUT',
    body: formData, // FormData object
  });
};

export const searchUsers = async (query, page = 1, limit = 20) => {
  return await apiRequest(`/users/search?q=${encodeURIComponent(query)}&page=${page}&limit=${limit}`);
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

export const getPostsFeed = async (page = 1, limit = 10) => {
  return await apiRequest(`/posts/feed?page=${page}&limit=${limit}`);
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

export const likePost = async (postId) => {
  const result = await apiRequest(`/posts/${postId}/like`, {
    method: 'POST',
  });

  // Create like notification if successful
  if (result.success && result.data.postOwnerId) {
    await createLikeNotification(result.data.postOwnerId, postId);
  }

  return result;
};

export const unlikePost = async (postId) => {
  return await apiRequest(`/posts/${postId}/unlike`, {
    method: 'POST',
  });
};

export const getPostLikes = async (postId, page = 1, limit = 20) => {
  return await apiRequest(`/posts/${postId}/likes?page=${page}&limit=${limit}`);
};

// ============================
// COMMENT FUNCTIONS
// ============================

export const commentOnPost = async (postId, comment) => {
  const result = await apiRequest(`/posts/${postId}/comments`, {
    method: 'POST',
    body: JSON.stringify({ comment }),
  });

  // Create comment notification if successful
  if (result.success && result.data.postOwnerId) {
    await createCommentNotification(result.data.postOwnerId, postId, comment);
  }

  return result;
};

export const getPostComments = async (postId, page = 1, limit = 20) => {
  return await apiRequest(`/posts/${postId}/comments?page=${page}&limit=${limit}`);
};

export const updateComment = async (commentId, comment) => {
  return await apiRequest(`/comments/${commentId}`, {
    method: 'PUT',
    body: JSON.stringify({ comment }),
  });
};

export const deleteComment = async (commentId) => {
  return await apiRequest(`/comments/${commentId}`, {
    method: 'DELETE',
  });
};

export const likeComment = async (commentId) => {
  return await apiRequest(`/comments/${commentId}/like`, {
    method: 'POST',
  });
};

export const unlikeComment = async (commentId) => {
  return await apiRequest(`/comments/${commentId}/unlike`, {
    method: 'POST',
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

export const deleteAllReadNotifications = async () => {
  return await apiRequest('/notifications/read', {
    method: 'DELETE',
  });
};

export const createNotification = async (notificationData) => {
  return await apiRequest('/notifications', {
    method: 'POST',
    body: JSON.stringify(notificationData),
  });
};

// ============================
// NOTIFICATION HELPERS
// ============================

export const createFollowNotification = async (followedUserId) => {
  try {
    return await createNotification({
      userId: followedUserId,
      type: 'follow',
      message: 'started following you'
    });
  } catch (error) {
    console.warn('Failed to create follow notification:', error);
    return { success: false, error: error.message };
  }
};

export const createLikeNotification = async (postOwnerId, postId) => {
  try {
    return await createNotification({
      userId: postOwnerId,
      type: 'like',
      postId,
      message: 'liked your post'
    });
  } catch (error) {
    console.warn('Failed to create like notification:', error);
    return { success: false, error: error.message };
  }
};

export const createCommentNotification = async (postOwnerId, postId, commentText) => {
  try {
    const message = commentText.length > 50 
      ? `commented: "${commentText.substring(0, 50)}..."`
      : `commented: "${commentText}"`;
      
    return await createNotification({
      userId: postOwnerId,
      type: 'comment',
      postId,
      message
    });
  } catch (error) {
    console.warn('Failed to create comment notification:', error);
    return { success: false, error: error.message };
  }
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
// ADMIN FUNCTIONS (if needed)
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

export const getBlockedUsers = async (page = 1, limit = 20) => {
  return await apiRequest(`/users/blocked?page=${page}&limit=${limit}`);
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
// DEBUG AND TESTING
// ============================

export const testNotificationSystem = async () => {
  try {
    console.log('🧪 Testing notification system...');
    
    const notifications = await getNotifications(1, 5);
    console.log('📦 Test notifications:', notifications);
    
    const unreadCount = await getUnreadNotificationCount();
    console.log('📊 Test unread count:', unreadCount);
    
    return {
      success: true,
      message: 'Notification system test completed',
      results: { notifications, unreadCount }
    };
    
  } catch (error) {
    console.error('❌ Notification system test failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

export const testApiConnection = async () => {
  try {
    console.log('🔌 Testing API connection...');
    
    const response = await fetch(`${API_BASE_URL}/health`);
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ API connection successful:', data);
      return { success: true, data };
    } else {
      console.log('⚠️ API connection issues:', data);
      return { success: false, error: data.message || 'API connection failed' };
    }
  } catch (error) {
    console.error('❌ API connection test failed:', error);
    return { success: false, error: error.message };
  }
};

// ============================
// EXPORTS
// ============================

export default {
  // Token management
  getToken,
  setToken,
  removeToken,
  isTokenValid,
  
  // Authentication
  login,
  register,
  logout,
  getCurrentUser,
  
  // Users
  getUserProfile,
  getUserPosts,
  followUser,
  unfollowUser,
  updateUserProfile,
  searchUsers,
  getUserFollowers,
  getUserFollowing,
  blockUser,
  unblockUser,
  getBlockedUsers,
  
  // Posts
  getPostsFeed,
  createPost,
  getPost,
  updatePost,
  deletePost,
  likePost,
  unlikePost,
  getPostLikes,
  searchPosts,
  getTrendingPosts,
  getTrendingTags,
  getPostsByTag,
  
  // Comments
  commentOnPost,
  getPostComments,
  updateComment,
  deleteComment,
  likeComment,
  unlikeComment,
  
  // Notifications
  getNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  deleteAllReadNotifications,
  createNotification,
  createFollowNotification,
  createLikeNotification,
  createCommentNotification,
  
  // File uploads
  uploadImage,
  uploadVideo,
  
  // Reports
  reportUser,
  reportPost,
  
  // Utilities
  formatError,
  formatApiResponse,
  testNotificationSystem,
  testApiConnection
};