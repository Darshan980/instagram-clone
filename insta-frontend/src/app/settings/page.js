'use client';
import { useState, useEffect, useCallback } from 'react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:10000/api';

// Settings API Class
class SettingsAPI {
  constructor() {
    this.token = null;
    this.baseURL = `${API_BASE_URL}/users`;
    this.authURL = `${API_BASE_URL}/auth`;
  }

  setToken(token) {
    this.token = token;
  }

  getAuthHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
    return headers;
  }

  getMultipartHeaders() {
    const headers = {};
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
    return headers;
  }

  async makeRequest(url, options = {}) {
    try {
      const config = { headers: this.getAuthHeaders(), ...options };
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      if (error.message.includes('fetch')) throw new Error('Network error');
      if (error.message.includes('401')) throw new Error('Authentication failed');
      throw error;
    }
  }

  async getProfile() {
    try {
      const response = await fetch(`${this.authURL}/me`, {
        headers: this.getAuthHeaders()
      });
      if (response.ok) return await response.json();
      
      if (this.token) {
        const payload = JSON.parse(atob(this.token.split('.')[1]));
        const userId = payload._id || payload.id || payload.userId;
        if (userId) return await this.makeRequest(`${this.baseURL}/${userId}`, { method: 'GET' });
      }
      throw new Error('Could not load profile');
    } catch (error) {
      throw error;
    }
  }

  async updateProfile(formData) {
    try {
      const config = {
        method: 'PUT',
        headers: this.getMultipartHeaders(),
        body: formData
      };
      const response = await fetch(`${this.baseURL}/profile`, config);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      if (error.message.includes('fetch')) throw new Error('Network error');
      if (error.message.includes('401')) throw new Error('Authentication failed');
      throw error;
    }
  }

  async updateAccount(accountData) {
    // FIXED: Changed from /profile to /account endpoint
    return await this.makeRequest(`${this.baseURL}/account`, {
      method: 'PUT',
      body: JSON.stringify(accountData)
    });
  }

  async updatePrivacy(privacyData) {
    return await this.makeRequest(`${this.baseURL}/privacy`, {
      method: 'PUT',
      body: JSON.stringify(privacyData)
    });
  }

  async updateNotifications(notificationData) {
    return await this.makeRequest(`${this.baseURL}/notifications`, {
      method: 'PUT',
      body: JSON.stringify(notificationData)
    });
  }

  async changePassword(currentPassword, newPassword) {
    return await this.makeRequest(`${this.authURL}/change-password`, {
      method: 'PUT',
      body: JSON.stringify({ currentPassword, newPassword, confirmNewPassword: newPassword })
    });
  }

  async deactivateAccount() {
    return await this.makeRequest(`${this.baseURL}/deactivate`, { method: 'POST' });
  }
}

const settingsAPI = new SettingsAPI();

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
      if (typeof window === 'undefined') return;
      
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
        
        if (!userData) throw new Error('No user data in response');
        
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
      // Check if username or email changed
      const hasUsernameOrEmail = accountForm.username !== user.username || accountForm.email !== user.email;
      
      // If username/email changed, show error message (backend doesn't support this via /profile)
      if (hasUsernameOrEmail) {
        showMessage('Username and email changes are currently not supported. Please contact support.');
        setLoading(false);
        return;
      }
      
      // Use /profile endpoint for all updates (FormData)
      const formData = new FormData();
      formData.append('fullName', accountForm.fullName.trim());
      formData.append('bio', accountForm.bio.trim());
      
      if (accountForm.website?.trim()) formData.append('website', accountForm.website.trim());
      if (accountForm.phoneNumber?.trim()) formData.append('phoneNumber', accountForm.phoneNumber.trim());
      if (accountForm.gender) formData.append('gender', accountForm.gender);
      if (profilePictureFile) formData.append('profilePicture', profilePictureFile);
      
      const response = await settingsAPI.updateProfile(formData);
      
      if (response.success && response.user) {
        setUser(response.user);
        
        setAccountForm({
          username: response.user.username || '',
          email: response.user.email || '',
          fullName: response.user.fullName || '',
          bio: response.user.bio || '',
          website: response.user.website || '',
          phoneNumber: response.user.phoneNumber || '',
          gender: response.user.gender || ''
        });
        
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
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#fafafa' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 50, height: 50, border: '3px solid #dbdbdb', borderTop: '3px solid #3897f0', borderRadius: '50%', margin: '0 auto 20px', animation: 'spin 1s linear infinite' }}></div>
          <p style={{ color: '#262626' }}>Loading your settings...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#fafafa' }}>
        <div style={{ textAlign: 'center', maxWidth: 400, padding: 20 }}>
          <h2 style={{ marginBottom: 10 }}>Unable to Load Settings</h2>
          <p style={{ color: '#737373', marginBottom: 20 }}>We couldn&apos;t load your account settings.</p>
          <button onClick={() => window.location.reload()} style={{ padding: '10px 20px', marginRight: 10, background: '#3897f0', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
            Try Again
          </button>
          <button onClick={() => window.location.href = '/login'} style={{ padding: '10px 20px', background: '#fff', border: '1px solid #dbdbdb', borderRadius: 4, cursor: 'pointer' }}>
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#fafafa', padding: '20px 0' }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .settings-input { width: 100%; padding: 10px; border: 1px solid #dbdbdb; borderRadius: 4px; fontSize: 14px; }
        .settings-input:focus { outline: none; border-color: #3897f0; }
        .settings-textarea { width: 100%; padding: 10px; border: 1px solid #dbdbdb; borderRadius: 4px; fontSize: 14px; resize: vertical; }
        .settings-select { width: 100%; padding: 10px; border: 1px solid #dbdbdb; borderRadius: 4px; fontSize: 14px; background: white; }
        .toggle-switch { position: relative; display: inline-block; width: 51px; height: 31px; }
        .toggle-switch input { opacity: 0; width: 0; height: 0; }
        .toggle-slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #ccc; transition: .4s; border-radius: 34px; }
        .toggle-slider:before { position: absolute; content: ""; height: 23px; width: 23px; left: 4px; bottom: 4px; background-color: white; transition: .4s; border-radius: 50%; }
        input:checked + .toggle-slider { background-color: #3897f0; }
        input:checked + .toggle-slider:before { transform: translateX(20px); }
      `}</style>
      
      <div style={{ maxWidth: 935, margin: '0 auto', background: 'white', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <div style={{ padding: '20px 30px', borderBottom: '1px solid #dbdbdb', display: 'flex', alignItems: 'center', gap: 15 }}>
          <button onClick={() => window.history.back()} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: '#262626' }}>←</button>
          <h1 style={{ fontSize: 24, fontWeight: 600, margin: 0 }}>Settings</h1>
        </div>
        
        {message && (
          <div style={{ padding: '12px 30px', background: message.includes('successfully') || message.includes('Selected') ? '#d4edda' : '#f8d7da', color: message.includes('successfully') || message.includes('Selected') ? '#155724' : '#721c24', borderBottom: '1px solid #dbdbdb' }}>
            {message}
          </div>
        )}

        <div style={{ display: 'flex', borderBottom: '1px solid #dbdbdb' }}>
          {[
            { id: 'account', label: 'Account' },
            { id: 'privacy', label: 'Privacy' },
            { id: 'notifications', label: 'Notifications' },
            { id: 'password', label: 'Security' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{ padding: '15px 30px', background: 'none', border: 'none', borderBottom: activeTab === tab.id ? '2px solid #262626' : '2px solid transparent', cursor: 'pointer', fontWeight: activeTab === tab.id ? 600 : 400, color: activeTab === tab.id ? '#262626' : '#8e8e8e' }}
              disabled={loading}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div style={{ padding: 30 }}>
          {activeTab === 'account' && (
            <form onSubmit={handleAccountUpdate}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 30, marginBottom: 30, paddingBottom: 30, borderBottom: '1px solid #efefef' }}>
                <img
                  src={user.profilePicture || '/default-avatar.png'}
                  alt="Profile"
                  style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover' }}
                  onError={(e) => { e.target.src = '/default-avatar.png'; }}
                />
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: 8 }}>Profile Picture</label>
                  <input type="file" accept="image/*" onChange={handleProfilePictureChange} style={{ fontSize: 14 }} disabled={loading} />
                  {profilePictureFile && (
                    <p style={{ marginTop: 8, fontSize: 13, color: '#737373' }}>
                      New image: {profilePictureFile.name}
                      <button type="button" onClick={() => { setProfilePictureFile(null); const fileInput = document.querySelector('input[type="file"]'); if (fileInput) fileInput.value = ''; }} style={{ marginLeft: 10, color: '#ed4956', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Remove</button>
                    </p>
                  )}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: 8 }}>Username</label>
                  <input type="text" value={accountForm.username} onChange={(e) => setAccountForm({...accountForm, username: e.target.value})} className="settings-input" disabled={loading} minLength={3} maxLength={30} placeholder="Enter username" />
                  <p style={{ fontSize: 12, color: '#737373', marginTop: 4 }}>3-30 characters, letters, numbers, underscores only</p>
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: 8 }}>Email</label>
                  <input type="email" value={accountForm.email} onChange={(e) => setAccountForm({...accountForm, email: e.target.value})} className="settings-input" disabled={loading} placeholder="Enter email" />
                  <p style={{ fontSize: 12, color: '#737373', marginTop: 4 }}>Must be a valid email address</p>
                </div>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: 8 }}>Full Name *</label>
                <input type="text" value={accountForm.fullName} onChange={(e) => setAccountForm({...accountForm, fullName: e.target.value})} className="settings-input" required maxLength={50} disabled={loading} placeholder="Enter your full name" />
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: 8 }}>Bio</label>
                <textarea value={accountForm.bio} onChange={(e) => setAccountForm({...accountForm, bio: e.target.value})} className="settings-textarea" rows={3} maxLength={150} placeholder="Tell us about yourself..." disabled={loading} />
                <p style={{ fontSize: 12, color: '#737373', marginTop: 4 }}>{accountForm.bio.length}/150 characters</p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: 8 }}>Website</label>
                  <input type="url" value={accountForm.website} onChange={(e) => setAccountForm({...accountForm, website: e.target.value})} className="settings-input" placeholder="https://yourwebsite.com" disabled={loading} />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: 8 }}>Phone Number</label>
                  <input type="tel" value={accountForm.phoneNumber} onChange={(e) => setAccountForm({...accountForm, phoneNumber: e.target.value})} className="settings-input" placeholder="+1 234 567 8900" disabled={loading} />
                </div>
              </div>

              <div style={{ marginBottom: 30 }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: 8 }}>Gender</label>
                <select value={accountForm.gender} onChange={(e) => setAccountForm({...accountForm, gender: e.target.value})} className="settings-select" disabled={loading}>
                  <option value="">Prefer not to say</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <button type="submit" disabled={loading} style={{ padding: '10px 30px', background: loading ? '#b2dffc' : '#3897f0', color: 'white', border: 'none', borderRadius: 4, cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: 14 }}>
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </form>
          )}

          {activeTab === 'privacy' && (
            <div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginBottom: 30 }}>
                {[
                  { key: 'isPrivate', title: 'Private Account', desc: 'Only approved followers can see your posts' },
                  { key: 'showOnlineStatus', title: 'Show Online Status', desc: 'Let others see when you are active' },
                  { key: 'allowTagging', title: 'Allow Tagging', desc: 'Let others tag you in their posts' },
                  { key: 'allowMessagesFromStrangers', title: 'Messages from Strangers', desc: 'Allow messages from people you do not follow' }
                ].map(({ key, title, desc }) => (
                  <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 0', borderBottom: '1px solid #efefef' }}>
                    <div>
                      <h3 style={{ margin: 0, marginBottom: 4, fontSize: 16, fontWeight: 600 }}>{title}</h3>
                      <p style={{ margin: 0, fontSize: 14, color: '#737373' }}>{desc}</p>
                    </div>
                    <label className="toggle-switch">
                      <input type="checkbox" checked={privacyForm[key]} onChange={(e) => setPrivacyForm({...privacyForm, [key]: e.target.checked})} disabled={loading} />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                ))}
              </div>
              <button onClick={handlePrivacyUpdate} disabled={loading} style={{ padding: '10px 30px', background: loading ? '#b2dffc' : '#3897f0', color: 'white', border: 'none', borderRadius: 4, cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: 14 }}>
                {loading ? 'Saving...' : 'Save Privacy Settings'}
              </button>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginBottom: 30 }}>
                {Object.entries(notificationForm).map(([key, value]) => (
                  <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 0', borderBottom: '1px solid #efefef' }}>
                    <div>
                      <h3 style={{ margin: 0, marginBottom: 4, fontSize: 16, fontWeight: 600 }}>{key.charAt(0).toUpperCase() + key.slice(1)}</h3>
                      <p style={{ margin: 0, fontSize: 14, color: '#737373' }}>Get notifications for {key}</p>
                    </div>
                    <label className="toggle-switch">
                      <input type="checkbox" checked={value} onChange={(e) => setNotificationForm({...notificationForm, [key]: e.target.checked})} disabled={loading} />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                ))}
              </div>
              <button onClick={handleNotificationUpdate} disabled={loading} style={{ padding: '10px 30px', background: loading ? '#b2dffc' : '#3897f0', color: 'white', border: 'none', borderRadius: 4, cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: 14 }}>
                {loading ? 'Saving...' : 'Save Notification Settings'}
              </button>
            </div>
          )}

          {activeTab === 'password' && (
            <div>
              <form onSubmit={handlePasswordChange} style={{ marginBottom: 40 }}>
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: 8 }}>Current Password</label>
                  <input type="password" value={passwordForm.currentPassword} onChange={(e) => setPasswordForm({...passwordForm, currentPassword: e.target.value})} className="settings-input" required minLength={6} disabled={loading} placeholder="Enter your current password" />
                </div>
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: 8 }}>New Password</label>
                  <input type="password" value={passwordForm.newPassword} onChange={(e) => setPasswordForm({...passwordForm, newPassword: e.target.value})} className="settings-input" required minLength={6} disabled={loading} placeholder="Enter new password" />
                  <p style={{ fontSize: 12, color: '#737373', marginTop: 4 }}>Password must be at least 6 characters long</p>
                </div>
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: 8 }}>Confirm New Password</label>
                  <input type="password" value={passwordForm.confirmPassword} onChange={(e) => setPasswordForm({...passwordForm, confirmPassword: e.target.value})} className="settings-input" required minLength={6} disabled={loading} placeholder="Confirm new password" />
                  {passwordForm.confirmPassword && passwordForm.newPassword !== passwordForm.confirmPassword && (
                    <p style={{ fontSize: 12, color: '#ed4956', marginTop: 4 }}>Passwords do not match</p>
                  )}
                </div>
                <button type="submit" disabled={loading || passwordForm.newPassword !== passwordForm.confirmPassword} style={{ padding: '10px 30px', background: loading ? '#b2dffc' : '#3897f0', color: 'white', border: 'none', borderRadius: 4, cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: 14 }}>
                  {loading ? 'Changing...' : 'Change Password'}
                </button>
              </form>

              <div style={{ background: '#fff5f5', border: '1px solid #fed7d7', borderRadius: 8, padding: 20 }}>
                <h3 style={{ color: '#c53030', margin: '0 0 10px 0', fontSize: 18 }}>Danger Zone</h3>
                <div style={{ marginTop: 20 }}>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: 16 }}>Deactivate Account</h4>
                  <p style={{ color: '#737373', fontSize: 14, marginBottom: 15 }}>Temporarily disable your account. You can reactivate it anytime by logging in again.</p>
                  <button onClick={handleDeactivate} disabled={loading} style={{ padding: '10px 30px', background: loading ? '#fbb' : '#ed4956', color: 'white', border: 'none', borderRadius: 4, cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: 14 }}>
                    {loading ? 'Deactivating...' : 'Deactivate Account'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
