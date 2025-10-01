import { useState } from 'react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://instagram-clone-0t5v.onrender.com';

const getAuthToken = () => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('instagram_token') || 
         localStorage.getItem('token');
};

export const useReelsData = () => {
  const [reels, setReels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(true);

  const loadReels = async (page = 1) => {
    try {
      setLoading(true);
      setError('');
      
      const authToken = getAuthToken();
      if (!authToken) throw new Error('Authentication required');

      const response = await fetch(`${API_BASE_URL}/reels/feed?page=${page}&limit=10`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to load reels');
      }

      const result = await response.json();
      
      if (result.success) {
        setReels(prev => page === 1 ? result.reels : [...prev, ...result.reels]);
        setHasNextPage(result.pagination?.hasNextPage || false);
        setCurrentPage(page);
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleLike = async (reelId) => {
    try {
      const authToken = getAuthToken();
      const response = await fetch(`${API_BASE_URL}/reels/${reelId}/like`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });

      const result = await response.json();
      if (result.success) {
        setReels(prev => prev.map(reel => 
          reel._id === reelId 
            ? { ...reel, isLikedByUser: result.isLiked, likesCount: result.likesCount }
            : reel
        ));
      }
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };

  const addComment = async (reelId, text) => {
    try {
      const authToken = getAuthToken();
      const response = await fetch(`${API_BASE_URL}/reels/${reelId}/comment`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ text })
      });

      const result = await response.json();
      if (result.success) {
        setReels(prev => prev.map(reel => 
          reel._id === reelId 
            ? { 
                ...reel, 
                commentsCount: result.commentsCount,
                comments: [result.comment, ...(reel.comments || [])]
              }
            : reel
        ));
      }
    } catch (error) {
      console.error('Error adding comment:', error);
    }
  };

  const shareReel = async (reelId) => {
    try {
      const authToken = getAuthToken();
      await fetch(`${API_BASE_URL}/reels/${reelId}/share`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });

      const reelUrl = `${window.location.origin}/reel/${reelId}`;
      if (navigator.share) {
        await navigator.share({ title: 'Check out this reel!', url: reelUrl });
      } else {
        await navigator.clipboard.writeText(reelUrl);
      }
    } catch (error) {
      console.error('Error sharing reel:', error);
    }
  };

  return {
    reels,
    loading,
    error,
    hasNextPage,
    currentPage,
    loadReels,
    toggleLike,
    addComment,
    shareReel,
    setError
  };
};
