// utils/notifications.js

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:10000/api';

class NotificationAPI {
  constructor() {
    this.token = null;
    this.baseURL = `${API_BASE_URL}`;
  }

  // Set authentication token
  setToken(token) {
    this.token = token;
  }

  // Get authentication headers
  getAuthHeaders() {
    const headers = {
      'Content-Type': 'application/json'
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    return headers;
  }

  // Generic API request handler
  async makeRequest(url, options = {}) {
    try {
      const config = {
        headers: this.getAuthHeaders(),
        ...options
      };

      const response = await fetch(url, config);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`❌ Request failed:`, error);
      
      // Handle network errors
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error('Network error - please check your connection');
      }
      
      // Handle authentication errors
      if (error.message.includes('401') || error.message.includes('Unauthorized')) {
        throw new Error('Authentication failed - please log in again');
      }
      
      throw error;
    }
  }

  /**
   * Get unread notification count
   * @returns {Promise<Object>} Response with unread count
   */
  async getUnreadNotificationCount() {
    return await this.makeRequest(`${this.baseURL}/notifications/unread-count`, {
      method: 'GET'
    });
  }

  /**
   * Get unread message count
   * @returns {Promise<Object>} Response with unread count
   */
  async getUnreadMessageCount() {
    return await this.makeRequest(`${this.baseURL}/messages/unread/count`, {
      method: 'GET'
    });
  }

  /**
   * Get all notifications
   * @param {number} page - Page number
   * @param {number} limit - Items per page
   * @returns {Promise<Object>} Response with notifications
   */
  async getNotifications(page = 1, limit = 20) {
    return await this.makeRequest(`${this.baseURL}/notifications?page=${page}&limit=${limit}`, {
      method: 'GET'
    });
  }

  /**
   * Mark notification as read
   * @param {string} notificationId - Notification ID
   * @returns {Promise<Object>} Response object
   */
  async markNotificationAsRead(notificationId) {
    return await this.makeRequest(`${this.baseURL}/notifications/${notificationId}/read`, {
      method: 'PUT'
    });
  }

  /**
   * Mark all notifications as read
   * @returns {Promise<Object>} Response object
   */
  async markAllNotificationsAsRead() {
    return await this.makeRequest(`${this.baseURL}/notifications/read-all`, {
      method: 'PUT'
    });
  }

  /**
   * Delete notification
   * @param {string} notificationId - Notification ID
   * @returns {Promise<Object>} Response object
   */
  async deleteNotification(notificationId) {
    return await this.makeRequest(`${this.baseURL}/notifications/${notificationId}`, {
      method: 'DELETE'
    });
  }

  /**
   * Get combined notification and message counts
   * @returns {Promise<Object>} Response with both counts
   */
  async getCombinedCounts() {
    try {
      const [notificationResponse, messageResponse] = await Promise.all([
        this.getUnreadNotificationCount(),
        this.getUnreadMessageCount()
      ]);

      return {
        success: true,
        notifications: notificationResponse.unreadCount || 0,
        messages: messageResponse.unreadCount || 0,
        total: (notificationResponse.unreadCount || 0) + (messageResponse.unreadCount || 0)
      };
    } catch (error) {
      console.error('Error getting combined counts:', error);
      return {
        success: false,
        notifications: 0,
        messages: 0,
        total: 0,
        error: error.message
      };
    }
  }

  // Utility methods for token management
  
  /**
   * Initialize token from localStorage
   * @returns {boolean} True if token was found and set
   */
  initializeFromStorage() {
    if (typeof window === 'undefined') return false;

    const token = localStorage.getItem('instagram_token') || 
                  localStorage.getItem('authToken') || 
                  localStorage.getItem('token') ||
                  sessionStorage.getItem('instagram_token') ||
                  sessionStorage.getItem('token');

    if (token) {
      this.setToken(token);
      return true;
    }

    return false;
  }

  /**
   * Check if user is authenticated
   * @returns {boolean} True if token exists and appears valid
   */
  isAuthenticated() {
    if (!this.token) return false;

    // Basic JWT format check
    const tokenParts = this.token.split('.');
    return tokenParts.length === 3;
  }
}

// Create and export singleton instance
const notificationAPI = new NotificationAPI();

// Auto-initialize token from storage on client-side
if (typeof window !== 'undefined') {
  notificationAPI.initializeFromStorage();
}

export default notificationAPI;

// Named exports for convenience
export {
  notificationAPI,
  NotificationAPI
};
