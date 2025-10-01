import { useState, useEffect } from 'react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://instagram-clone-0t5v.onrender.com';

const getAuthToken = () => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('instagram_token') || localStorage.getItem('token');
};

export const useViewTracking = (reels) => {
  const [viewedReels, setViewedReels] = useState(new Set());

  const trackView = async (reelId) => {
    if (viewedReels.has(reelId)) return;

    const authToken = getAuthToken();
    if (!authToken) return;

    try {
      const response = await fetch(`${API_BASE_URL}/reels/${reelId}/view`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });

      if (response.ok) {
        setViewedReels(prev => new Set([...prev, reelId]));
      }
    } catch (error) {
      console.error('Error tracking view:', error);
    }
  };

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const reelId = entry.target.getAttribute('data-reel-id');
            if (reelId) {
              setTimeout(() => trackView(reelId), 1000);
            }
          }
        });
      },
      { threshold: 0.5 }
    );

    const videos = document.querySelectorAll('[data-reel-id]');
    videos.forEach(video => observer.observe(video));

    return () => observer.disconnect();
  }, [reels]);

  return { viewedReels, trackView };
};
