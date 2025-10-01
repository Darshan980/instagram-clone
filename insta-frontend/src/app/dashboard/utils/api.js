// dashboard/utils/api.js (API Utilities)
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:10000/api';

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
    return payload.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
};

export const apiRequest = async (endpoint, options = {}) => {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token && isTokenValid() && { 'Authorization': `Bearer ${token}` }),
    ...options.headers,
  };

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });
    
    const contentType = response.headers.get('content-type');
    const data = contentType?.includes('application/json') 
      ? await response.json() 
      : await response.text();

    if (!response.ok) {
      if (response.status === 401) {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('instagram_token');
          localStorage.removeItem('token');
          window.location.href = '/login';
        }
      }
      return {
        success: false,
        error: data?.message || data?.error || `HTTP error! status: ${response.status}`,
        status: response.status
      };
    }

    return { success: true, data, status: response.status };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Network error occurred',
      status: 500
    };
  }
};

export const getUserSuggestions = async (options = {}) => {
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
    }
    
    return {
      success: false,
      error: result.error,
      data: { users: [], totalSuggestions: 0, hasMore: false, page: 1 }
    };
  } catch (error) {
    return {
      success: false,
      error: 'Network error',
      data: { users: [], totalSuggestions: 0, hasMore: false, page: 1 }
    };
  }
};

export const followUser = async (userId) => {
  let result = await apiRequest(`/users/follow/${userId}`, { method: 'POST' });
  
  if (!result.success && result.status === 404) {
    result = await apiRequest(`/users/${userId}/follow`, { method: 'POST' });
  }
  
  return result;
};
