'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
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

export default function ProfilePage() {
  const [user, setUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [postsLoading, setPostsLoading] = useState(true);
  const [error, setError] = useState('');
  const [followLoading, setFollowLoading] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  
  // PostModal states
  const [isPostModalOpen, setIsPostModalOpen] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState(null);
  
  const router = useRouter();
  const params = useParams();
  const username = params.username;

  // Memoized API object
  const api = useMemo(() => ({
    getPost,
    getPostComments,
    toggleLikePost,
    addComment
  }), []);

  // Token validation effect
  useEffect(() => {
    if (!isTokenValid()) {
      router.push('/login');
      return;
    }
  }, [router]);

  // Main data fetching effect
  useEffect(() => {
    if (username) {
      fetchProfileData();
    }
  }, [username]);

  // Profile update listener
  useEffect(() => {
    const handleProfileUpdateEvent = (event) => {
      console.log('Profile update event received');
      
      if (event.detail && username) {
        const updatedUserData = event.detail;
        
        setUser(prev => {
          if (!prev) return updatedUserData;
          
          return {
            ...prev,
            ...updatedUserData,
            bio: updatedUserData.bio !== undefined ? updatedUserData.bio : prev.bio,
            fullName: updatedUserData.fullName !== undefined ? updatedUserData.fullName : prev.fullName,
            profilePicture: updatedUserData.profilePicture !== undefined ? updatedUserData.profilePicture : prev.profilePicture,
            postsCount: prev.actualPostsCount || prev.postsCount || 0,
            actualPostsCount: prev.actualPostsCount || prev.postsCount || 0,
            followersCount: updatedUserData.followersCount !== undefined ? updatedUserData.followersCount : (prev.followersCount || 0),
            followingCount: updatedUserData.followingCount !== undefined ? updatedUserData.followingCount : (prev.followingCount || 0),
            isFollowing: prev.isFollowing,
            isOwnProfile: prev.isOwnProfile
          };
        });
      }
    };

    window.addEventListener('profileUpdated', handleProfileUpdateEvent);
    
    return () => {
      window.removeEventListener('profileUpdated', handleProfileUpdateEvent);
    };
  }, [username]);

  const fetchProfileData = useCallback(async () => {
    if (!username) return;
    
    setLoading(true);
    setPostsLoading(true);
    setError('');
    
    try {
      console.log('Fetching profile for:', username);
      
      const profileResult = await getUserProfile(username);
      
      if (!profileResult.success || !profileResult.data) {
        setError(profileResult.error || 'Failed to load profile');
        setLoading(false);
        setPostsLoading(false);
        return;
      }

      const userData = profileResult.data.user || profileResult.data;
      
      if (!userData) {
        setError('User data not found');
        setLoading(false);
        setPostsLoading(false);
        return;
      }
      
      const completeUserData = {
        ...userData,
        bio: userData.bio !== undefined ? userData.bio : '',
        fullName: userData.fullName || userData.username || '',
        profilePicture: userData.profilePicture || null,
        followersCount: userData.followersCount || 0,
        followingCount: userData.followingCount || 0,
        postsCount: userData.postsCount || 0
      };
      
      setUser(completeUserData);

      // Fetch user posts
      const userId = userData._id || userData.id;
      if (userId) {
        const postsResult = await getUserPosts(userId);
        
        if (postsResult.success) {
          const userPosts = postsResult.data.posts || [];
          setPosts(userPosts);
          
          setUser(prev => ({
            ...prev,
            postsCount: userPosts.length,
            actualPostsCount: userPosts.length
          }));
        } else {
          setPosts([]);
          setUser(prev => ({
            ...prev,
            postsCount: 0,
            actualPostsCount: 0
          }));
        }
      } else {
        setPosts([]);
      }

    } catch (fetchError) {
      console.error('Profile fetch error:', fetchError);
      setError('Failed to load profile data');
      setPosts([]);
    } finally {
      setLoading(false);
      setPostsLoading(false);
    }
  }, [username]);

  const handleFollowToggle = useCallback(async () => {
    if (!user || followLoading) return;
    
    setFollowLoading(true);
    setError('');
    
    try {
      const userId = user._id || user.id;
      
      if (!userId) {
        setError('User ID not found');
        return;
      }

      const result = user.isFollowing 
        ? await unfollowUser(userId)
        : await followUser(userId);
      
      if (result.success) {
        setUser(prev => {
          const newFollowersCount = result.data.isFollowing 
            ? (prev.followersCount || 0) + 1 
            : Math.max((prev.followersCount || 1) - 1, 0);
            
          return {
            ...prev,
            isFollowing: result.data.isFollowing,
            followersCount: newFollowersCount
          };
        });
      } else {
        setError(result.error || 'Failed to update follow status');
      }
    } catch (followError) {
      console.error('Follow error:', followError);
      setError('Failed to update follow status');
    } finally {
      setFollowLoading(false);
    }
  }, [user, followLoading]);

  const handleProfileUpdate = useCallback((updatedUser) => {
    console.log('Profile update handler called');
    
    setUser(prev => {
      if (!prev) return updatedUser;
      
      return {
        ...prev,
        ...updatedUser,
        bio: updatedUser.bio !== undefined ? updatedUser.bio : prev.bio,
        fullName: updatedUser.fullName !== undefined ? updatedUser.fullName : prev.fullName,
        profilePicture: updatedUser.profilePicture !== undefined ? updatedUser.profilePicture : prev.profilePicture,
        postsCount: prev.actualPostsCount || prev.postsCount || 0,
        followersCount: updatedUser.followersCount !== undefined ? updatedUser.followersCount : (prev.followersCount || 0),
        followingCount: updatedUser.followingCount !== undefined ? updatedUser.followingCount : (prev.followingCount || 0),
        isFollowing: prev.isFollowing,
        isOwnProfile: prev.isOwnProfile
      };
    });
    
    setShowEditModal(false);
  }, []);

  const handlePostClick = useCallback((postId) => {
    setSelectedPostId(postId);
    setIsPostModalOpen(true);
  }, []);

  const closePostModal = useCallback(() => {
    setIsPostModalOpen(false);
    setSelectedPostId(null);
  }, []);

  const formatNumber = useCallback((num) => {
    const number = Number(num) || 0;
    if (number >= 1000000) {
      return (number / 1000000).toFixed(1) + 'M';
    } else if (number >= 1000) {
      return (number / 1000).toFixed(1) + 'K';
    }
    return number.toString();
  }, []);

  const dismissError = useCallback(() => {
    setError('');
  }, []);

  // Loading state
  if (loading) {
    return (
      <Layout>
        <div className={styles.container}>
          <div className={styles.loading}>Loading profile...</div>
        </div>
      </Layout>
    );
  }

  // Error state
  if (error && !user) {
    return (
      <Layout>
        <div className={styles.container}>
          <div className={styles.error}>
            {error}
            <button onClick={fetchProfileData} className={styles.retryButton}>
              Retry
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  // User not found
  if (!user) {
    return (
      <Layout>
        <div className={styles.container}>
          <div className={styles.error}>User not found</div>
        </div>
      </Layout>
    );
  }

  const displayPostsCount = posts.length || user.actualPostsCount || user.postsCount || 0;

  return (
    <Layout>
      <div className={styles.container}>
        {/* Profile Section */}
        <div className={styles.profileSection}>
          <div className={styles.profileHeader}>
            {/* Profile Picture */}
            <div className={styles.profilePictureContainer}>
              <img 
                src={user.profilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.fullName || user.username)}&size=150&background=0095f6&color=fff`}
                alt={user.fullName || user.username}
                className={styles.profilePicture}
                onError={(e) => {
                  e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.fullName || user.username)}&size=150&background=0095f6&color=fff`;
                }}
              />
            </div>

            {/* Profile Info */}
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

              {/* Stats */}
              <div className={styles.stats}>
                <div className={styles.stat}>
                  <span className={styles.statNumber}>{formatNumber(displayPostsCount)}</span>
                  <span className={styles.statLabel}>posts</span>
                </div>
                <div className={styles.stat}>
                  <span className={styles.statNumber}>{formatNumber(user.followersCount || 0)}</span>
                  <span className={styles.statLabel}>followers</span>
                </div>
                <div className={styles.stat}>
                  <span className={styles.statNumber}>{formatNumber(user.followingCount || 0)}</span>
                  <span className={styles.statLabel}>following</span>
                </div>
              </div>

              {/* Bio */}
              <div className={styles.bio}>
                <div className={styles.fullName}>{user.fullName || user.username}</div>
                {user.bio && user.bio.trim() !== '' && (
                  <div className={styles.bioText}>{user.bio}</div>
                )}
                {(!user.bio || user.bio.trim() === '') && user.isOwnProfile && (
                  <div className={styles.bioPlaceholder}>
                    Add a bio to tell people about yourself
                  </div>
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
              {user.isOwnProfile ? (
                <p>Share your first photo to get started!</p>
              ) : (
                <p>When {user.username} shares photos, you&apos;ll see them here.</p>
              )}
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
            <button onClick={dismissError} className={styles.dismissError}>
              Dismiss
            </button>
          </div>
        )}

        {/* Edit Profile Modal */}
        {showEditModal && (
          <EditProfileModal 
            user={user}
            onClose={() => setShowEditModal(false)}
            onUpdate={handleProfileUpdate}
          />
        )}

        {/* Post Modal */}
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

// Edit Profile Modal Component
function EditProfileModal({ user, onClose, onUpdate }) {
  const [formData, setFormData] = useState({
    fullName: user.fullName || '',
    bio: user.bio || ''
  });
  const [profilePicture, setProfilePicture] = useState(null);
  const [profilePicturePreview, setProfilePicturePreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleInputChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    setError('');
  }, []);

  const handleFileChange = useCallback((e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setError('Please select an image file');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setError('Image size must be less than 5MB');
        return;
      }
      
      setProfilePicture(file);
      
      const reader = new FileReader();
      reader.onload = (e) => {
        setProfilePicturePreview(e.target.result);
      };
      reader.readAsDataURL(file);
      
      setError('');
    }
  }, []);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (!formData.fullName.trim()) {
        setError('Full name is required');
        setLoading(false);
        return;
      }

      if (formData.fullName.length > 50) {
        setError('Full name must be less than 50 characters');
        setLoading(false);
        return;
      }

      if (formData.bio.length > 150) {
        setError('Bio must be less than 150 characters');
        setLoading(false);
        return;
      }

      const updateData = new FormData();
      updateData.append('fullName', formData.fullName.trim());
      updateData.append('bio', formData.bio.trim());
      
      if (profilePicture) {
        updateData.append('profilePicture', profilePicture);
      }

      const result = await updateUserProfile(updateData);

      if (result.success) {
        let updatedUserData = result.data?.user || result.data;
        
        if (result.data && result.data.user) {
          updatedUserData = result.data.user;
        }
        
        if (!updatedUserData || typeof updatedUserData !== 'object') {
          updatedUserData = {
            ...user,
            fullName: formData.fullName.trim(),
            bio: formData.bio.trim(),
            profilePicture: profilePicturePreview || user.profilePicture
          };
        } else {
          updatedUserData = {
            ...user,
            ...updatedUserData,
            fullName: updatedUserData.fullName || formData.fullName.trim(),
            bio: updatedUserData.bio !== undefined ? updatedUserData.bio : formData.bio.trim(),
            profilePicture: updatedUserData.profilePicture || user.profilePicture
          };
        }
        
        onUpdate(updatedUserData);
        
        window.dispatchEvent(new CustomEvent('profileUpdated', {
          detail: updatedUserData
        }));
        
      } else {
        setError(result.error || 'Failed to update profile');
      }
    } catch (updateError) {
      console.error('Profile update error:', updateError);
      setError('Failed to update profile: ' + updateError.message);
    } finally {
      setLoading(false);
    }
  }, [formData, profilePicture, profilePicturePreview, user, onUpdate]);

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>Edit Profile</h2>
          <button onClick={onClose} className={styles.closeButton} disabled={loading}>
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.modalForm}>
          {error && <div className={styles.modalError}>{error}</div>}

          <div className={styles.formGroup}>
            <label htmlFor="profilePicture">Profile Picture</label>
            <div className={styles.profilePictureUpload}>
              <div className={styles.currentPicture}>
                <img 
                  src={
                    profilePicturePreview || 
                    user.profilePicture || 
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(user.fullName || user.username)}&size=100&background=0095f6&color=fff`
                  }
                  alt="Profile preview"
                  className={styles.previewImage}
                  onError={(e) => {
                    e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.fullName || user.username)}&size=100&background=0095f6&color=fff`;
                  }}
                />
              </div>
              <input
                type="file"
                id="profilePicture"
                accept="image/*"
                onChange={handleFileChange}
                className={styles.fileInput}
                disabled={loading}
              />
              <label htmlFor="profilePicture" className={styles.fileInputLabel}>
                {profilePicture ? 'Change Photo' : 'Upload Photo'}
              </label>
              {profilePicture && (
                <button
                  type="button"
                  onClick={() => {
                    setProfilePicture(null);
                    setProfilePicturePreview(null);
                  }}
                  className={styles.removePhotoButton}
                  disabled={loading}
                >
                  Remove
                </button>
              )}
            </div>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="fullName">
              Full Name <span className={styles.required}>*</span>
            </label>
            <input
              type="text"
              id="fullName"
              name="fullName"
              value={formData.fullName}
              onChange={handleInputChange}
              className={styles.input}
              maxLength={50}
              required
              disabled={loading}
              placeholder="Enter your full name"
            />
            <div className={styles.charCount}>
              {formData.fullName.length}/50
            </div>
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
              disabled={loading}
              placeholder="Tell us about yourself..."
            />
            <div className={styles.charCount}>
              {formData.bio.length}/150
            </div>
          </div>

          <div className={styles.modalActions}>
            <button 
              type="button" 
              onClick={onClose}
              className={styles.cancelButton}
              disabled={loading}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={loading || !formData.fullName.trim()}
              className={styles.saveButton}
            >
              {loading ? (
                <>
                  <span className={styles.spinner}></span>
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
