'use client';
import { useState, useEffect, useCallback } from 'react';
import { settingsAPI } from '../../utils/settings';
import './settings.css';

export default function SettingsPage() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('account');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [profilePictureFile, setProfilePictureFile] = useState(null);

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

  const clearAllTokens = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('instagram_token');
      localStorage.removeItem('authToken');
      localStorage.removeItem('token');
      sessionStorage.removeItem('instagram_token');
      sessionStorage.removeItem('token');
    }
  }, []);

  const showMessage = useCallback((msg) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 5000);
  }, []);

  const loadUserData = useCallback(async () => {
    try {
      console.log('Loading user data...');
      
      if (typeof window === 'undefined') {
        return;
      }
      
      const token = localStorage.getItem('instagram_token') || 
                    localStorage.getItem('authToken') || 
                    localStorage.getItem('token') ||
                    sessionStorage.getItem('instagram_token') ||
                    sessionStorage.getItem('token');
      
      if (!token) {
        showMessage('Please log in to access settings');
        setTimeout(() => window.location.href = '/login', 2000);
        return;
      }

      const tokenParts = token.split('.');
      if (tokenParts.length !== 3) {
        clearAllTokens();
        showMessage('Invalid session, please log in again');
        setTimeout(() => window.location.href = '/login', 2000);
        return;
      }

      settingsAPI.setToken(token);
      const response = await settingsAPI.getProfile();
      
      if (response.success || response.user) {
        const userData = response.user || response.data?.user || response.data;
        
        if (!userData) {
          throw new Error('No user data in response');
        }
        
        setUser(userData);
        
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
        
      } else {
        throw new Error(response.error || 'Failed to load user data');
      }
    } catch (loadError) {
      console.error('Load user data error:', loadError);
      
      if (loadError.message.includes('Authentication failed') || 
          loadError.message.includes('401') ||
          loadError.message.includes('Unauthorized')) {
        clearAllTokens();
        showMessage('Session expired. Please log in again.');
        setTimeout(() => window.location.href = '/login', 2000);
      } else if (loadError.message.includes('Network error')) {
        showMessage('Connection error. Please check your internet.');
      } else {
        showMessage(`Failed to load user data: ${loadError.message}`);
      }
      
    } finally {
      setInitialLoading(false);
    }
  }, [clearAllTokens, showMessage]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const timer = setTimeout(() => loadUserData(), 200);
      return () => clearTimeout(timer);
    }
  }, [loadUserData]);

  const handleProfilePictureChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        showMessage('File size must be less than 5MB');
        return;
      }
      if (!file.type.startsWith('image/')) {
        showMessage('Please select a valid image file');
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
      console.log('Updating account - Bio:', accountForm.bio, 'Length:', accountForm.bio?.length || 0);
      
      const formData = new FormData();
      
      formData.append('fullName', accountForm.fullName || '');
      formData.append('bio', accountForm.bio || '');
      
      if (accountForm.website) formData.append('website', accountForm.website);
      if (accountForm.phoneNumber) formData.append('phoneNumber', accountForm.phoneNumber);
      if (accountForm.gender) formData.append('gender', accountForm.gender);
      
      if (profilePictureFile) {
        formData.append('profilePicture', profilePictureFile);
      }
      
      const response = await settingsAPI.updateProfile(formData);
      
      if (response.success && response.user) {
        setUser(response.user);
        
        setAccountForm(prev => ({
          ...prev,
          fullName: response.user.fullName || '',
          bio: response.user.bio || '',
          website: response.user.website || '',
          phoneNumber: response.user.phoneNumber || '',
          gender: response.user.gender || ''
        }));
        
        showMessage('Account updated successfully');
        setProfilePictureFile(null);
        
        const fileInput = document.querySelector('input[type="file"]');
        if (fileInput) fileInput.value = '';
        
      } else {
        throw new Error(response.error || 'Update failed');
      }
    } catch (updateError) {
      console.error('Account update error:', updateError);
      showMessage(updateError.message || 'Failed to update account');
    } finally {
      setLoading(false);
    }
  };

  const handlePrivacyUpdate = async () => {
    setLoading(true);
    try {
      const response = await settingsAPI.updatePrivacy(privacyForm);
      if (response.success && response.user) {
        setUser(response.user);
        showMessage('Privacy settings updated successfully');
      } else {
        throw new Error(response.error || 'Update failed');
      }
    } catch (error) {
      console.error('Privacy update error:', error);
      showMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleNotificationUpdate = async () => {
    setLoading(true);
    try {
      const response = await settingsAPI.updateNotifications(notificationForm);
      if (response.success && response.user) {
        setUser(response.user);
        showMessage('Notification settings updated successfully');
      } else {
        throw new Error(response.error || 'Update failed');
      }
    } catch (error) {
      console.error('Notification update error:', error);
      showMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      showMessage('New passwords do not match');
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      showMessage('New password must be at least 6 characters long');
      return;
    }
    if (passwordForm.currentPassword === passwordForm.newPassword) {
      showMessage('New password must be different from current password');
      return;
    }

    setLoading(true);
    try {
      const response = await settingsAPI.changePassword(
        passwordForm.currentPassword,
        passwordForm.newPassword
      );
      
      if (response.success) {
        setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
        showMessage('Password updated successfully');
      } else {
        throw new Error(response.error || 'Password change failed');
      }
    } catch (error) {
      console.error('Password change error:', error);
      showMessage(error.message);
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
      const response = await settingsAPI.deactivateAccount();
      
      if (response.success) {
        clearAllTokens();
        showMessage('Account deactivated successfully. Redirecting...');
        setTimeout(() => window.location.href = '/login', 3000);
      } else {
        throw new Error(response.error || 'Deactivation failed');
      }
    } catch (error) {
      console.error('Deactivation error:', error);
      showMessage(error.message);
      setLoading(false);
    }
  };

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

  if (!user) {
    return (
      <div className="error-container">
        <div className="error-content">
          <h2 className="error-title">Unable to Load Settings</h2>
          <p className="error-text">We couldn&apos;t load your account settings.</p>
          {message && <p className="error-message">{message}</p>}
          <div className="error-actions">
            <button onClick={() => window.location.reload()} className="retry-button">
              Try Again
            </button>
            <button onClick={() => window.location.href = '/login'} className="login-button">
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
          <button onClick={() => window.history.back()} className="back-button">
            ← Back
          </button>
          <h1 className="settings-title">Settings</h1>
        </div>
        
        {message && (
          <div className={`message ${
            message.includes('successfully') || message.includes('Selected') 
              ? 'message-success' : 'message-error'
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
                    onError={(e) => { e.target.src = '/default-avatar.png'; }}
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
                        New image: {profilePictureFile.name}
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

                <button type="submit" disabled={loading} className="submit-button">
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
                        disabled={loading}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>

                  <div className="setting-item">
                    <div className="setting-info">
                      <h3 className="setting-title">Show Online Status</h3>
                      <p className="setting-description">Let others see when you&apos;re active</p>
                    </div>
                    <label className="toggle-switch">
                      <input
                        type="checkbox"
                        checked={privacyForm.showOnlineStatus}
                        onChange={(e) => setPrivacyForm({...privacyForm, showOnlineStatus: e.target.checked})}
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
                        disabled={loading}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>

                  <div className="setting-item">
                    <div className="setting-info">
                      <h3 className="setting-title">Messages from Strangers</h3>
                      <p className="setting-description">Allow messages from people you don&apos;t follow</p>
                    </div>
                    <label className="toggle-switch">
                      <input
                        type="checkbox"
                        checked={privacyForm.allowMessagesFromStrangers}
                        onChange={(e) => setPrivacyForm({...privacyForm, allowMessagesFromStrangers: e.target.checked})}
                        disabled={loading}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                </div>

                <button onClick={handlePrivacyUpdate} disabled={loading} className="submit-button">
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
                        <p className="setting-description">Get notifications for {key}</p>
                      </div>
                      <label className="toggle-switch">
                        <input
                          type="checkbox"
                          checked={value}
                          onChange={(e) => setNotificationForm({...notificationForm, [key]: e.target.checked})}
                          disabled={loading}
                        />
                        <span className="toggle-slider"></span>
                      </label>
                    </div>
                  ))}
                </div>

                <button onClick={handleNotificationUpdate} disabled={loading} className="submit-button">
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
                    </p>
                    <button onClick={handleDeactivate} disabled={loading} className="danger-button">
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
