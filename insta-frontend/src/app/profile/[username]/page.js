'use client';

import { useState, useEffect, useCallback, useMemo, useReducer } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

import { 
  getUserProfile, 
  getUserPosts, 
  followUser, 
  unfollowUser, 
  updateUserProfile,
  isTokenValid,
  getPost,
  getPostComments,
  toggleLikePost,
  addComment
} from '../../../utils/auth';
import Layout from '../../components/Layout';
import PostModal from '../../components/PostModal';
import styles from './profile.module.css';

// Normalize user data structure - single source of truth for ID mapping
const normalizeUserData = (userData) => {
  if (!userData) return null;
  
  const id = userData._id || userData.id;
  return {
    ...userData,
    id,
    _id: id,
    bio: userData.bio || '',
    fullName: userData.fullName || userData.username || '',
    profilePicture: userData.profilePicture || null,
    followersCount: userData.followersCount || 0,
    followingCount: userData.followingCount || 0,
    postsCount: userData.postsCount || 0,
  };
};

// Reducer for complex state management
const profileReducer = (state, action) => {
  switch (action.type) {
    case 'FETCH_START':
      return {
        ...state,
        loading: true,
        postsLoading: true,
        error: '',
      };
    
    case 'FETCH_SUCCESS':
      return {
        ...state,
        user: normalizeUserData(action.payload.user),
        posts: action.payload.posts || [],
        loading: false,
        postsLoading: false,
        error: '',
      };
    
    case 'FETCH_ERROR':
      return {
        ...state,
        loading: false,
        postsLoading: false,
        error: action.payload,
      };
    
    case 'UPDATE_USER':
      return {
        ...state,
        user: normalizeUserData({
          ...state.user,
          ...action.payload,
          // Preserve counts
          postsCount: state.posts.length || state.user?.postsCount || 0,
        }),
      };
    
    case 'TOGGLE_FOLLOW':
      return {
        ...state,
        user: {
          ...state.user,
          isFollowing: action.payload.isFollowing,
          followersCount: action.payload.isFollowing 
            ? (state.user.followersCount + 1)
            : Math.max(state.user.followersCount - 1, 0),
        },
      };
    
    case 'UPDATE_POSTS':
      return {
        ...state,
        posts: action.payload,
        user: {
          ...state.user,
          postsCount: action.payload.length,
        },
      };
    
    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload,
      };
    
    case 'CLEAR_ERROR':
      return {
        ...state,
        error: '',
      };
    
    default:
      return state;
  }
};

export default function ProfilePage() {
  const [state, dispatch] = useReducer(profileReducer, {
    user: null,
    posts: [],
    loading: true,
    postsLoading: true,
    error: '',
  });
  
  const [followLoading, setFollowLoading] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isPostModalOpen, setIsPostModalOpen] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState(null);
  
  const router = useRouter();
  const params = useParams();
  const username = params.username;

  const api = useMemo(() => ({
    getPost,
    getPostComments,
    toggleLikePost,
    addComment
  }), []);

  // Token validation
  useEffect(() => {
    if (!isTokenValid()) {
      router.push('/login');
    }
  }, [router]);

  // Centralized profile fetch function
  const fetchProfileData = useCallback(async () => {
    if (!username) return;
    
    dispatch({ type: 'FETCH_START' });
    
    try {
      // Fetch profile
      const profileResult = await getUserProfile(username);
      
      if (!profileResult.success) {
        dispatch({ 
          type: 'FETCH_ERROR', 
          payload: profileResult.error || 'Failed to load profile' 
        });
        return;
      }

      const userData = normalizeUserData(profileResult.data.user);
      
      // Fetch posts
      const postsResult = await getUserPosts(userData.id);
      const posts = postsResult.success ? (postsResult.data.posts || []) : [];
      
      dispatch({ 
        type: 'FETCH_SUCCESS', 
        payload: { user: userData, posts } 
      });
      
    } catch (error) {
      console.error('Profile fetch error:', error);
      dispatch({ 
        type: 'FETCH_ERROR', 
        payload: 'Failed to load profile: ' + error.message 
      });
    }
  }, [username]);

  // Initial data load
  useEffect(() => {
    if (username) {
      fetchProfileData();
    }
  }, [username, fetchProfileData]);

  // Unified profile update handler
  const handleProfileUpdateEvent = useCallback((updatedData) => {
    console.log('Profile update received:', updatedData);
    
    if (!updatedData || !username) return;
    
    dispatch({ type: 'UPDATE_USER', payload: updatedData });
  }, [username]);

  // Profile update listeners
  useEffect(() => {
    // Custom event listener
    const handleCustomEvent = (event) => {
      if (event.detail) {
        handleProfileUpdateEvent(event.detail);
      }
    };

    // PostMessage listener
    const handlePostMessage = (event) => {
      if (event.data?.type === 'PROFILE_UPDATED' && event.data.data) {
        handleProfileUpdateEvent(event.data.data);
      }
    };

    // Visibility change handler (for tab focus)
    const handleVisibilityChange = () => {
      if (!document.hidden && username) {
        // Debounced refresh on tab focus
        const timeoutId = setTimeout(fetchProfileData, 500);
        return () => clearTimeout(timeoutId);
      }
    };

    window.addEventListener('profileUpdated', handleCustomEvent);
    window.addEventListener('message', handlePostMessage);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      window.removeEventListener('profileUpdated', handleCustomEvent);
      window.removeEventListener('message', handlePostMessage);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [username, handleProfileUpdateEvent, fetchProfileData]);

  // Follow/Unfollow handler
  const handleFollowToggle = useCallback(async () => {
    if (!state.user || followLoading) return;
    
    setFollowLoading(true);
    dispatch({ type: 'CLEAR_ERROR' });
    
    try {
      const result = state.user.isFollowing 
        ? await unfollowUser(state.user.id)
        : await followUser(state.user.id);
      
      if (result.success) {
        dispatch({ 
          type: 'TOGGLE_FOLLOW', 
          payload: { isFollowing: result.data.isFollowing } 
        });
      } else {
        dispatch({ 
          type: 'SET_ERROR', 
          payload: result.error || 'Failed to update follow status' 
        });
      }
    } catch (error) {
      console.error('Follow toggle error:', error);
      dispatch({ 
        type: 'SET_ERROR', 
        payload: 'Failed to update follow status' 
      });
    } finally {
      setFollowLoading(false);
    }
  }, [state.user, followLoading]);

  // Profile update from modal
  const handleProfileUpdate = useCallback((updatedUser) => {
    dispatch({ type: 'UPDATE_USER', payload: updatedUser });
    setShowEditModal(false);
  }, []);

  // Post modal handlers
  const handlePostClick = useCallback((postId) => {
    setSelectedPostId(postId);
    setIsPostModalOpen(true);
  }, []);

  const closePostModal = useCallback(() => {
    setIsPostModalOpen(false);
    setSelectedPostId(null);
  }, []);

  // Number formatting
  const formatNumber = useCallback((num) => {
    const number = Number(num) || 0;
    if (number >= 1000000) return (number / 1000000).toFixed(1) + 'M';
    if (number >= 1000) return (number / 1000).toFixed(1) + 'K';
    return number.toString();
  }, []);

  // Loading state
  if (state.loading) {
    return (
      <Layout>
        <div className={styles.container}>
          <div className={styles.loading}>Loading profile...</div>
        </div>
      </Layout>
    );
  }

  // Error state
  if (state.error && !state.user) {
    return (
      <Layout>
        <div className={styles.container}>
          <div className={styles.error}>
            {state.error}
            <button onClick={fetchProfileData} className={styles.retryButton}>
              Retry
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  // User not found
  if (!state.user) {
    return (
      <Layout>
        <div className={styles.container}>
          <div className={styles.error}>User not found</div>
        </div>
      </Layout>
    );
  }

  const { user, posts, postsLoading, error } = state;
  const displayPostsCount = posts.length || user.postsCount || 0;

  return (
    <Layout>
      <div className={styles.container}>
        {/* Profile Section */}
        <div className={styles.profileSection}>
          <div className={styles.profileHeader}>
            <div className={styles.profilePictureContainer}>
              <img 
                src={user.profilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.fullName)}&size=150&background=0095f6&color=fff`}
                alt={user.fullName}
                className={styles.profilePicture}
                onError={(e) => {
                  e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.fullName)}&size=150&background=0095f6&color=fff`;
                }}
              />
            </div>

            <div className={styles.profileInfo}>
              <div className={styles.profileTop}>
                <h1 className={styles.username}>{user.username}</h1>
                
                {user.isOwnProfile ? (
                  <div className={styles.profileActions}>
                    <button 
                      onClick={() => setShowEditModal(true)}
                      className={styles.editButton}
                    >
                      Edit Profile
                    </button>
                    <Link href="/settings" className={styles.settingsButton}>
                      Settings
                    </Link>
                  </div>
                ) : (
                  <div className={styles.profileActions}>
                    <button 
                      onClick={handleFollowToggle}
                      disabled={followLoading}
                      className={`${styles.followButton} ${user.isFollowing ? styles.following : styles.notFollowing}`}
                    >
                      {followLoading ? 'Loading...' : (user.isFollowing ? 'Following' : 'Follow')}
                    </button>
                  </div>
                )}
              </div>

              <div className={styles.stats}>
                <div className={styles.stat}>
                  <span className={styles.statNumber}>{formatNumber(displayPostsCount)}</span>
                  <span className={styles.statLabel}>posts</span>
                </div>
                <div className={styles.stat}>
                  <span className={styles.statNumber}>{formatNumber(user.followersCount)}</span>
                  <span className={styles.statLabel}>followers</span>
                </div>
                <div className={styles.stat}>
                  <span className={styles.statNumber}>{formatNumber(user.followingCount)}</span>
                  <span className={styles.statLabel}>following</span>
                </div>
              </div>

              <div className={styles.bio}>
                <div className={styles.fullName}>{user.fullName}</div>
                {user.bio && (
                  <div className={styles.bioText}>{user.bio}</div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Posts Grid */}
        <div className={styles.postsSection}>
          <div className={styles.postsHeader}>
            <div className={styles.postsTab}>
              <span className={styles.postsIcon}>⊞</span>
              POSTS
            </div>
          </div>

          {postsLoading ? (
            <div className={styles.postsLoading}>Loading posts...</div>
          ) : posts.length === 0 ? (
            <div className={styles.noPosts}>
              <div className={styles.noPostsIcon}>📷</div>
              <h3>No Posts Yet</h3>
              <p>
                {user.isOwnProfile 
                  ? "Share your first photo to get started!"
                  : `When ${user.username} shares photos, you'll see them here.`
                }
              </p>
            </div>
          ) : (
            <div className={styles.postsGrid}>
              {posts.map((post) => {
                const postId = post._id || post.id;
                const imageUrl = post.imageUrl || post.media?.[0]?.url;
                const likesCount = post.likesCount || post.likes?.length || 0;
                const commentsCount = post.commentsCount || post.comments?.length || 0;
                
                return (
                  <div 
                    key={postId} 
                    className={styles.postItem}
                    onClick={() => handlePostClick(postId)}
                    style={{ cursor: 'pointer' }}
                  >
                    <img 
                      src={imageUrl} 
                      alt={post.caption || 'Post'}
                      className={styles.postImage}
                      onError={(e) => {
                        e.target.src = 'https://via.placeholder.com/300x300/f0f0f0/999999?text=Image+Not+Found';
                      }}
                    />
                    <div className={styles.postOverlay}>
                      <div className={styles.postStats}>
                        <span className={styles.postStat}>
                          ❤️ {formatNumber(likesCount)}
                        </span>
                        <span className={styles.postStat}>
                          💬 {formatNumber(commentsCount)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div className={styles.errorMessage}>
            {error}
            <button 
              onClick={() => dispatch({ type: 'CLEAR_ERROR' })} 
              className={styles.dismissError}
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Modals */}
        {showEditModal && (
          <EditProfileModal 
            user={user}
            onClose={() => setShowEditModal(false)}
            onUpdate={handleProfileUpdate}
          />
        )}

        <PostModal
          postId={selectedPostId}
          isOpen={isPostModalOpen}
          onClose={closePostModal}
          api={api}
        />
      </div>
    </Layout>
  );
}

// Edit Profile Modal
function EditProfileModal({ user, onClose, onUpdate }) {
  const [formData, setFormData] = useState({
    fullName: user.fullName || '',
    bio: user.bio || ''
  });
  const [profilePicture, setProfilePicture] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleInputChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  }, []);

  const handleFileChange = useCallback((e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validation
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image size must be less than 5MB');
      return;
    }
    
    setProfilePicture(file);
    setError('');
    
    // Preview
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target.result);
    reader.readAsDataURL(file);
  }, []);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    
    if (!formData.fullName.trim()) {
      setError('Full name is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const updateData = new FormData();
      updateData.append('fullName', formData.fullName.trim());
      updateData.append('bio', formData.bio.trim());
      
      if (profilePicture) {
        updateData.append('profilePicture', profilePicture);
      }

      const result = await updateUserProfile(updateData);

      if (result.success) {
        const updatedUser = normalizeUserData(
          result.data.user || {
            ...user,
            ...formData,
            profilePicture: preview || user.profilePicture
          }
        );
        onUpdate(updatedUser);
      } else {
        setError(result.error || 'Failed to update profile');
      }
    } catch (error) {
      console.error('Profile update error:', error);
      setError('Failed to update profile');
    } finally {
      setLoading(false);
    }
  }, [formData, profilePicture, preview, user, onUpdate]);

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h2>Edit Profile</h2>
          <button onClick={onClose} className={styles.closeButton}>×</button>
        </div>

        <form onSubmit={handleSubmit} className={styles.modalForm}>
          {error && <div className={styles.error}>{error}</div>}

          <div className={styles.formGroup}>
            <label htmlFor="profilePicture">Profile Picture</label>
            <div className={styles.profilePictureUpload}>
              <img 
                src={preview || user.profilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.fullName)}&size=100&background=0095f6&color=fff`}
                alt="Profile"
                className={styles.previewImage}
              />
              <input
                type="file"
                id="profilePicture"
                accept="image/*"
                onChange={handleFileChange}
                className={styles.fileInput}
              />
              <label htmlFor="profilePicture" className={styles.fileInputLabel}>
                Change Photo
              </label>
            </div>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="fullName">Full Name</label>
            <input
              type="text"
              id="fullName"
              name="fullName"
              value={formData.fullName}
              onChange={handleInputChange}
              className={styles.input}
              maxLength={50}
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="bio">Bio</label>
            <textarea
              id="bio"
              name="bio"
              value={formData.bio}
              onChange={handleInputChange}
              className={styles.textarea}
              maxLength={150}
              rows={3}
              placeholder="Tell us about yourself..."
            />
            <div className={styles.charCount}>{formData.bio.length}/150</div>
          </div>

          <div className={styles.modalActions}>
            <button 
              type="button" 
              onClick={onClose}
              className={styles.cancelButton}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={loading}
              className={styles.saveButton}
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
