// dashboard/hooks/useDashboard.js (Custom Hook - All Logic)
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
      const result = await getCurrentUserProfile();
      if (result.success) {
        setUser(result.data?.user || result.user || result.data);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFeed = async (pageNum = 1, append = false) => {
    try {
      if (pageNum === 1) setPostsLoading(true);
      
      const result = await getFeedPosts(pageNum, 10);
      
      if (result.success) {
        let postsData = result.data?.posts || result.posts || result.data || [];
        if (!Array.isArray(postsData)) postsData = [];
        
        const validPosts = postsData.filter(p => p?._id).map(post => ({
          ...post,
          user: post.user || { username: 'Unknown User' },
          likes: Array.isArray(post.likes) ? post.likes : [],
          comments: Array.isArray(post.comments) ? post.comments : [],
          imageUrl: post.imageUrl || post.image || ''
        }));
        
        setPosts(prev => append ? [...prev, ...validPosts] : validPosts);
        setHasMore(result.data?.pagination?.hasNextPage || false);
        setPage(pageNum);
      }
    } catch (error) {
      setError('Failed to load feed');
    } finally {
      setPostsLoading(false);
      setLoadingMore(false);
    }
  };

  const loadSuggestions = async (isRefresh = false) => {
    setSuggestionsLoading(true);
    try {
      const result = await getUserSuggestions({ page: 1, limit: 10 });
      if (result.success) {
        setSuggestions(result.data?.users || []);
        const states = {};
        result.data.users.forEach(u => {
          if (u._id) states[u._id] = u.isFollowing || false;
        });
        setFollowingStates(states);
      }
    } catch (err) {
      setSuggestionsError('Failed to load suggestions');
    } finally {
      setSuggestionsLoading(false);
    }
  };

  const handleLogout = () => logout();

  const handleLike = async (postId) => {
    if (likeLoading[postId] || !user) return;
    
    const currentUserId = user._id || user.id;
    const post = posts.find(p => p._id === postId);
    const wasLiked = post?.likes?.some(like => {
      const id = typeof like === 'object' ? like._id : like;
      return id?.toString() === currentUserId?.toString();
    });
    
    setLikeLoading(prev => ({ ...prev, [postId]: true }));
    
    setPosts(prev => prev.map(p => {
      if (p._id !== postId) return p;
      let newLikes = [...(p.likes || [])];
      if (wasLiked) {
        newLikes = newLikes.filter(l => {
          const id = typeof l === 'object' ? l._id : l;
          return id?.toString() !== currentUserId?.toString();
        });
      } else {
        newLikes.push(currentUserId);
      }
      return { ...p, likes: newLikes, isLikedByUser: !wasLiked };
    }));
    
    try {
      const result = await toggleLikePost(postId);
      if (result.success) {
        setPosts(prev => prev.map(p => 
          p._id === postId ? { ...p, likes: result.data?.likes || p.likes } : p
        ));
      }
    } finally {
      setTimeout(() => setLikeLoading(prev => ({ ...prev, [postId]: false })), 300);
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
        const newComment = result.data?.comment || { 
          _id: Date.now().toString(), 
          text, 
          user, 
          createdAt: new Date().toISOString() 
        };
        setPosts(prev => prev.map(p => 
          p._id === postId ? { ...p, comments: [...(p.comments || []), newComment] } : p
        ));
        setCommentTexts(prev => ({ ...prev, [postId]: '' }));
      }
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
          u._id === userId ? { ...u, isFollowing: true } : u
        ));
      }
    } catch {
      setFollowingStates(prev => ({ ...prev, [userId]: false }));
    }
  };

  const handleDismiss = (userId) => {
    setSuggestions(prev => prev.filter(u => u._id !== userId));
  };

  const loadMorePosts = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    await fetchFeed(page + 1, true);
  };

  return {
    user, posts, loading, postsLoading, error,
    suggestions, suggestionsLoading, suggestionsError,
    followingStates, showAllSuggestions, setShowAllSuggestions,
    handleLogout, handleLike, handleAddComment, handleFollow, handleDismiss,
    loadSuggestions, loadMorePosts, hasMore, loadingMore,
    commentTexts, handleCommentChange, commentLoading, likeLoading,
    visiblePosts, setPosts
  };
}
