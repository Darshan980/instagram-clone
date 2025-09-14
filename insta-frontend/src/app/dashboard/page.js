'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { User, UserPlus, X, RefreshCw, Users, Search } from 'lucide-react';
import StoriesBar from '../../components/StoriesBar';
import StoryViewer from '../../components/StoryViewer';
import { 
  isTokenValid, 
  getCurrentUserProfile, 
  logout, 
  getFeedPosts, 
  toggleLikePost, 
  addComment,
  getPost,
  getPostComments
} from '../../utils/auth';
import styles from './dashboard.module.css';
import PostModal from '../components/PostModal';

// API configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:10000/api';

const getToken = () => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('instagram_token') || localStorage.getItem('token');
  }
  return null;
};

const isTokenValid_API = () => {
  const token = getToken();
  if (!token) return false;
  
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    
    const payload = JSON.parse(atob(parts[1]));
    const currentTime = Math.floor(Date.now() / 1000);
    
    return payload.exp > currentTime;
  } catch (error) {
    console.error('Token validation error:', error);
    return false;
  }
};

const apiRequest = async (endpoint, options = {}) => {
  const token = getToken();
  
  const defaultHeaders = {
    'Content-Type': 'application/json',
  };

  if (token && isTokenValid_API()) {
    defaultHeaders['Authorization'] = `Bearer ${token}`;
  }

  const config = {
    headers: defaultHeaders,
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  };

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
    
    let data;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    if (!response.ok) {
      if (response.status === 401) {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('instagram_token');
          localStorage.removeItem('token');
          window.location.href = '/login';
        }
        throw new Error('Authentication failed. Please log in again.');
      }
      
      const errorMessage = data?.message || data?.error || `HTTP error! status: ${response.status}`;
      return {
        success: false,
        error: errorMessage,
        status: response.status,
        data: data
      };
    }

    return {
      success: true,
      data,
      status: response.status
    };

  } catch (error) {
    console.error(`API Error for ${endpoint}:`, error);
    
    return {
      success: false,
      error: error.message || 'Network error occurred',
      status: error.status || 500
    };
  }
};

const getUserSuggestions = async (options = {}) => {
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
    } else {
      console.error('getUserSuggestions API error:', result.error);
      return {
        success: false,
        error: result.error || 'Failed to get user suggestions',
        data: {
          users: [],
          totalSuggestions: 0,
          hasMore: false,
          page: 1
        }
      };
    }
  } catch (error) {
    console.error('getUserSuggestions catch error:', error);
    return {
      success: false,
      error: 'Network error while getting suggestions',
      data: {
        users: [],
        totalSuggestions: 0,
        hasMore: false,
        page: 1
      }
    };
  }
};

const followUser = async (userId) => {
  let result = await apiRequest(`/users/follow/${userId}`, {
    method: 'POST',
  });

  if (!result.success && result.status === 404) {
    result = await apiRequest(`/users/${userId}/follow`, {
      method: 'POST',
    });
  }

  return result;
};

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [postsLoading, setPostsLoading] = useState(true);
  const [showCreateSidebar, setShowCreateSidebar] = useState(false);
  const [error, setError] = useState('');
  const [commentTexts, setCommentTexts] = useState({});
  const [commentLoading, setCommentLoading] = useState({});
  const [likeLoading, setLikeLoading] = useState({});
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showStoryViewer, setShowStoryViewer] = useState(false);
  const [selectedStories, setSelectedStories] = useState([]);
  const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
  const [visiblePosts, setVisiblePosts] = useState(new Set());
  
  // PostModal states
  const [isPostModalOpen, setIsPostModalOpen] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState(null);
  
  // Follow Suggestions State
  const [suggestions, setSuggestions] = useState([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsError, setSuggestionsError] = useState(null);
  const [followingStates, setFollowingStates] = useState({});
  const [showAllSuggestions, setShowAllSuggestions] = useState(false);
  
  const router = useRouter();

  // API object to pass to PostModal
  const api = {
    getPost,
    getPostComments,
    toggleLikePost,
    addComment
  };

  useEffect(() => {
    // Check if user is authenticated
    if (!isTokenValid()) {
      router.push('/login');
      return;
    }

    fetchUserProfile();
    fetchFeed();
    loadSuggestions(); // Load suggestions when component mounts
  }, [router]);

  // Intersection Observer for post animations
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const postId = entry.target.getAttribute('data-post-id');
            if (postId) {
              setVisiblePosts(prev => new Set([...prev, postId]));
            }
          }
        });
      },
      {
        threshold: 0.1,
        rootMargin: '20px'
      }
    );

    const postElements = document.querySelectorAll('[data-post-id]');
    postElements.forEach(el => observer.observe(el));

    return () => observer.disconnect();
  }, [posts]);

  const fetchUserProfile = async () => {
    try {
      console.log('Fetching user profile...');
      const result = await getCurrentUserProfile();
      console.log('User profile result:', result);
      
      if (result.success) {
        const userData = result.data?.user || result.user || result.data;
        console.log('User data extracted:', userData);
        setUser(userData);
      } else {
        console.error('Failed to fetch user profile:', result);
        router.push('/login');
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
      router.push('/login');
    } finally {
      setLoading(false);
    }
  };

  const fetchFeed = async (pageNum = 1, append = false) => {
    try {
      if (pageNum === 1) setPostsLoading(true);
      
      const result = await getFeedPosts(pageNum, 10);
      
      if (result.success) {
        let postsData = [];
        
        if (result.data && Array.isArray(result.data)) {
          postsData = result.data;
        } else if (result.data && result.data.posts) {
          postsData = result.data.posts;
        } else if (result.posts) {
          postsData = result.posts;
        } else if (result.data && result.data.data) {
          postsData = result.data.data.posts || result.data.data;
        }
        
        if (!Array.isArray(postsData)) {
          postsData = [];
        }
        
        const validPosts = postsData.filter(post => post && post._id).map(post => ({
          ...post,
          user: post.user || { username: 'Unknown User', profilePicture: null },
          likes: Array.isArray(post.likes) ? post.likes : [],
          comments: Array.isArray(post.comments) ? post.comments : [],
          tags: Array.isArray(post.tags) ? post.tags : [],
          createdAt: post.createdAt || new Date().toISOString(),
          imageUrl: post.imageUrl || post.image || '',
          caption: post.caption || ''
        }));
        
        const paginationData = result.data?.pagination || result.pagination || {};
        
        if (append) {
          setPosts(prev => [...prev, ...validPosts]);
        } else {
          setPosts(validPosts);
        }
        
        setHasMore(paginationData.hasNextPage || false);
        setPage(pageNum);
        setError('');
      } else {
        setError(result.error || result.message || 'Failed to load feed');
      }
    } catch (error) {
      console.error('Feed fetch error:', error);
      setError('Failed to load feed');
    } finally {
      setPostsLoading(false);
      setLoadingMore(false);
    }
  };

  const loadSuggestions = async (isRefresh = false) => {
    if (isRefresh) {
      setSuggestionsLoading(true);
    } else {
      setSuggestionsLoading(true);
    }
    setSuggestionsError(null);

    try {
      const result = await getUserSuggestions({ page: 1, limit: 10 });
      
      if (result.success) {
        const users = result.data?.users || [];
        setSuggestions(users);
        
        const initialStates = {};
        users.forEach(user => {
          if (user && user._id) {
            initialStates[user._id] = user.isFollowing || false;
          }
        });
        setFollowingStates(initialStates);
        
        if (users.length > 0) {
          setSuggestionsError(null);
        }
      } else {
        setSuggestionsError(result.error || 'Failed to load suggestions');
        if (!isRefresh) {
          setSuggestions([]);
        }
      }
    } catch (err) {
      const errorMessage = 'Network error occurred: ' + err.message;
      setSuggestionsError(errorMessage);
      if (!isRefresh) {
        setSuggestions([]);
      }
    } finally {
      setSuggestionsLoading(false);
    }
  };

  const handleFollow = async (userId) => {
    setFollowingStates(prev => ({ ...prev, [userId]: 'pending' }));

    try {
      const result = await followUser(userId);
      
      if (result.success) {
        setFollowingStates(prev => ({ ...prev, [userId]: true }));
        setSuggestions(prev => prev.map(user => 
          user._id === userId 
            ? { ...user, isFollowing: true, followersCount: (user.followersCount || 0) + 1 }
            : user
        ));
      } else {
        setFollowingStates(prev => ({ ...prev, [userId]: false }));
        setSuggestionsError('Failed to follow user: ' + (result.error || 'Unknown error'));
      }
    } catch (err) {
      setFollowingStates(prev => ({ ...prev, [userId]: false }));
      setSuggestionsError('Network error occurred while following user');
      console.error('Follow error:', err);
    }
  };

  const handleDismiss = (userId) => {
    setSuggestions(prev => prev.filter(user => user._id !== userId));
    setFollowingStates(prev => {
      const newState = { ...prev };
      delete newState[userId];
      return newState;
    });
  };

  const formatFollowerCount = (count) => {
    if (!count || count === 0) return '0';
    
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    } else if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
  };

  const getProfileImageSrc = (user) => {
    if (user.profilePicture && user.profilePicture.startsWith('http')) {
      return user.profilePicture;
    }
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(user.fullName || user.username)}&background=e5e7eb&color=6b7280&size=96`;
  };

  const loadMorePosts = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    await fetchFeed(page + 1, true);
  };

  const handleLogout = () => {
    logout();
  };

  const toggleCreateSidebar = () => {
    setShowCreateSidebar(!showCreateSidebar);
  };

  const handleCreateOptionClick = (path) => {
    router.push(path);
    setShowCreateSidebar(false);
  };

  // Handle post image click to open modal
  const handlePostImageClick = (postId, e) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedPostId(postId);
    setIsPostModalOpen(true);
  };

  // Handle closing post modal
  const closePostModal = () => {
    setIsPostModalOpen(false);
    setSelectedPostId(null);
  };

  // Handle modal actions (like, comment) and update the feed
  const handleModalPostUpdate = (updatedPostData) => {
    setPosts(prevPosts => 
      prevPosts.map(post => 
        post._id === updatedPostData.postId 
          ? { 
              ...post, 
              likes: updatedPostData.likes || post.likes,
              comments: updatedPostData.comments || post.comments,
              isLikedByUser: updatedPostData.isLikedByUser !== undefined 
                ? updatedPostData.isLikedByUser 
                : post.isLikedByUser,
            }
          : post
      )
    );
  };

  const handleLike = async (postId) => {
    if (likeLoading[postId] || !user) return;
    
    const currentUserId = user._id || user.id;
    if (!currentUserId) return;
    
    const currentPost = posts.find(p => p._id === postId);
    if (!currentPost) return;
    
    const wasLiked = isLikedByCurrentUser(currentPost);
    
    setLikeLoading(prev => ({ ...prev, [postId]: true }));
    
    // Optimistic update
    setPosts(prevPosts => 
      prevPosts.map(post => {
        if (post._id === postId) {
          let newLikes = [...(post.likes || [])];
          
          if (wasLiked) {
            newLikes = newLikes.filter(like => {
              const likeUserId = typeof like === 'object' ? (like._id || like.user || like.userId) : like;
              return likeUserId?.toString() !== currentUserId?.toString();
            });
          } else {
            const alreadyLiked = newLikes.some(like => {
              const likeUserId = typeof like === 'object' ? (like._id || like.user || like.userId) : like;
              return likeUserId?.toString() === currentUserId?.toString();
            });
            
            if (!alreadyLiked) {
              newLikes.push(currentUserId);
            }
          }
          
          return {
            ...post,
            likes: newLikes,
            isLikedByUser: !wasLiked,
          };
        }
        return post;
      })
    );
    
    try {
      const result = await toggleLikePost(postId);
      
      if (result.success) {
        setPosts(prevPosts => 
          prevPosts.map(post => 
            post._id === postId 
              ? { 
                  ...post, 
                  likes: result.data?.likes || result.likes || post.likes,
                  isLikedByUser: result.data?.isLikedByUser !== undefined 
                    ? result.data.isLikedByUser 
                    : !wasLiked,
                }
              : post
          )
        );
      } else {
        // Revert optimistic update
        setPosts(prevPosts => 
          prevPosts.map(post => 
            post._id === postId 
              ? { ...currentPost }
              : post
          )
        );
      }
    } catch (error) {
      console.error('Error liking post:', error);
      // Revert optimistic update
      setPosts(prevPosts => 
        prevPosts.map(post => 
          post._id === postId 
            ? { ...currentPost }
            : post
        )
      );
    } finally {
      setTimeout(() => {
        setLikeLoading(prev => ({ ...prev, [postId]: false }));
      }, 300);
    }
  };

  const handleCommentChange = (postId, value) => {
    setCommentTexts(prev => ({
      ...prev,
      [postId]: value
    }));
  };

  const handleAddComment = async (postId) => {
    const commentText = commentTexts[postId];
    
    if (!commentText || commentText.trim().length === 0) return;

    setCommentLoading(prev => ({ ...prev, [postId]: true }));

    try {
      const result = await addComment(postId, commentText.trim());
      
      if (result.success) {
        const newComment = result.data?.comment || result.comment || {
          _id: Date.now().toString(),
          text: commentText.trim(),
          user: user,
          createdAt: new Date().toISOString()
        };

        setPosts(prevPosts => 
          prevPosts.map(post => 
            post._id === postId 
              ? { 
                  ...post, 
                  comments: [...(post.comments || []), newComment]
                }
              : post
          )
        );
        
        setCommentTexts(prev => ({
          ...prev,
          [postId]: ''
        }));
      } else {
        alert('Failed to add comment: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error adding comment:', error);
      alert('Error adding comment. Please try again.');
    } finally {
      setCommentLoading(prev => ({ ...prev, [postId]: false }));
    }
  };

  const handleCommentClick = (postId) => {
    const commentInput = document.querySelector(`input[data-post-id="${postId}"]`);
    if (commentInput) {
      commentInput.focus();
    }
  };

  const handleShareClick = async (post) => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: `Post by ${post.user?.username || 'Unknown User'}`,
          text: post.caption || 'Check out this post!',
          url: window.location.origin + `/post/${post._id}`
        });
      } else {
        const shareUrl = window.location.origin + `/post/${post._id}`;
        await navigator.clipboard.writeText(shareUrl);
        alert('Link copied to clipboard!');
      }
    } catch (error) {
      try {
        const shareUrl = window.location.origin + `/post/${post._id}`;
        await navigator.clipboard.writeText(shareUrl);
        alert('Link copied to clipboard!');
      } catch (clipboardError) {
        alert('Unable to share post');
      }
    }
  };

  const formatTimeAgo = (dateString) => {
    try {
      const now = new Date();
      const postDate = new Date(dateString);
      const diffInSeconds = Math.floor((now - postDate) / 1000);

      if (diffInSeconds < 60) return 'just now';
      if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`;
      if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`;
      if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d`;
      return `${Math.floor(diffInSeconds / 604800)}w`;
    } catch (error) {
      return 'recently';
    }
  };

  const handleStoryClick = (storyGroup) => {
    setSelectedStories(storyGroup.stories);
    setCurrentStoryIndex(0);
    setShowStoryViewer(true);
  };

  const handleCloseStoryViewer = () => {
    setShowStoryViewer(false);
    setSelectedStories([]);
    setCurrentStoryIndex(0);
  };

  const handleNextStory = (index) => {
    setCurrentStoryIndex(index);
  };

  const handlePreviousStory = (index) => {
    setCurrentStoryIndex(index);
  };

  const isLikedByCurrentUser = (post) => {
    if (!user || !post || !post.likes || !Array.isArray(post.likes)) {
      return false;
    }
    
    if (typeof post.isLikedByUser === 'boolean') {
      return post.isLikedByUser;
    }
    
    const currentUserId = user._id || user.id;
    if (!currentUserId) return false;
    
    return post.likes.some(like => {
      const likeUserId = typeof like === 'object' ? (like._id || like.user || like.userId) : like;
      return likeUserId?.toString() === currentUserId?.toString();
    });
  };

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner}></div>
        <p>Loading your feed...</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const displaySuggestions = showAllSuggestions ? suggestions : suggestions.slice(0, 5);

  return (
    <div className={styles.container}>
      {/* Left Sidebar */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarContent}>
          <h1 className={styles.logo}>Instagram</h1>
          
          <nav className={styles.nav}>
            <Link href="/" className={styles.navItem}>
              <span className={styles.navIcon}>🏠</span>
              <span className={styles.navText}>Home</span>
            </Link>
            <Link href="/search" className={styles.navItem}>
              <span className={styles.navIcon}>🔍</span>
              <span className={styles.navText}>Search</span>
            </Link>
            <Link href="/explore" className={styles.navItem}>
              <span className={styles.navIcon}>🧭</span>
              <span className={styles.navText}>Explore</span>
            </Link>
            <Link href="/reels" className={styles.navItem}>
              <span className={styles.navIcon}>🎬</span>
              <span className={styles.navText}>Reels</span>
            </Link>
            <Link href="/messages" className={styles.navItem}>
              <span className={styles.navIcon}>✈️</span>
              <span className={styles.navText}>Messages</span>
            </Link>
            <Link href="/notifications" className={styles.navItem}>
              <span className={styles.navIcon}>❤️</span>
              <span className={styles.navText}>Notifications</span>
            </Link>
            <button 
              onClick={toggleCreateSidebar} 
              className={`${styles.navItem} ${styles.createButton} ${showCreateSidebar ? styles.active : ''}`}
            >
              <span className={styles.navIcon}>➕</span>
              <span className={styles.navText}>Create</span>
            </button>
            <Link href={`/profile/${user.username}`} className={styles.navItem}>
              <span className={styles.navIcon}>👤</span>
              <span className={styles.navText}>Profile</span>
            </Link>
          </nav>

          <div className={styles.sidebarBottom}>
            <button onClick={handleLogout} className={styles.logoutButton}>
              <span className={styles.navIcon}>🚪</span>
              <span className={styles.navText}>Logout</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Create Sidebar */}
      {showCreateSidebar && (
        <>
          <div className={styles.createOverlay} onClick={toggleCreateSidebar}></div>
          <aside className={styles.createSidebar}>
            <div className={styles.createSidebarContent}>
              <div className={styles.createHeader}>
                <h3>Create</h3>
                <button onClick={toggleCreateSidebar} className={styles.closeButton}>
                  ✕
                </button>
              </div>
              
              <div className={styles.createOptions}>
                <button 
                  onClick={() => handleCreateOptionClick('/create-post')}
                  className={styles.createOption}
                >
                  <span className={styles.createIcon}>📝</span>
                  <div className={styles.createOptionText}>
                    <span className={styles.createOptionTitle}>Post</span>
                    <span className={styles.createOptionDesc}>Share a photo or video</span>
                  </div>
                </button>
                
                <button 
                  onClick={() => handleCreateOptionClick('/create-reel')}
                  className={styles.createOption}
                >
                  <span className={styles.createIcon}>🎥</span>
                  <div className={styles.createOptionText}>
                    <span className={styles.createOptionTitle}>Reel</span>
                    <span className={styles.createOptionDesc}>Create a short video</span>
                  </div>
                </button>
                
                <button 
                  onClick={() => handleCreateOptionClick('/create-story')}
                  className={styles.createOption}
                >
                  <span className={styles.createIcon}>📸</span>
                  <div className={styles.createOptionText}>
                    <span className={styles.createOptionTitle}>Story</span>
                    <span className={styles.createOptionDesc}>Share a moment</span>
                  </div>
                </button>
                
                <button 
                  onClick={() => handleCreateOptionClick('/go-live')}
                  className={styles.createOption}
                >
                  <span className={styles.createIcon}>📺</span>
                  <div className={styles.createOptionText}>
                    <span className={styles.createOptionTitle}>Live</span>
                    <span className={styles.createOptionDesc}>Go live with your followers</span>
                  </div>
                </button>
              </div>
            </div>
          </aside>
        </>
      )}

      {/* Main Feed */}
      <main className={styles.main}>
        <div className={styles.mainContent}>
          {/* Stories Section */}
          <div className={styles.storiesSection}>
            <StoriesBar onStoryClick={handleStoryClick} />
          </div>

          {/* Error Message */}
          {error && (
            <div className={styles.error}>
              <span>⚠️</span>
              {error}
            </div>
          )}

          {/* Feed Posts */}
          <div className={styles.feedContainer}>
            {postsLoading ? (
              <div className={styles.feedLoading}>
                <div className={styles.loadingSpinner}></div>
                <span>Loading posts...</span>
              </div>
            ) : posts.length === 0 ? (
              <div className={styles.emptyFeed}>
                <div className={styles.emptyIcon}>📷</div>
                <h3>No posts yet</h3>
                <p>Start following people or create your first post!</p>
                <Link href="/create-post" className={styles.createFirstPost}>
                  Create Your First Post
                </Link>
              </div>
            ) : (
              <div className={styles.postsContainer}>
                {posts.map((post, index) => {
                  if (!post || !post._id) return null;

                  const isLiked = isLikedByCurrentUser(post);
                  const isVisible = visiblePosts.has(post._id);

                  return (
                    <article 
                      key={post._id}
                      className={`${styles.post} ${isVisible ? styles.postVisible : ''}`}
                      data-post-id={post._id}
                      style={{ animationDelay: `${index * 0.1}s` }}
                    >
                      {/* Post Header */}
                      <div className={styles.postHeader}>
                        <div className={styles.userInfo}>
                          <div className={styles.avatar}>
                            {post.user?.profilePicture ? (
                              <img src={post.user.profilePicture} alt={post.user.username || 'User'} />
                            ) : (
                              <div className={styles.defaultAvatar}>
                                {post.user?.username ? post.user.username.charAt(0).toUpperCase() : 'U'}
                              </div>
                            )}
                          </div>
                          <div className={styles.userDetails}>
                            <span className={styles.username}>
                              {post.user?.username || 'Unknown User'}
                            </span>
                            {post.location && (
                              <span className={styles.location}>{post.location}</span>
                            )}
                          </div>
                        </div>
                        <div className={styles.postTime}>
                          {formatTimeAgo(post.createdAt)}
                        </div>
                      </div>

                      {/* Post Image - Make clickable to open modal */}
                      {post.imageUrl && (
                        <div className={styles.postImage}>
                          <img 
                            src={post.imageUrl} 
                            alt="Post" 
                            onClick={(e) => handlePostImageClick(post._id, e)}
                            style={{ cursor: 'pointer' }}
                            title="Click to view post details"
                          />
                          <div className={styles.imageOverlay}></div>
                        </div>
                      )}

                      {/* Post Actions */}
                      <div className={styles.postActions}>
                        <div className={styles.actionButtons}>
                          <button 
                            onClick={() => handleLike(post._id)}
                            disabled={likeLoading[post._id]}
                            className={`${styles.actionButton} ${styles.likeButton} ${isLiked ? styles.liked : styles.notLiked}`}
                            title={isLiked ? "Unlike post" : "Like post"}
                          >
                            <div className={styles.buttonIcon}>
                              {likeLoading[post._id] ? (
                                <div className={styles.loadingIcon}></div>
                              ) : (
                                <svg 
                                  className={`${styles.heartIcon} ${isLiked ? styles.heartFilled : styles.heartEmpty}`}
                                  viewBox="0 0 24 24"
                                  fill={isLiked ? "#ed4956" : "none"}
                                  stroke={isLiked ? "#ed4956" : "#262626"}
                                  strokeWidth="2"
                                >
                                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                                </svg>
                              )}
                            </div>
                          </button>
                          <button 
                            onClick={() => handleCommentClick(post._id)}
                            className={`${styles.actionButton} ${styles.commentButton}`}
                            title="Add comment"
                          >
                            <div className={styles.buttonIcon}>
                              <svg className={styles.commentIcon} viewBox="0 0 24 24">
                                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                              </svg>
                            </div>
                          </button>
                          <button 
                            onClick={() => handleShareClick(post)}
                            className={`${styles.actionButton} ${styles.shareButton}`}
                            title="Share post"
                          >
                            <div className={styles.buttonIcon}>
                              <svg className={styles.shareIcon} viewBox="0 0 24 24">
                                <circle cx="18" cy="5" r="3"/>
                                <circle cx="6" cy="12" r="3"/>
                                <circle cx="18" cy="19" r="3"/>
                                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                              </svg>
                            </div>
                          </button>
                        </div>
                      </div>

                      {/* Post Stats */}
                      <div className={styles.postStats}>
                        {post.likes && post.likes.length > 0 && (
                          <div className={styles.likesCount}>
                            <span className={styles.countNumber}>{post.likes.length}</span>
                            <span>{post.likes.length === 1 ? 'like' : 'likes'}</span>
                          </div>
                        )}
                      </div>

                      {/* Post Caption */}
                      {post.caption && (
                        <div className={styles.postCaption}>
                          <span className={styles.username}>
                            {post.user?.username || 'Unknown User'}
                          </span>
                          <span className={styles.captionText}>{post.caption}</span>
                        </div>
                      )}

                      {/* Post Tags */}
                      {post.tags && post.tags.length > 0 && (
                        <div className={styles.postTags}>
                          {post.tags.map((tag, tagIndex) => (
                            <span 
                              key={tagIndex} 
                              className={styles.tag}
                              style={{ animationDelay: `${tagIndex * 0.1}s` }}
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Comments */}
                      <div className={styles.commentsSection}>
                        {post.comments && post.comments.length > 0 && (
                          <div className={styles.comments}>
                            {post.comments.slice(-2).map((comment, commentIndex) => (
                              <div 
                                key={comment._id || commentIndex} 
                                className={styles.comment}
                                style={{ animationDelay: `${commentIndex * 0.1}s` }}
                              >
                                <span className={styles.commentUsername}>
                                  {comment.user?.username || 'Unknown User'}
                                </span>
                                <span className={styles.commentText}>{comment.text}</span>
                              </div>
                            ))}
                            {post.comments.length > 2 && (
                              <button 
                                className={styles.viewAllComments}
                                onClick={(e) => handlePostImageClick(post._id, e)}
                              >
                                View all {post.comments.length} comments
                              </button>
                            )}
                          </div>
                        )}

                        {/* Add Comment */}
                        <div className={styles.addComment}>
                          <input
                            type="text"
                            placeholder="Add a comment..."
                            value={commentTexts[post._id] || ''}
                            data-post-id={post._id}
                            onChange={(e) => handleCommentChange(post._id, e.target.value)}
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                handleAddComment(post._id);
                              }
                            }}
                            className={styles.commentInput}
                            maxLength={500}
                          />
                          <button
                            onClick={() => handleAddComment(post._id)}
                            disabled={!commentTexts[post._id] || commentLoading[post._id]}
                            className={styles.postCommentButton}
                          >
                            {commentLoading[post._id] ? (
                              <span className={styles.loadingDot}></span>
                            ) : (
                              'Post'
                            )}
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}

                {/* Load More Button */}
                {hasMore && (
                  <div className={styles.loadMoreContainer}>
                    <button
                      onClick={loadMorePosts}
                      disabled={loadingMore}
                      className={styles.loadMoreButton}
                    >
                      {loadingMore ? (
                        <>
                          <span className={`${styles.loadingSpinner} ${styles.small}`}></span>
                          <span>Loading...</span>
                        </>
                      ) : (
                        <>
                          <span>Load More Posts</span>
                          <span className={styles.loadMoreIcon}>↓</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Right Sidebar with User Info and Follow Suggestions */}
      <aside className={styles.rightSidebar}>
        <div className={styles.rightSidebarContent}>
          {/* Current User Info */}
          <div className={styles.currentUserInfo}>
            <div className={styles.userCard}>
              <div className={styles.userAvatar}>
                {user?.profilePicture ? (
                  <img src={user.profilePicture} alt={user.username || 'User'} />
                ) : (
                  <div className={styles.defaultUserAvatar}>
                    {user?.username ? user.username.charAt(0).toUpperCase() : 'U'}
                  </div>
                )}
              </div>
              <div className={styles.userCardInfo}>
                <span className={styles.currentUsername}>{user?.username}</span>
                <span className={styles.currentUserFullName}>{user?.fullName || user?.name}</span>
              </div>
              <Link href={`/profile/${user?.username}`} className={styles.switchLink}>
                Switch
              </Link>
            </div>
          </div>

          {/* Follow Suggestions Section */}
          <div className={styles.followSuggestionsSection}>
            <div className={styles.suggestionsHeader}>
              <span className={styles.suggestionsTitle}>Suggestions For You</span>
              {suggestions.length > 5 && (
                <button 
                  onClick={() => setShowAllSuggestions(!showAllSuggestions)}
                  className={styles.seeAllButton}
                >
                  {showAllSuggestions ? 'Show Less' : 'See All'}
                </button>
              )}
              <button
                onClick={() => loadSuggestions(true)}
                disabled={suggestionsLoading}
                className={styles.refreshSuggestionsButton}
                title="Refresh suggestions"
              >
                <RefreshCw className={suggestionsLoading ? styles.spinning : ''} size={14} />
              </button>
            </div>

            {/* Suggestions Loading State */}
            {suggestionsLoading && suggestions.length === 0 ? (
              <div className={styles.suggestionsLoading}>
                {[...Array(3)].map((_, i) => (
                  <div key={i} className={styles.suggestionItemSkeleton}>
                    <div className={styles.skeletonAvatar}></div>
                    <div className={styles.skeletonInfo}>
                      <div className={styles.skeletonUsername}></div>
                      <div className={styles.skeletonSubtext}></div>
                    </div>
                    <div className={styles.skeletonButton}></div>
                  </div>
                ))}
              </div>
            ) : suggestionsError ? (
              <div className={styles.suggestionsError}>
                <Users className={styles.errorIcon} size={20} />
                <p className={styles.errorText}>Failed to load suggestions</p>
                <button
                  onClick={() => loadSuggestions()}
                  className={styles.retryButton}
                >
                  Try again
                </button>
              </div>
            ) : displaySuggestions.length === 0 ? (
              <div className={styles.noSuggestions}>
                <Search className={styles.emptyIcon} size={24} />
                <p className={styles.emptyText}>No suggestions available</p>
                <button
                  onClick={() => loadSuggestions()}
                  className={styles.refreshButton}
                >
                  Refresh
                </button>
              </div>
            ) : (
              <div className={styles.suggestionsList}>
                {displaySuggestions.map((suggestion) => {
                  const isFollowing = followingStates[suggestion._id];
                  const isPending = isFollowing === 'pending';
                  const isNew = suggestion.daysSinceJoined <= 30;

                  return (
                    <div key={suggestion._id} className={styles.suggestionItem}>
                      <div className={styles.suggestionAvatar}>
                        <img
                          src={getProfileImageSrc(suggestion)}
                          alt={suggestion.fullName || suggestion.username}
                          onError={(e) => {
                            e.target.src = getProfileImageSrc(suggestion);
                          }}
                        />
                        {isNew && (
                          <div className={styles.newBadge}>
                            <span>!</span>
                          </div>
                        )}
                      </div>
                      
                      <div className={styles.suggestionInfo}>
                        <div className={styles.suggestionHeader}>
                          <span className={styles.suggestionUsername}>
                            {suggestion.username}
                          </span>
                          {suggestion.daysSinceJoined <= 7 && (
                            <span className={styles.newUserBadge}>New</span>
                          )}
                        </div>
                        <span className={styles.suggestionFullName}>
                          {suggestion.fullName}
                        </span>
                        <span className={styles.suggestionSubtext}>
                          {suggestion.suggestionReason || 'Suggested for you'} • {formatFollowerCount(suggestion.followersCount || 0)} followers
                        </span>
                      </div>
                      
                      <div className={styles.suggestionActions}>
                        {!isFollowing && (
                          <button
                            onClick={() => handleFollow(suggestion._id)}
                            disabled={isPending}
                            className={styles.followButton}
                          >
                            {isPending ? (
                              <RefreshCw className={styles.spinning} size={12} />
                            ) : (
                              <UserPlus size={12} />
                            )}
                            <span>{isPending ? 'Following...' : 'Follow'}</span>
                          </button>
                        )}
                        {isFollowing === true && (
                          <div className={styles.followingButton}>
                            Following
                          </div>
                        )}
                        <button
                          onClick={() => handleDismiss(suggestion._id)}
                          className={styles.dismissButton}
                          title="Dismiss suggestion"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer Links */}
          <div className={styles.sidebarFooter}>
            <div className={styles.footerLinks}>
              <Link href="/about">About</Link>
              <Link href="/help">Help</Link>
              <Link href="/press">Press</Link>
              <Link href="/api">API</Link>
              <Link href="/jobs">Jobs</Link>
              <Link href="/privacy">Privacy</Link>
              <Link href="/terms">Terms</Link>
            </div>
            <div className={styles.copyright}>
              <span>© 2024 InstaApp clone</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Story Viewer */}
      {showStoryViewer && (
        <StoryViewer
          stories={selectedStories}
          currentIndex={currentStoryIndex}
          onClose={handleCloseStoryViewer}
          onNext={handleNextStory}
          onPrevious={handlePreviousStory}
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
  );
}
