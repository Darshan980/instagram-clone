'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getToken } from '../utils/auth';
import StoryModal from './StoryModal';
import styles from './StoriesBar.module.css';

const StoriesBar = () => {
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedStoryGroup, setSelectedStoryGroup] = useState(null);
  const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
  const router = useRouter();

  useEffect(() => {
    fetchStories();
  }, []);

  const fetchStories = async () => {
    try {
      const token = getToken();
      
      if (!token || token.length < 10) {
        setError('Please log in to view stories');
        setLoading(false);
        return;
      }

      const response = await fetch('https://instagram-clone-0t5v.onrender.com/api/stories', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch stories: ${response.status}`);
      }

      const data = await response.json();
      setStories(data.stories || []);
    } catch (err) {
      console.error('Error fetching stories:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStoryClick = async (storyGroup) => {
    // Mark stories as viewed
    try {
      const token = getToken();
      if (token) {
        // Mark all stories in this group as viewed
        for (const story of storyGroup.stories) {
          await fetch(`https://instagram-clone-0t5v.onrender.com/api/stories/${story._id}/view`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          });
        }
      }
    } catch (error) {
      console.error('Error marking stories as viewed:', error);
    }

    // Update local state to remove red circle
    setStories(prevStories => 
      prevStories.map(group => 
        group._id === storyGroup._id 
          ? { ...group, hasViewed: true }
          : group
      )
    );

    setSelectedStoryGroup(storyGroup);
    setCurrentStoryIndex(0);
  };

  const handleCloseStory = () => {
    setSelectedStoryGroup(null);
    setCurrentStoryIndex(0);
  };

  const handleNextStory = () => {
    if (selectedStoryGroup && currentStoryIndex < selectedStoryGroup.stories.length - 1) {
      setCurrentStoryIndex(prev => prev + 1);
    } else {
      handleCloseStory();
    }
  };

  const handlePreviousStory = () => {
    if (currentStoryIndex > 0) {
      setCurrentStoryIndex(prev => prev - 1);
    }
  };

  const handleCreateStory = () => {
    router.push('/create-story');
  };

  if (loading) {
    return (
      <div className={styles.storiesBar}>
        <div className={styles.loadingContainer}>
          {[...Array(5)].map((_, index) => (
            <div key={index} className={styles.storyCircleSkeleton}></div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.storiesBar}>
        <div className={styles.errorMessage}>
          {error}
          <button 
            onClick={() => {
              setError(null);
              setLoading(true);
              fetchStories();
            }}
            style={{ 
              marginLeft: '10px', 
              padding: '5px 10px', 
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className={styles.storiesBar}>
        <div className={styles.storiesContainer}>
          {/* Create Story Button - Clean design without red circle */}
          <div 
            className={`${styles.storyCircle} ${styles.createStory}`}
            onClick={handleCreateStory}
          >
            <div className={styles.createStoryRing}>
              <div className={styles.createStoryIcon}>+</div>
            </div>
            <span className={styles.username}>Your Story</span>
          </div>

          {/* Existing Stories */}
          {stories.map((storyGroup) => (
            <div
              key={storyGroup._id}
              className={`${styles.storyCircle} ${storyGroup.hasViewed ? styles.viewed : styles.unviewed}`}
              onClick={() => handleStoryClick(storyGroup)}
            >
              <div className={`${styles.storyRing} ${storyGroup.hasViewed ? styles.viewed : ''}`}>
                <img
                  src={storyGroup.user.profilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(storyGroup.user.username)}&size=60&background=0095f6&color=fff`}
                  alt={storyGroup.user.username}
                  className={styles.profileImage}
                  onError={(e) => {
                    e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(storyGroup.user.username)}&size=60&background=0095f6&color=fff`;
                  }}
                />
              </div>
              <span className={styles.username}>
                {storyGroup.user.username}
              </span>
            </div>
          ))}
        </div>
      </div>

      {selectedStoryGroup && (
        <StoryModal
          stories={selectedStoryGroup.stories}
          currentIndex={currentStoryIndex}
          onClose={handleCloseStory}
          onNext={handleNextStory}
          onPrevious={handlePreviousStory}
        />
      )}
    </>
  );
};

export default StoriesBar;
