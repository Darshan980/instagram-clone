// dashboard/hooks/useDashboard.js
import { useState, useEffect } from 'react';
import { 
  getCurrentUserProfile, 
  logout, 
  getFeedPosts, 
  toggleLikePost, 
  addComment 
} from '../../../utils/auth';
import { getUserSuggestions, followUser } from '../utils/api';

export function useDashboard() {
  const [user, setUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [postsLoading, setPostsLoading] = useState(true);
  const [error, setError] = useState('');
  const [commentTexts, setCommentTexts] = useState({});
  const [commentLoading, setCommentLoading] = useState({});
  const [likeLoading, setLikeLoading] = useState({});
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [visiblePosts, setVisiblePosts] = useState(new Set());
  
  const [suggestions, setSuggestions] = useState([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsError, setSuggestionsError] = useState(null);
  const [followingStates, setFollowingStates] = useState({});
  const [showAllSuggestions, setShowAllSuggestions] = useState(false);

  useEffect(() => {
    fetchUserProfile();
    fetchFeed();
    loadSuggestions();
  }, []);

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
      { threshold: 0.1, rootMargin: '20px' }
    );

    const postElements = document.querySelectorAll('[data-post-id]');
    postElements.forEach(el => observer.observe(el));

    return () => observer.disconnect();
  }, [posts]);

  const fetchUserProfile = async () => {
    try {
      console.log('Fetching user profile...');
      const result = await getCurrentUserProfile();
      console.log('Profile result:', result);
      
      if (result.success) {
        const userData = result.data?.user || result.user || result.data;
        setUser(userData);
        console.log('User set:', userData);
      } else {
        console.error('Profile fetch failed:', result.error);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFeed = async (pageNum = 1, append = false) => {
    try {
      console.log(`Fetching feed - page ${pageNum}, append: ${append}`);
      
      if (pageNum === 1) setPostsLoading(true);
      
      const result = await getFeedPosts(pageNum, 10);
      console.log('Feed result:', result);
      console.log('Result structure:', {
        success: result.success,
        hasData: !!result.data,
        hasPosts: !!result.posts,
        dataType: typeof result.data,
        postsType: typeof result.posts
      });
      
      // Handle multiple possible response structures
      let postsData = [];
      
      if (result.success) {
        // Try different data paths
        if (result.data?.posts) {
          postsData = result.data.posts;
        } else if (Array.isArray(result.data)) {
          postsData = result.data;
        } else if (result.posts) {
          postsData = result.posts;
        } else if (result.data?.data?.posts) {
          postsData = result.data.data.posts;
        }
      } else if (result.data || result.posts) {
        // Even if success is false, check for data
        postsData = result.data?.posts || result.posts || result.data || [];
      }
      
      console.log('Extracted posts data:', postsData);
      console.log('Posts data length:', postsData?.length);
      
      if (!Array.isArray(postsData)) {
        console.warn('Posts data is not an array:', postsData);
        postsData = [];
      }
      
      const validPosts = postsData
        .filter(p => {
          if (!p?._id) {
            console.warn('Filtering out post without _id:', p);
            return false;
          }
          return true;
        })
        .map(post => ({
          ...post,
          user: post.user || { username: 'Unknown User', profilePicture: null },
          likes: Array.isArray(post.likes) ? post.likes : [],
          comments: Array.isArray(post.comments) ? post.comments : [],
          tags: Array.isArray(post.tags) ? post.tags : [],
          imageUrl: post.imageUrl || post.image || '',
          caption: post.caption || '',
          createdAt: post.createdAt || new Date().toISOString()
        }));
      
      console.log('Valid posts after processing:', validPosts.length);
      console.log('Sample post:', validPosts[0]);
      
      if (append) {
        setPosts(prev => {
          console.log('Appending posts. Previous count:', prev.length);
          return [...prev, ...validPosts];
        });
      } else {
        console.log('Setting posts (not appending):', validPosts.length);
        setPosts(validPosts);
      }
      
      const pagination = result.data?.pagination || result.pagination || {};
      setHasMore(pagination.hasNextPage || false);
      setPage(pageNum);
      setError('');
      
    } catch (error) {
      console.error('Feed fetch error:', error);
      setError('Failed to load feed: ' + error.message);
      setPosts([]);
    } finally {
      console.log('Setting postsLoading to false');
      setPostsLoading(false);
      setLoadingMore(false);
    }
  };

  const loadSuggestions = async (isRefresh = false) => {
    setSuggestionsLoading(true);
    setSuggestionsError(null);
    
    try {
      const result = await getUserSuggestions({ page: 1, limit: 10 });
      
      if (result.success) {
        const users = result.data?.users || [];
        setSuggestions(users);
        
        const states = {};
        users.forEach(u => {
          if (u._id) states[u._id] = u.isFollowing || false;
        });
        setFollowingStates(states);
      } else {
        setSuggestionsError(result.error || 'Failed to load suggestions');
      }
    } catch (err) {
      setSuggestionsError('Network error: ' + err.message);
    } finally {
      setSuggestionsLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
  };

  const handleLike = async (postId) => {
    if (likeLoading[postId] || !user) return;
    
    const currentUserId = user._id || user.id;
    if (!currentUserId) return;
    
    const post = posts.find(p => p._id === postId);
    if (!post) return;
    
    const wasLiked = post.likes?.some(like => {
      const id = typeof like === 'object' ? (like._id || like.user || like.userId) : like;
      return id?.toString() === currentUserId?.toString();
    });
    
    setLikeLoading(prev => ({ ...prev, [postId]: true }));
    
    // Optimistic update
    setPosts(prev => prev.map(p => {
      if (p._id !== postId) return p;
      
      let newLikes = [...(p.likes || [])];
      if (wasLiked) {
        newLikes = newLikes.filter(l => {
          const id = typeof l === 'object' ? (l._id || l.user || l.userId) : l;
          return id?.toString() !== currentUserId?.toString();
        });
      } else {
        const alreadyExists = newLikes.some(l => {
          const id = typeof l === 'object' ? (l._id || l.user || l.userId) : l;
          return id?.toString() === currentUserId?.toString();
        });
        if (!alreadyExists) {
          newLikes.push(currentUserId);
        }
      }
      
      return { ...p, likes: newLikes, isLikedByUser: !wasLiked };
    }));
    
    try {
      const result = await toggleLikePost(postId);
      
      if (result.success) {
        setPosts(prev => prev.map(p => 
          p._id === postId 
            ? { 
                ...p, 
                likes: result.data?.likes || result.likes || p.likes,
                isLikedByUser: result.data?.isLikedByUser !== undefined 
                  ? result.data.isLikedByUser 
                  : !wasLiked
              }
            : p
        ));
      } else {
        // Revert on failure
        setPosts(prev => prev.map(p => p._id === postId ? post : p));
      }
    } catch (error) {
      console.error('Like error:', error);
      // Revert on error
      setPosts(prev => prev.map(p => p._id === postId ? post : p));
    } finally {
      setTimeout(() => {
        setLikeLoading(prev => ({ ...prev, [postId]: false }));
      }, 300);
    }
  };

  const handleCommentChange = (postId, value) => {
    setCommentTexts(prev => ({ ...prev, [postId]: value }));
  };

  const handleAddComment = async (postId) => {
    const text = commentTexts[postId]?.trim();
    if (!text) return;

    setCommentLoading(prev => ({ ...prev, [postId]: true }));

    try {
      const result = await addComment(postId, text);
      
      if (result.success) {
        const newComment = result.data?.comment || result.comment || { 
          _id: Date.now().toString(), 
          text, 
          user, 
          createdAt: new Date().toISOString() 
        };
        
        setPosts(prev => prev.map(p => 
          p._id === postId 
            ? { ...p, comments: [...(p.comments || []), newComment] } 
            : p
        ));
        
        setCommentTexts(prev => ({ ...prev, [postId]: '' }));
      } else {
        console.error('Comment failed:', result.error);
      }
    } catch (error) {
      console.error('Comment error:', error);
    } finally {
      setCommentLoading(prev => ({ ...prev, [postId]: false }));
    }
  };

  const handleFollow = async (userId) => {
    setFollowingStates(prev => ({ ...prev, [userId]: 'pending' }));
    
    try {
      const result = await followUser(userId);
      
      if (result.success) {
        setFollowingStates(prev => ({ ...prev, [userId]: true }));
        setSuggestions(prev => prev.map(u => 
          u._id === userId 
            ? { ...u, isFollowing: true, followersCount: (u.followersCount || 0) + 1 }
            : u
        ));
      } else {
        setFollowingStates(prev => ({ ...prev, [userId]: false }));
      }
    } catch (error) {
      console.error('Follow error:', error);
      setFollowingStates(prev => ({ ...prev, [userId]: false }));
    }
  };

  const handleDismiss = (userId) => {
    setSuggestions(prev => prev.filter(u => u._id !== userId));
    setFollowingStates(prev => {
      const newState = { ...prev };
      delete newState[userId];
      return newState;
    });
  };

  const loadMorePosts = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    await fetchFeed(page + 1, true);
  };

  return {
    user, 
    posts, 
    loading, 
    postsLoading, 
    error,
    suggestions, 
    suggestionsLoading, 
    suggestionsError,
    followingStates, 
    showAllSuggestions, 
    setShowAllSuggestions,
    handleLogout, 
    handleLike, 
    handleAddComment, 
    handleFollow, 
    handleDismiss,
    loadSuggestions, 
    loadMorePosts, 
    hasMore, 
    loadingMore,
    commentTexts, 
    handleCommentChange, 
    commentLoading, 
    likeLoading,
    visiblePosts, 
    setPosts
  };
}
