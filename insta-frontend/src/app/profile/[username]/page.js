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

  // Memoized API object to prevent unnecessary re-renders in PostModal
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

  // ENHANCED: Profile update listener with immediate updates and proper data handling
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && username) {
        // Check if there's a pending profile update flag
        const hasUpdate = localStorage.getItem('profile_updated') === 'true';
        if (hasUpdate) {
          console.log('Profile update detected on visibility change, refreshing...');
          forceRefreshProfile();
          localStorage.removeItem('profile_updated');
        }
      }
    };

    const handleProfileUpdateEvent = (event) => {
      console.log('=== PROFILE UPDATE EVENT RECEIVED ===');
      console.log('Event detail:', event.detail);
      
      if (event.detail && username) {
        const updatedUserData = event.detail;
        
        // FIXED: Ensure proper ID mapping when receiving event data
        if (updatedUserData._id && !updatedUserData.id) {
          updatedUserData.id = updatedUserData._id;
        } else if (!updatedUserData._id && updatedUserData.id) {
          updatedUserData._id = updatedUserData.id;
        }
        
        console.log('Processing profile update event with ID mapping:', {
          _id: updatedUserData._id,
          id: updatedUserData.id,
          username: updatedUserData.username,
          fullName: updatedUserData.fullName,
          bio: updatedUserData.bio,
          bioLength: updatedUserData.bio?.length || 0,
          profilePicture: updatedUserData.profilePicture
        });
        
        // Update user data immediately from the event with proper merging
        setUser(prev => {
          if (!prev) {
            console.log('No previous user data, setting new data');
            return {
              ...updatedUserData,
              bio: updatedUserData.bio !== undefined ? updatedUserData.bio : '',
              fullName: updatedUserData.fullName || updatedUserData.username || '',
              profilePicture: updatedUserData.profilePicture !== undefined ? updatedUserData.profilePicture : null
            };
          }
          
          const newUser = {
            ...prev, // Keep existing data
            // Override with updated data - use server data as source of truth
            bio: updatedUserData.bio !== undefined ? updatedUserData.bio : prev.bio,
            fullName: updatedUserData.fullName !== undefined ? updatedUserData.fullName : prev.fullName,
            profilePicture: updatedUserData.profilePicture !== undefined ? updatedUserData.profilePicture : prev.profilePicture,
            
            // Preserve counts that shouldn't be overwritten from settings
            postsCount: prev.actualPostsCount || prev.postsCount || updatedUserData.postsCount || 0,
            actualPostsCount: prev.actualPostsCount || prev.postsCount || updatedUserData.postsCount || 0,
            followersCount: updatedUserData.followersCount !== undefined ? updatedUserData.followersCount : (prev.followersCount || 0),
            followingCount: updatedUserData.followingCount !== undefined ? updatedUserData.followingCount : (prev.followingCount || 0),
            
            // Preserve relationship status
            isFollowing: prev.isFollowing !== undefined ? prev.isFollowing : updatedUserData.isFollowing,
            isOwnProfile: prev.isOwnProfile !== undefined ? prev.isOwnProfile : updatedUserData.isOwnProfile,
            
            // Handle settings if they exist
            settings: updatedUserData.settings ? {
              ...prev.settings,
              ...updatedUserData.settings
            } : prev.settings
          };
          
          console.log('User data updated via event:', {
            before: {
              username: prev.username,
              fullName: prev.fullName,
              bio: prev.bio,
              bioLength: prev.bio?.length || 0,
              profilePicture: prev.profilePicture
            },
            after: {
              username: newUser.username,
              fullName: newUser.fullName,
              bio: newUser.bio,
              bioLength: newUser.bio?.length || 0,
              profilePicture: newUser.profilePicture
            }
          });
          
          return newUser;
        });
      }
      console.log('=== PROFILE UPDATE EVENT PROCESSED ===');
    };

    const handlePostMessage = (event) => {
      if (event.data && event.data.type === 'PROFILE_UPDATED' && event.data.data) {
        console.log('Received profile update via postMessage:', event.data.data);
        handleProfileUpdateEvent({ detail: event.data.data });
      }
    };

    // Add event listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('profileUpdated', handleProfileUpdateEvent);
    window.addEventListener('message', handlePostMessage);
    
    // Check for pending updates on mount
    const hasUpdate = localStorage.getItem('profile_updated') === 'true';
    if (hasUpdate && username) {
      console.log('Pending profile update found on mount, refreshing...');
      setTimeout(() => {
        forceRefreshProfile();
        localStorage.removeItem('profile_updated');
      }, 500);
    }
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('profileUpdated', handleProfileUpdateEvent);
      window.removeEventListener('message', handlePostMessage);
    };
  }, [username]);

  const fetchProfileData = useCallback(async () => {
    if (!username) return;
    
    setLoading(true);
    setPostsLoading(true);
    setError('');
    
    try {
      console.log('=== FETCHING PROFILE DATA ===');
      console.log('Username:', username);
      
      // Fetch user profile
      const profileResult = await getUserProfile(username);
      console.log('Profile result:', profileResult);
      
      if (!profileResult.success) {
        console.error('Profile fetch error:', profileResult.error);
        setError(profileResult.error || 'Failed to load profile');
        setLoading(false);
        setPostsLoading(false);
        return;
      }

      const userData = profileResult.data.user;
      
      // FIXED: Ensure proper ID mapping for profile data
      if (userData._id && !userData.id) {
        userData.id = userData._id;
      } else if (!userData._id && userData.id) {
        userData._id = userData.id;
      }
      
      // Ensure all user fields are properly set
      const completeUserData = {
        ...userData,
        bio: userData.bio !== undefined ? userData.bio : '', // Ensure bio is properly set from server
        fullName: userData.fullName || userData.username || '',
        profilePicture: userData.profilePicture !== undefined ? userData.profilePicture : null,
        followersCount: userData.followersCount || 0,
        followingCount: userData.followingCount || 0,
        postsCount: userData.postsCount || 0
      };
      
      setUser(completeUserData);
      console.log('User loaded with complete data:', {
        _id: completeUserData._id,
        id: completeUserData.id,
        username: completeUserData.username,
        fullName: completeUserData.fullName,
        bio: completeUserData.bio,
        profilePicture: completeUserData.profilePicture
      });

      // Fetch user posts with proper ID handling
      const userId = userData._id || userData.id;
      if (userId) {
        console.log('Fetching posts for userId:', userId);
        const postsResult = await getUserPosts(userId);
        console.log('Posts result:', postsResult);
        
        if (postsResult.success) {
          const userPosts = postsResult.data.posts || [];
          setPosts(userPosts);
          
          // Update user with actual post count from fetched posts
          setUser(prev => ({
            ...prev,
            postsCount: userPosts.length,
            actualPostsCount: userPosts.length // Keep track of actual count
          }));
          
          console.log('Posts loaded:', userPosts.length);
        } else {
          console.error('Posts fetch error:', postsResult.error);
          setPosts([]);
          // Still update post count to 0 if posts fetch fails
          setUser(prev => ({
            ...prev,
            postsCount: 0,
            actualPostsCount: 0
          }));
        }
      } else {
        console.error('No user ID available for posts fetch');
        setPosts([]);
        setUser(prev => ({
          ...prev,
          postsCount: 0,
          actualPostsCount: 0
        }));
      }

    } catch (fetchError) {
      console.error('Profile data fetch exception:', fetchError);
      setError('Failed to load profile data: ' + fetchError.message);
      setPosts([]);
    } finally {
      setLoading(false);
      setPostsLoading(false);
      console.log('=== PROFILE DATA FETCH COMPLETE ===');
    }
  }, [username]);

  // FIXED: Enhanced force refresh with better error handling and logging
  const forceRefreshProfile = useCallback(async () => {
    if (!username) return;
    
    console.log('=== FORCE REFRESH PROFILE START ===');
    console.log('Refreshing profile for username:', username);
    
    try {
      const profileResult = await getUserProfile(username);
      
      if (profileResult.success) {
        const userData = profileResult.data.user;
        
        // FIXED: Ensure proper ID mapping for refreshed data
        if (userData._id && !userData.id) {
          userData.id = userData._id;
        } else if (!userData._id && userData.id) {
          userData._id = userData.id;
        }
        
        // Update user data with the fresh data from server - use server data as source of truth
        setUser(prev => {
          const refreshedUser = {
            ...prev, // Keep previous data as base
            ...userData, // Override with fresh server data
            // Use server data for these critical fields
            bio: userData.bio !== undefined ? userData.bio : '',
            fullName: userData.fullName || userData.username || '',
            profilePicture: userData.profilePicture !== undefined ? userData.profilePicture : null,
            followersCount: userData.followersCount || 0,
            followingCount: userData.followingCount || 0,
            // Preserve the actual posts count from current state
            postsCount: prev?.actualPostsCount || userData.postsCount || 0,
            actualPostsCount: prev?.actualPostsCount || userData.postsCount || 0,
            // Preserve relationship status that shouldn't change during settings update
            isFollowing: prev?.isFollowing !== undefined ? prev.isFollowing : userData.isFollowing,
            isOwnProfile: prev?.isOwnProfile !== undefined ? prev.isOwnProfile : userData.isOwnProfile
          };
          
          console.log('Profile force refreshed with server data:', {
            _id: refreshedUser._id,
            id: refreshedUser.id,
            username: refreshedUser.username,
            fullName: refreshedUser.fullName,
            bio: refreshedUser.bio,
            bioLength: refreshedUser.bio?.length || 0,
            profilePicture: refreshedUser.profilePicture,
            postsCount: refreshedUser.postsCount
          });
          
          return refreshedUser;
        });
        
        console.log('Force refresh successful');
      } else {
        console.error('Force refresh failed:', profileResult.error);
      }
    } catch (refreshError) {
      console.error('Force refresh exception:', refreshError);
    } finally {
      console.log('=== FORCE REFRESH PROFILE END ===');
    }
  }, [username]);

  const handleFollowToggle = useCallback(async () => {
    if (!user || followLoading) return;
    
    setFollowLoading(true);
    setError('');
    
    try {
      const userId = user._id || user.id;
      console.log('Attempting follow/unfollow for userId:', userId);
      console.log('Current follow status:', user.isFollowing);
      
      if (!userId) {
        console.error('No user ID found');
        setError('User ID not found');
        return;
      }

      const result = user.isFollowing 
        ? await unfollowUser(userId)
        : await followUser(userId);
      
      console.log('Follow/unfollow result:', result);
      
      if (result.success) {
        // Update user state with new follow status and follower count
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
        console.log('Follow toggle successful');
      } else {
        console.error('Follow toggle error:', result.error);
        setError(result.error || 'Failed to update follow status');
      }
    } catch (followError) {
      console.error('Follow toggle exception:', followError);
      setError('Failed to update follow status: ' + followError.message);
    } finally {
      setFollowLoading(false);
    }
  }, [user, followLoading]);

  // ENHANCED: Profile update handler with improved data processing and validation
  const handleProfileUpdate = useCallback((updatedUser) => {
    console.log('=== PROFILE UPDATE HANDLER START ===');
    console.log('Received updated user data:', updatedUser);
    
    setUser(prev => {
      // If no previous user data, use the updated data as base
      if (!prev) {
        console.log('Setting initial user data:', updatedUser);
        
        // FIXED: Ensure proper ID mapping for new user data
        if (updatedUser._id && !updatedUser.id) {
          updatedUser.id = updatedUser._id;
        } else if (!updatedUser._id && updatedUser.id) {
          updatedUser._id = updatedUser.id;
        }
        
        return {
          ...updatedUser,
          bio: updatedUser.bio !== undefined ? updatedUser.bio : '',
          fullName: updatedUser.fullName || updatedUser.username || '',
          profilePicture: updatedUser.profilePicture !== undefined ? updatedUser.profilePicture : null
        };
      }
      
      // FIXED: Ensure proper ID mapping for updated user data
      if (updatedUser._id && !updatedUser.id) {
        updatedUser.id = updatedUser._id;
      } else if (!updatedUser._id && updatedUser.id) {
        updatedUser._id = updatedUser.id;
      }
      
      // Properly merge the updated data with existing data
      const newUser = { 
        ...prev, // Keep all existing data
        ...updatedUser, // Override with updated data
        
        // Handle specific fields that might be nested or have special handling
        bio: updatedUser.bio !== undefined ? updatedUser.bio : prev.bio,
        fullName: updatedUser.fullName !== undefined ? updatedUser.fullName : prev.fullName,
        profilePicture: updatedUser.profilePicture !== undefined ? updatedUser.profilePicture : prev.profilePicture,
        
        // Preserve counts that shouldn't be overwritten
        postsCount: prev.actualPostsCount || prev.postsCount || 0,
        followersCount: updatedUser.followersCount !== undefined ? updatedUser.followersCount : (prev.followersCount || 0),
        followingCount: updatedUser.followingCount !== undefined ? updatedUser.followingCount : (prev.followingCount || 0),
        
        // Preserve relationship status
        isFollowing: updatedUser.isFollowing !== undefined ? updatedUser.isFollowing : prev.isFollowing,
        isOwnProfile: prev.isOwnProfile, // This should never change
        
        // Handle additional fields that might come from settings
        email: updatedUser.email !== undefined ? updatedUser.email : prev.email,
        username: updatedUser.username !== undefined ? updatedUser.username : prev.username,
        website: updatedUser.website !== undefined ? updatedUser.website : prev.website,
        phoneNumber: updatedUser.phoneNumber !== undefined ? updatedUser.phoneNumber : prev.phoneNumber,
        gender: updatedUser.gender !== undefined ? updatedUser.gender : prev.gender,
        
        // Handle privacy settings if they exist
        isPrivate: updatedUser.isPrivate !== undefined ? updatedUser.isPrivate : prev.isPrivate,
        
        // Handle settings object if it exists
        settings: updatedUser.settings ? {
          ...prev.settings,
          ...updatedUser.settings
        } : prev.settings
      };
      
      console.log('Profile updated in state with proper data merging:', {
        before: {
          _id: prev._id,
          id: prev.id,
          fullName: prev.fullName,
          bio: prev.bio,
          profilePicture: prev.profilePicture
        },
        after: {
          _id: newUser._id,
          id: newUser.id,
          fullName: newUser.fullName,
          bio: newUser.bio,
          profilePicture: newUser.profilePicture
        }
      });
      
      return newUser;
    });
    
    setShowEditModal(false);
    console.log('=== PROFILE UPDATE HANDLER END ===');
  }, []);

  const handlePostClick = useCallback((postId) => {
    setSelectedPostId(postId);
    setIsPostModalOpen(true);
  }, []);

  const closePostModal = useCallback(() => {
    setIsPostModalOpen(false);
    setSelectedPostId(null);
  }, []);

  // Optimized number formatting
  const formatNumber = useCallback((num) => {
    const number = Number(num) || 0;
    if (number >= 1000000) {
      return (number / 1000000).toFixed(1) + 'M';
    } else if (number >= 1000) {
      return (number / 1000).toFixed(1) + 'K';
    }
    return number.toString();
  }, []);

  // Handle error dismissal
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

  // Error state (when no user data)
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

  // Calculate the actual post count to display
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
                key={user.profilePicture || 'default'}
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

              {/* Bio - Enhanced bio display with proper fallbacks */}
              <div className={styles.bio}>
                <div className={styles.fullName} key={user.fullName}>{user.fullName || user.username}</div>
                {user.bio && user.bio.trim() !== '' && (
                  <div className={styles.bioText} key={user.bio}>{user.bio}</div>
                )}
                {(!user.bio || user.bio.trim() === '') && user.isOwnProfile && (
                  <div className={styles.bioText} style={{ color: '#999', fontStyle: 'italic' }}>
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
                <p>{"When " + user.username + " shares photos, you'll see them here."}</p>
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
              onClick={dismissError} 
              className={styles.dismissError}
            >
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

// ENHANCED: Edit Profile Modal Component with better validation and error handling
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
    console.log(`Edit modal field "${name}" changed to:`, value);
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
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
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setProfilePicturePreview(e.target.result);
      };
      reader.readAsDataURL(file);
      
      setError('');
      console.log('Profile picture selected:', file.name);
    }
  }, []);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      console.log('=== EDIT MODAL SUBMIT START ===');
      
      // Validate form data
      if (!formData.fullName.trim()) {
        setError('Full name is required');
        setLoading(false);
        return;
      }

      const updateData = new FormData();
      updateData.append('fullName', formData.fullName.trim());
      updateData.append('bio', formData.bio.trim());
      
      if (profilePicture) {
        updateData.append('profilePicture', profilePicture);
        console.log('Including profile picture in update');
      }

      console.log('Edit modal updating profile with data:', {
        fullName: formData.fullName.trim(),
        bio: formData.bio.trim(),
        bioLength: formData.bio.trim().length,
        hasFile: !!profilePicture
      });

      const result = await updateUserProfile(updateData);
      console.log('Edit modal update result:', result);
      console.log('Server returned user data:', result.data);

      if (result.success) {
        // FIXED: Ensure proper data structure with ID mapping for the modal update
        let updatedUserData = result.data.user || result.data;
        
        console.log('Raw updated user data from server:', {
          fullName: updatedUserData?.fullName,
          bio: updatedUserData?.bio,
          bioLength: updatedUserData?.bio?.length,
          profilePicture: updatedUserData?.profilePicture
        });
        
        // CRITICAL FIX: If server doesn't return bio/picture, use our local values
        if (!updatedUserData || !updatedUserData.bio) {
          console.warn('⚠️ Server did not return bio, using local form data');
        }
        if (!updatedUserData || !updatedUserData.profilePicture) {
          console.warn('⚠️ Server did not return profilePicture');
        }
        
        if (!updatedUserData) {
          updatedUserData = {
            ...user,
            fullName: formData.fullName.trim(),
            bio: formData.bio.trim(),
            profilePicture: profilePicturePreview || user.profilePicture
          };
        } else {
          // Merge server data with local form data for fields that might be missing
          updatedUserData = {
            ...updatedUserData,
            // Use server data if available, otherwise use form data
            fullName: updatedUserData.fullName || formData.fullName.trim(),
            bio: updatedUserData.bio !== undefined ? updatedUserData.bio : formData.bio.trim(),
            // Use preview if we just uploaded, otherwise use server data or keep existing
            profilePicture: profilePicturePreview || updatedUserData.profilePicture || user.profilePicture
          };
        }
        
        // FIXED: Ensure proper ID mapping
        if (updatedUserData._id && !updatedUserData.id) {
          updatedUserData.id = updatedUserData._id;
        } else if (!updatedUserData._id && updatedUserData.id) {
          updatedUserData._id = updatedUserData.id;
        }
        
        console.log('Edit modal calling onUpdate with proper data:', {
          _id: updatedUserData._id,
          id: updatedUserData.id,
          fullName: updatedUserData.fullName,
          bio: updatedUserData.bio,
          bioLength: updatedUserData.bio?.length || 0,
          profilePicture: updatedUserData.profilePicture
        });
        
        // Call onUpdate to update parent component
        onUpdate(updatedUserData);
        
        // FIXED: Also dispatch a custom event for other listeners
        window.dispatchEvent(new CustomEvent('profileUpdated', {
          detail: updatedUserData
        }));
        
        console.log('=== EDIT MODAL SUBMIT SUCCESS ===');
      } else {
        setError(result.error || 'Failed to update profile');
        console.error('Edit modal profile update error:', result.error);
      }
    } catch (updateError) {
      console.error('Edit modal profile update exception:', updateError);
      setError('Failed to update profile: ' + updateError.message);
    } finally {
      setLoading(false);
      console.log('=== EDIT MODAL SUBMIT END ===');
    }
  }, [formData, profilePicture, profilePicturePreview, user, onUpdate]);

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
              <div className={styles.currentPicture}>
                <img 
                  src={profilePicturePreview || user.profilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.fullName || user.username)}&size=100&background=0095f6&color=fff`}
                  alt="Profile"
                  className={styles.previewImage}
                  key={profilePicturePreview || user.profilePicture || 'default'}
                />
              </div>
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
            <div className={styles.charCount}>
              {formData.bio.length}/150
            </div>
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
