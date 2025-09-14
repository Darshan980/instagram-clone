// utils/settings.js

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:10000/api';

class SettingsAPI {
  constructor() {
    this.token = null;
    this.baseURL = `${API_BASE_URL}/settings`;
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

  // Get multipart headers for file uploads
  getMultipartHeaders() {
    const headers = {};

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

      console.log(`�� Making request to: ${url}`);
      
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`✅ Request successful:`, data);
      
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
   * Get user profile/settings
   * @returns {Promise<Object>} User profile data
   */
  async getProfile() {
    return await this.makeRequest(`${this.baseURL}/profile`, {
      method: 'GET'
    });
  }

  /**
   * Update account settings
   * @param {Object} accountData - Account data to update
   * @returns {Promise<Object>} Response object
   */
  async updateAccount(accountData) {
    return await this.makeRequest(`${this.baseURL}/account`, {
      method: 'PUT',
      body: JSON.stringify(accountData)
    });
  }

  /**
   * Update profile with file upload support
   * @param {FormData} formData - Form data including files
   * @returns {Promise<Object>} Response object
   */
  async updateProfile(formData) {
    try {
      const config = {
        method: 'PUT',
        headers: this.getMultipartHeaders(),
        body: formData
      };

      console.log(`🌐 Making multipart request to: ${this.baseURL}/account`);
      
      const response = await fetch(`${this.baseURL}/account`, config);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`✅ Multipart request successful:`, data);
      
      return data;
    } catch (error) {
      console.error(`❌ Multipart request failed:`, error);
      
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error('Network error - please check your connection');
      }
      
      if (error.message.includes('401') || error.message.includes('Unauthorized')) {
        throw new Error('Authentication failed - please log in again');
      }
      
      throw error;
    }
  }

  /**
   * Update privacy settings
   * @param {Object} privacyData - Privacy settings to update
   * @returns {Promise<Object>} Response object
   */
  async updatePrivacy(privacyData) {
    return await this.makeRequest(`${this.baseURL}/privacy`, {
      method: 'PUT',
      body: JSON.stringify(privacyData)
    });
  }

  /**
   * Update notification settings
   * @param {Object} notificationData - Notification settings to update
   * @returns {Promise<Object>} Response object
   */
  async updateNotifications(notificationData) {
    return await this.makeRequest(`${this.baseURL}/notifications`, {
      method: 'PUT',
      body: JSON.stringify(notificationData)
    });
  }

  /**
   * Change password
   * @param {string} currentPassword - Current password
   * @param {string} newPassword - New password
   * @returns {Promise<Object>} Response object
   */
  async changePassword(currentPassword, newPassword) {
    return await this.makeRequest(`${this.baseURL}/password`, {
      method: 'PUT',
      body: JSON.stringify({
        currentPassword,
        newPassword
      })
    });
  }

  /**
   * Deactivate account
   * @returns {Promise<Object>} Response object
   */
  async deactivateAccount() {
    return await this.makeRequest(`${this.baseURL}/deactivate`, {
      method: 'POST'
    });
  }

  /**
   * Block user
   * @param {string} userId - User ID to block
   * @returns {Promise<Object>} Response object
   */
  async blockUser(userId) {
    return await this.makeRequest(`${this.baseURL}/block/${userId}`, {
      method: 'POST'
    });
  }

  /**
   * Unblock user
   * @param {string} userId - User ID to unblock
   * @returns {Promise<Object>} Response object
   */
  async unblockUser(userId) {
    return await this.makeRequest(`${this.baseURL}/unblock/${userId}`, {
      method: 'POST'
    });
  }

  /**
   * Get blocked users
   * @param {number} page - Page number
   * @param {number} limit - Items per page
   * @returns {Promise<Object>} Response with blocked users
   */
  async getBlockedUsers(page = 1, limit = 20) {
    return await this.makeRequest(`${this.baseURL}/blocked-users?page=${page}&limit=${limit}`, {
      method: 'GET'
    });
  }

  /**
   * Report content
   * @param {Object} reportData - Report data
   * @returns {Promise<Object>} Response object
   */
  async reportContent(reportData) {
    return await this.makeRequest(`${this.baseURL}/report`, {
      method: 'POST',
      body: JSON.stringify(reportData)
    });
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
   * Clear all authentication tokens
   */
  clearTokens() {
    if (typeof window === 'undefined') return;

    localStorage.removeItem('instagram_token');
    localStorage.removeItem('authToken');
    localStorage.removeItem('token');
    sessionStorage.removeItem('instagram_token');
    sessionStorage.removeItem('token');
    
    this.token = null;
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
const settingsAPI = new SettingsAPI();

// Auto-initialize token from storage on client-side
if (typeof window !== 'undefined') {
  settingsAPI.initializeFromStorage();
}

export default settingsAPI;

// Named exports for convenience
export {
  settingsAPI,
  SettingsAPI
};
