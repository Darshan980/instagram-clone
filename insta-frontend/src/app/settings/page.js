'use client';
import { useState, useEffect } from 'react';
import { settingsAPI } from '../../utils/settings';
import './settings.css';

export default function SettingsPage() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('account');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [profilePictureFile, setProfilePictureFile] = useState(null);

  // Form states with proper initialization
  const [accountForm, setAccountForm] = useState({
    username: '',
    email: '',
    fullName: '',
    bio: '',
    website: '',
    phoneNumber: '',
    gender: ''
  });

  const [privacyForm, setPrivacyForm] = useState({
    isPrivate: false,
    showOnlineStatus: true,
    allowTagging: true,
    allowMessagesFromStrangers: false
  });

  const [notificationForm, setNotificationForm] = useState({
    likes: true,
    comments: true,
    follows: true,
    mentions: true,
    messages: true
  });

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  useEffect(() => {
    // Ensure client-side only execution with proper delay
    if (typeof window !== 'undefined') {
      // Add a small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        loadUserData();
      }, 200);
      
      return () => clearTimeout(timer);
    }
  }, []);

  const loadUserData = async () => {
    try {
      console.log('🔄 Starting loadUserData...');
      
      if (typeof window === 'undefined') {
        console.log('❌ Window is undefined, skipping load');
        return;
      }
      
      // Get token with multiple fallbacks
      const token = localStorage.getItem('instagram_token') || 
                    localStorage.getItem('authToken') || 
                    localStorage.getItem('token') ||
                    sessionStorage.getItem('instagram_token') ||
                    sessionStorage.getItem('token');
      
      console.log('🔑 Token search result:', { 
        found: !!token, 
        length: token?.length,
        source: token ? (
          localStorage.getItem('instagram_token') ? 'instagram_token' :
          localStorage.getItem('authToken') ? 'authToken' :
          localStorage.getItem('token') ? 'token' :
          sessionStorage.getItem('instagram_token') ? 'session_instagram_token' :
          'session_token'
        ) : 'none'
      });
      
      if (!token) {
        console.log('❌ No token found, redirecting to login');
        showMessage('Please log in to access settings', true);
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
        return;
      }

      // Validate token format (basic JWT check)
      const tokenParts = token.split('.');
      if (tokenParts.length !== 3) {
        console.log('❌ Invalid token format, clearing and redirecting');
        clearAllTokens();
        showMessage('Invalid session, please log in again', true);
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
        return;
      }

      console.log('✅ Valid token found, setting up API and loading user data...');
      settingsAPI.setToken(token);
      
      const response = await settingsAPI.getProfile();
      console.log('👤 User data response:', response);
      
      if (response.success || response.user) {
        const userData = response.user || response.data?.user || response.data;
        
        if (!userData) {
          throw new Error('No user data in response');
        }
        
        console.log('✅ User data loaded:', {
          id: userData._id,
          username: userData.username,
          email: userData.email
        });
        
        setUser(userData);
        
        // Set form data with proper fallbacks and validation
        setAccountForm({
          username: userData.username || '',
          email: userData.email || '',
          fullName: userData.fullName || '',
          bio: userData.bio || '',
          website: userData.website || '',
          phoneNumber: userData.phoneNumber || '',
          gender: userData.gender || ''
        });

        setPrivacyForm({
          isPrivate: userData.isPrivate || false,
          showOnlineStatus: userData.settings?.privacy?.showOnlineStatus ?? true,
          allowTagging: userData.settings?.privacy?.allowTagging ?? true,
          allowMessagesFromStrangers: userData.settings?.privacy?.allowMessagesFromStrangers ?? false
        });

        setNotificationForm({
          likes: userData.settings?.notifications?.likes ?? true,
          comments: userData.settings?.notifications?.comments ?? true,
          follows: userData.settings?.notifications?.follows ?? true,
          mentions: userData.settings?.notifications?.mentions ?? true,
          messages: userData.settings?.notifications?.messages ?? true
        });
        
        console.log('✅ All form states initialized');
        
      } else {
        throw new Error(response.error || 'Failed to load user data');
      }
    } catch (loadError) {
      console.error('❌ Load user data error:', loadError);
      
      // Check if it's an authentication error
      if (loadError.message.includes('Authentication failed') || 
          loadError.message.includes('401') ||
          loadError.message.includes('Unauthorized')) {
        console.log('🔐 Authentication error detected, clearing tokens');
        clearAllTokens();
        showMessage('Session expired. Please log in again.', true);
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
      } else if (loadError.message.includes('Network error') || 
                 loadError.message.includes('fetch')) {
        showMessage('Connection error. Please check your internet and try again.', true);
      } else {
        showMessage(`Failed to load user data: ${loadError.message}`, true);
      }
      
    } finally {
      setInitialLoading(false);
    }
  };

  const clearAllTokens = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('instagram_token');
      localStorage.removeItem('authToken');
      localStorage.removeItem('token');
      sessionStorage.removeItem('instagram_token');
      sessionStorage.removeItem('token');
    }
  };

  const showMessage = (msg, isError = false) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 5000); // Increased timeout
  };

  const handleProfilePictureChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        showMessage('File size must be less than 5MB', true);
        return;
      }
      if (!file.type.startsWith('image/')) {
        showMessage('Please select a valid image file', true);
        return;
      }
      setProfilePictureFile(file);
      showMessage(`Selected image: ${file.name}`);
    }
  };

  const handleAccountUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      console.log('🔄 Updating account...', { hasProfilePicture: !!profilePictureFile });
      
      let response;
      
      // If there's a profile picture, use FormData
      if (profilePictureFile) {
        const formData = new FormData();
        Object.keys(accountForm).forEach(key => {
          if (accountForm[key] !== undefined && accountForm[key] !== '') {
            formData.append(key, accountForm[key]);
          }
        });
        formData.append('profilePicture', profilePictureFile);
        
        response = await settingsAPI.updateProfile(formData);
      } else {
        response = await settingsAPI.updateAccount(accountForm);
      }
      
      console.log('✅ Account update response:', response);
      
      if (response.success && response.user) {
        setUser(response.user);
        showMessage('Account updated successfully');
        setProfilePictureFile(null);
        
        // Reset file input
        const fileInput = document.querySelector('input[type="file"]');
        if (fileInput) fileInput.value = '';
        
      } else {
        throw new Error(response.error || 'Update failed');
      }
    } catch (updateError) {
      console.error('❌ Account update error:', updateError);
      showMessage(updateError.message, true);
    } finally {
      setLoading(false);
    }
  };

  const handlePrivacyUpdate = async () => {
    setLoading(true);
    
    try {
      console.log('🔄 Updating privacy settings...', privacyForm);
      
      const response = await settingsAPI.updatePrivacy(privacyForm);
      
      if (response.success && response.user) {
        setUser(response.user);
        showMessage('Privacy settings updated successfully');
      } else {
        throw new Error(response.error || 'Update failed');
      }
    } catch (privacyError) {
      console.error('❌ Privacy update error:', privacyError);
      showMessage(privacyError.message, true);
    } finally {
      setLoading(false);
    }
  };

  const handleNotificationUpdate = async () => {
    setLoading(true);
    
    try {
      console.log('🔄 Updating notification settings...', notificationForm);
      
      const response = await settingsAPI.updateNotifications(notificationForm);
      
      if (response.success && response.user) {
        setUser(response.user);
        showMessage('Notification settings updated successfully');
      } else {
        throw new Error(response.error || 'Update failed');
      }
    } catch (notificationError) {
      console.error('❌ Notification update error:', notificationError);
      showMessage(notificationError.message, true);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      showMessage('New passwords do not match', true);
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      showMessage('New password must be at least 6 characters long', true);
      return;
    }

    if (passwordForm.currentPassword === passwordForm.newPassword) {
      showMessage('New password must be different from current password', true);
      return;
    }

    setLoading(true);
    
    try {
      console.log('🔄 Changing password...');
      
      const response = await settingsAPI.changePassword(
        passwordForm.currentPassword,
        passwordForm.newPassword
      );
      
      if (response.success) {
        setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
        showMessage('Password updated successfully');
        console.log('✅ Password changed successfully');
      } else {
        throw new Error(response.error || 'Password change failed');
      }
    } catch (passwordError) {
      console.error('❌ Password change error:', passwordError);
      showMessage(passwordError.message, true);
    } finally {
      setLoading(false);
    }
  };

  const handleDeactivate = async () => {
    const confirmed = confirm(
      'Are you sure you want to deactivate your account? You can reactivate it later by logging in again.'
    );
    
    if (!confirmed) return;
    
    setLoading(true);
    try {
      console.log('🔄 Deactivating account...');
      
      const response = await settingsAPI.deactivateAccount();
      
      if (response.success) {
        console.log('✅ Account deactivated successfully');
        clearAllTokens();
        showMessage('Account deactivated successfully. Redirecting...', false);
        setTimeout(() => {
          window.location.href = '/login';
        }, 3000);
      } else {
        throw new Error(response.error || 'Deactivation failed');
      }
    } catch (deactivateError) {
      console.error('❌ Deactivation error:', deactivateError);
      showMessage(deactivateError.message, true);
      setLoading(false);
    }
  };

  // Loading state
  if (initialLoading) {
    return (
      <div className="loading-container">
        <div className="loading-content">
          <div className="loading-spinner"></div>
          <p className="loading-text">Loading your settings...</p>
        </div>
      </div>
    );
  }

  // Error state - no user data
  if (!user) {
    return (
      <div className="error-container">
        <div className="error-content">
          <h2 className="error-title">Unable to Load Settings</h2>
          <p className="error-text">{"We couldn't load your account settings. This might be due to a connection issue or expired session."}</p>
          {message && <p className="error-message">{message}</p>}
          <div className="error-actions">
            <button 
              onClick={() => window.location.reload()} 
              className="retry-button"
            >
              Try Again
            </button>
            <button 
              onClick={() => window.location.href = '/login'} 
              className="login-button"
            >
              Go to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="settings-page">
      <div className="settings-container">
        <div className="settings-header">
          <button 
            onClick={() => window.history.back()} 
            className="back-button"
            aria-label="Go back"
          >
            ← Back
          </button>
          <h1 className="settings-title">Settings</h1>
        </div>
        
        {message && (
          <div className={`message ${
            message.includes('successfully') || 
            message.includes('updated') ||
            message.includes('Selected') 
              ? 'message-success' 
              : 'message-error'
          }`}>
            {message}
          </div>
        )}

        <div className="settings-card">
          <div className="settings-tabs-container">
            <nav className="settings-tabs">
              {[
                { id: 'account', label: 'Account' },
                { id: 'privacy', label: 'Privacy' },
                { id: 'notifications', label: 'Notifications' },
                { id: 'password', label: 'Security' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`tab-button ${activeTab === tab.id ? 'tab-active' : ''}`}
                  disabled={loading}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="settings-content">
            {activeTab === 'account' && (
              <form onSubmit={handleAccountUpdate} className="form-container">
                <div className="profile-picture-section">
                  <img
                    src={user.profilePicture || '/default-avatar.png'}
                    alt="Profile"
                    className="profile-picture"
                    onError={(e) => {
                      e.target.src = '/default-avatar.png';
                    }}
                  />
                  <div className="profile-picture-upload">
                    <label className="form-label">Profile Picture</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleProfilePictureChange}
                      className="file-input"
                      disabled={loading}
                    />
                    {profilePictureFile && (
                      <p className="file-selected">
                        New image selected: {profilePictureFile.name}
                        <button
                          type="button"
                          onClick={() => {
                            setProfilePictureFile(null);
                            const fileInput = document.querySelector('input[type="file"]');
                            if (fileInput) fileInput.value = '';
                          }}
                          className="file-remove"
                        >
                          Remove
                        </button>
                      </p>
                    )}
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Username</label>
                    <input
                      type="text"
                      value={accountForm.username}
                      onChange={(e) => setAccountForm({...accountForm, username: e.target.value})}
                      className="form-input"
                      required
                      minLength={3}
                      maxLength={30}
                      pattern="[a-zA-Z0-9_]+"
                      title="Username can only contain letters, numbers, and underscores"
                      disabled={loading}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Email</label>
                    <input
                      type="email"
                      value={accountForm.email}
                      onChange={(e) => setAccountForm({...accountForm, email: e.target.value})}
                      className="form-input"
                      required
                      disabled={loading}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Full Name</label>
                  <input
                    type="text"
                    value={accountForm.fullName}
                    onChange={(e) => setAccountForm({...accountForm, fullName: e.target.value})}
                    className="form-input"
                    required
                    maxLength={50}
                    disabled={loading}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Bio</label>
                  <textarea
                    value={accountForm.bio}
                    onChange={(e) => setAccountForm({...accountForm, bio: e.target.value})}
                    className="form-textarea"
                    rows={3}
                    maxLength={150}
                    placeholder="Tell us about yourself..."
                    disabled={loading}
                  />
                  <p className="character-count">{accountForm.bio.length}/150 characters</p>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Website</label>
                    <input
                      type="url"
                      value={accountForm.website}
                      onChange={(e) => setAccountForm({...accountForm, website: e.target.value})}
                      className="form-input"
                      placeholder="https://yourwebsite.com"
                      disabled={loading}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Phone Number</label>
                    <input
                      type="tel"
                      value={accountForm.phoneNumber}
                      onChange={(e) => setAccountForm({...accountForm, phoneNumber: e.target.value})}
                      className="form-input"
                      disabled={loading}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Gender</label>
                  <select
                    value={accountForm.gender}
                    onChange={(e) => setAccountForm({...accountForm, gender: e.target.value})}
                    className="form-select"
                    disabled={loading}
                  >
                    <option value="">Prefer not to say</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="submit-button"
                >
                  {loading && <div className="button-spinner"></div>}
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
              </form>
            )}

            {activeTab === 'privacy' && (
              <div className="privacy-settings">
                <div className="settings-list">
                  <div className="setting-item">
                    <div className="setting-info">
                      <h3 className="setting-title">Private Account</h3>
                      <p className="setting-description">Only approved followers can see your posts</p>
                    </div>
                    <label className="toggle-switch">
                      <input
                        type="checkbox"
                        checked={privacyForm.isPrivate}
                        onChange={(e) => setPrivacyForm({...privacyForm, isPrivate: e.target.checked})}
                        className="toggle-input"
                        disabled={loading}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>

                  <div className="setting-item">
                    <div className="setting-info">
                      <h3 className="setting-title">Show Online Status</h3>
                      <p className="setting-description">Let others see when you're active</p>
                    </div>
                    <label className="toggle-switch">
                      <input
                        type="checkbox"
                        checked={privacyForm.showOnlineStatus}
                        onChange={(e) => setPrivacyForm({...privacyForm, showOnlineStatus: e.target.checked})}
                        className="toggle-input"
                        disabled={loading}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>

                  <div className="setting-item">
                    <div className="setting-info">
                      <h3 className="setting-title">Allow Tagging</h3>
                      <p className="setting-description">Let others tag you in their posts</p>
                    </div>
                    <label className="toggle-switch">
                      <input
                        type="checkbox"
                        checked={privacyForm.allowTagging}
                        onChange={(e) => setPrivacyForm({...privacyForm, allowTagging: e.target.checked})}
                        className="toggle-input"
                        disabled={loading}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>

                  <div className="setting-item">
                    <div className="setting-info">
                      <h3 className="setting-title">Messages from Strangers</h3>
                      <p className="setting-description">{"Allow direct messages from people you don't follow"}</p>
                    </div>
                    <label className="toggle-switch">
                      <input
                        type="checkbox"
                        checked={privacyForm.allowMessagesFromStrangers}
                        onChange={(e) => setPrivacyForm({...privacyForm, allowMessagesFromStrangers: e.target.checked})}
                        className="toggle-input"
                        disabled={loading}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                </div>

                <button
                  onClick={handlePrivacyUpdate}
                  disabled={loading}
                  className="submit-button"
                >
                  {loading && <div className="button-spinner"></div>}
                  {loading ? 'Saving...' : 'Save Privacy Settings'}
                </button>
              </div>
            )}

            {activeTab === 'notifications' && (
              <div className="notification-settings">
                <div className="settings-list">
                  {Object.entries(notificationForm).map(([key, value]) => (
                    <div key={key} className="setting-item">
                      <div className="setting-info">
                        <h3 className="setting-title">{key.charAt(0).toUpperCase() + key.slice(1)}</h3>
                        <p className="setting-description">Get notifications when someone {key} your content</p>
                      </div>
                      <label className="toggle-switch">
                        <input
                          type="checkbox"
                          checked={value}
                          onChange={(e) => setNotificationForm({...notificationForm, [key]: e.target.checked})}
                          className="toggle-input"
                          disabled={loading}
                        />
                        <span className="toggle-slider"></span>
                      </label>
                    </div>
                  ))}
                </div>

                <button
                  onClick={handleNotificationUpdate}
                  disabled={loading}
                  className="submit-button"
                >
                  {loading && <div className="button-spinner"></div>}
                  {loading ? 'Saving...' : 'Save Notification Settings'}
                </button>
              </div>
            )}

            {activeTab === 'password' && (
              <div className="password-settings">
                <form onSubmit={handlePasswordChange} className="password-form">
                  <div className="form-group">
                    <label className="form-label">Current Password</label>
                    <input
                      type="password"
                      value={passwordForm.currentPassword}
                      onChange={(e) => setPasswordForm({...passwordForm, currentPassword: e.target.value})}
                      className="form-input"
                      required
                      minLength={6}
                      disabled={loading}
                      placeholder="Enter your current password"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">New Password</label>
                    <input
                      type="password"
                      value={passwordForm.newPassword}
                      onChange={(e) => setPasswordForm({...passwordForm, newPassword: e.target.value})}
                      className="form-input"
                      required
                      minLength={6}
                      disabled={loading}
                      placeholder="Enter new password"
                    />
                    <p className="field-help">Password must be at least 6 characters long</p>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Confirm New Password</label>
                    <input
                      type="password"
                      value={passwordForm.confirmPassword}
                      onChange={(e) => setPasswordForm({...passwordForm, confirmPassword: e.target.value})}
                      className="form-input"
                      required
                      minLength={6}
                      disabled={loading}
                      placeholder="Confirm new password"
                    />
                    {passwordForm.confirmPassword && passwordForm.newPassword !== passwordForm.confirmPassword && (
                      <p className="field-error">Passwords do not match</p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={loading || passwordForm.newPassword !== passwordForm.confirmPassword}
                    className="submit-button"
                  >
                    {loading && <div className="button-spinner"></div>}
                    {loading ? 'Changing...' : 'Change Password'}
                  </button>
                </form>

                <div className="danger-zone">
                  <h3 className="danger-title">Danger Zone</h3>
                  
                  <div className="danger-section">
                    <h4 className="danger-subtitle">Deactivate Account</h4>
                    <p className="danger-description">
                      Temporarily disable your account. You can reactivate it anytime by logging in again.
                      Your profile, posts, and data will be hidden but preserved.
                    </p>
                    <button
                      onClick={handleDeactivate}
                      disabled={loading}
                      className="danger-button"
                    >
                      {loading && <div className="button-spinner"></div>}
                      {loading ? 'Deactivating...' : 'Deactivate Account'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
