// Complete Updated auth.js Utility - Fixed Profile Updates

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://instagram-clone-0t5v.onrender.com/api';

// ============================
// TOKEN MANAGEMENT
// ============================

export const getToken = () => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('instagram_token') || localStorage.getItem('token');
  }
  return null;
};

export const setToken = (token) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('instagram_token', token);
    localStorage.removeItem('token');
  }
};

export const removeToken = () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('instagram_token');
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
// CORE API REQUEST HELPER
// ============================

const apiRequest = async (endpoint, options = {}) => {
  const token = getToken();
  
  const defaultHeaders = {};

  // Don't set Content-Type for FormData - browser will set it with boundary
  if (!(options.body instanceof FormData)) {
    defaultHeaders['Content-Type'] = 'application/json';
  }

  if (token && isTokenValid()) {
    defaultHeaders['Authorization'] = `Bearer ${token}`;
  }

  const config = {
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
  const result = await apiRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify(credentials),
  });

  if (result.success && result.data.token) {
    setToken(result.data.token);
  }

  return result;
};

export const register = async (userData) => {
  const result = await apiRequest('/auth/register', {
    method: 'POST',
    body: JSON.stringify(userData),
  });

  if (result.success && result.data.token) {
    setToken(result.data.token);
  }

  return result;
};

export const getCurrentUserProfile = async () => {
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
  return await apiRequest(`/users/follow/${userId}`, {
    method: 'POST',
  });
};

export const unfollowUser = async (userId) => {
  return await apiRequest(`/users/unfollow/${userId}`, {
    method: 'POST',
  });
};

// FIXED: Updated profile update function
export const updateUserProfile = async (formData) => {
  console.log('=== updateUserProfile called ===');
  console.log('FormData received:', formData instanceof FormData);
  
  // Log FormData contents (for debugging)
  if (formData instanceof FormData) {
    for (let [key, value] of formData.entries()) {
      console.log(`FormData field: ${key} =`, value instanceof File ? `File: ${value.name}` : value);
    }
  }

  const result = await apiRequest('/users/profile', {
    method: 'PUT',
    body: formData, // FormData object - browser will set correct Content-Type with boundary
  });

  console.log('updateUserProfile result:', result);
  return result;
};

export const searchUsers = async (query, options = {}) => {
  const { page = 1, limit = 20 } = options;
  const encodedQuery = encodeURIComponent(query);
  return await apiRequest(`/users/search/${encodedQuery}?page=${page}&limit=${limit}`);
};

export const getUserSuggestions = async (options = {}) => {
  const { page = 1, limit = 5 } = options;
  
  try {
    const result = await apiRequest(`/users/suggestions?page=${page}&limit=${limit}`);
    
    if (result.success) {
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
    console.error('getUserSuggestions error:', error);
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
    body: formData,
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

export default {
  getToken,
  setToken,
  removeToken,
  isTokenValid,
  getCurrentUser,
  login,
  register,
  logout,
  getCurrentUserProfile,
  getUserProfile,
  getUserPosts,
  followUser,
  unfollowUser,
  updateUserProfile,
  searchUsers,
  getUserSuggestions,
  getUserFollowers,
  getUserFollowing,
  getFeedPosts,
  getExplorePosts,
  createPost,
  getPost,
  updatePost,
  deletePost,
  toggleLikePost,
  getPostLikes,
  addComment,
  getPostComments,
  updateComment,
  deleteComment,
  getNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  formatError,
  formatApiResponse
};
