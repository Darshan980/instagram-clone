// utils/settings/settingauth.js

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:10000/api';

class SettingsAuthAPI {
  constructor() {
    this.token = null;
    this.baseURL = `${API_BASE_URL}/settings/auth`;
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

      console.log(`🌐 Making request to: ${url}`);
      
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
   * Change user password
   * @param {string} currentPassword - Current password
   * @param {string} newPassword - New password
   * @param {string} confirmNewPassword - Confirmation of new password
   * @returns {Promise<Object>} Response object
   */
  async changePassword(currentPassword, newPassword, confirmNewPassword) {
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      throw new Error('All password fields are required');
    }

    if (newPassword !== confirmNewPassword) {
      throw new Error('New passwords do not match');
    }

    if (newPassword.length < 6) {
      throw new Error('New password must be at least 6 characters long');
    }

    if (currentPassword === newPassword) {
      throw new Error('New password must be different from current password');
    }

    const requestData = {
      currentPassword,
      newPassword,
      confirmNewPassword
    };

    return await this.makeRequest(`${this.baseURL}/password`, {
      method: 'PUT',
      body: JSON.stringify(requestData)
    });
  }

  /**
   * Change user email
   * @param {string} newEmail - New email address
   * @param {string} password - Current password for verification
   * @returns {Promise<Object>} Response object
   */
  async changeEmail(newEmail, password) {
    if (!newEmail || !password) {
      throw new Error('New email and password are required');
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      throw new Error('Please provide a valid email address');
    }

    const requestData = {
      newEmail: newEmail.toLowerCase().trim(),
      password
    };

    return await this.makeRequest(`${this.baseURL}/email`, {
      method: 'PUT',
      body: JSON.stringify(requestData)
    });
  }

  /**
   * Deactivate user account
   * @param {string} password - Current password for verification
   * @param {string} reason - Optional reason for deactivation
   * @returns {Promise<Object>} Response object
   */
  async deactivateAccount(password, reason = '') {
    if (!password) {
      throw new Error('Password is required to deactivate account');
    }

    const requestData = {
      password,
      ...(reason && { reason })
    };

    return await this.makeRequest(`${this.baseURL}/deactivate`, {
      method: 'POST',
      body: JSON.stringify(requestData)
    });
  }

  /**
   * Reactivate user account
   * @returns {Promise<Object>} Response object
   */
  async reactivateAccount() {
    return await this.makeRequest(`${this.baseURL}/reactivate`, {
      method: 'POST'
    });
  }

  /**
   * Get security settings
   * @returns {Promise<Object>} Security settings data
   */
  async getSecuritySettings() {
    return await this.makeRequest(`${this.baseURL}/security-settings`, {
      method: 'GET'
    });
  }

  /**
   * Update security settings
   * @param {Object} settings - Security settings object
   * @param {boolean} settings.twoFactorEnabled - Enable/disable 2FA
   * @param {boolean} settings.loginNotifications - Enable/disable login notifications
   * @returns {Promise<Object>} Response object
   */
  async updateSecuritySettings(settings) {
    const validSettings = {};

    if (typeof settings.twoFactorEnabled === 'boolean') {
      validSettings.twoFactorEnabled = settings.twoFactorEnabled;
    }

    if (typeof settings.loginNotifications === 'boolean') {
      validSettings.loginNotifications = settings.loginNotifications;
    }

    if (Object.keys(validSettings).length === 0) {
      throw new Error('No valid security settings provided');
    }

    return await this.makeRequest(`${this.baseURL}/security-settings`, {
      method: 'PUT',
      body: JSON.stringify(validSettings)
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

  /**
   * Validate required authentication
   * @throws {Error} If not authenticated
   */
  requireAuth() {
    if (!this.isAuthenticated()) {
      throw new Error('Authentication required - please log in');
    }
  }
}

// Create and export singleton instance
const settingsAuthAPI = new SettingsAuthAPI();

// Auto-initialize token from storage on client-side
if (typeof window !== 'undefined') {
  settingsAuthAPI.initializeFromStorage();
}

export default settingsAuthAPI;

// Named exports for convenience
export {
  settingsAuthAPI,
  SettingsAuthAPI
};

