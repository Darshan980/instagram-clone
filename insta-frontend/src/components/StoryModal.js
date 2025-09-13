'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import styles from './StoryModal.module.css';

const StoryModal = ({ stories, currentIndex, onClose, onNext, onPrevious }) => {
  const [currentStoryIndex, setCurrentStoryIndex] = useState(currentIndex || 0);
  const [progress, setProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!stories || stories.length === 0) return;

    const currentStory = stories[currentStoryIndex];
    if (!currentStory) return;

    // Auto-advance functionality
    const duration = currentStory.mediaType === 'video' ? 15000 : 5000;
    const interval = 100;
    const increment = 100 / (duration / interval);

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          // Use setTimeout to avoid state update during render
          setTimeout(() => {
            handleNext();
          }, 0);
          return 0;
        }
        return prev + increment;
      });
    }, interval);

    return () => clearInterval(timer);
  }, [currentStoryIndex, stories]);

  const handleNext = () => {
    if (currentStoryIndex < stories.length - 1) {
      setCurrentStoryIndex(prev => prev + 1);
      setProgress(0);
    } else {
      onClose();
    }
  };

  const handlePrevious = () => {
    if (currentStoryIndex > 0) {
      setCurrentStoryIndex(prev => prev - 1);
      setProgress(0);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'ArrowRight') handleNext();
    if (e.key === 'ArrowLeft') handlePrevious;
    if (e.key === 'Escape') onClose();
  };

  useEffect(() => {
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handleKeyPress]);

  if (!stories || stories.length === 0) {
    console.log('No stories available:', { stories });
    return null;
  }

  const currentStory = stories[currentStoryIndex];
  if (!currentStory) {
    console.log('Current story not found:', { currentStoryIndex, stories });
    return null;
  }

  // Debug current story data
  console.log('Current story data:', {
    storyId: currentStory._id,
    mediaUrl: currentStory.mediaUrl,
    userData: currentStory.userId || currentStory.user,
    rawStory: currentStory
  });

  // Get user data from the correct location
  const userData = currentStory.userId || currentStory.user || {};
  const username = userData.username || 'User';
  const profilePicture = userData.profilePicture;

  return (
    <div className={styles.storyModal} onClick={onClose}>
      <div className={styles.storyContainer} onClick={(e) => e.stopPropagation()}>
        {/* Progress bars */}
        <div className={styles.progressContainer}>
          {stories.map((_, index) => (
            <div key={index} className={styles.progressBar}>
              <div 
                className={`${styles.progressFill} ${index < currentStoryIndex ? styles.completed : ''}`}
                style={{ 
                  width: index === currentStoryIndex ? `${progress}%` : 
                         index < currentStoryIndex ? '100%' : '0%' 
                }}
              />
            </div>
          ))}
        </div>

        {/* Close button */}
        <button className={styles.closeButton} onClick={onClose}>
          ✕
        </button>

        {/* Navigation buttons */}
        <button className={styles.navButton} onClick={handlePrevious}>
          ‹
        </button>
        <button className={styles.navButton} onClick={handleNext}>
          ›
        </button>

        {/* User info */}
        <div className={styles.userInfo}>
          <img 
            src={profilePicture || 
                `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&size=400&background=0095f6&color=fff`
            } 
            alt={username}
            className={styles.userAvatar}
            onError={(e) => {
              console.log('Profile picture load error:', { 
                attemptedSrc: e.target.src,
                userData
              });
              if (!e.target.src.includes('ui-avatars.com')) {
                e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&size=400&background=0095f6&color=fff`;
              }
            }}
          />
          <span className={styles.username}>{username}</span>
          <span className={styles.timestamp}>
            {new Date(currentStory.createdAt).toLocaleTimeString()}
          </span>
        </div>

        {/* Story content */}
        <div className={styles.storyContent}>
          {currentStory.mediaType === 'video' ? (
            <video
              src={currentStory.mediaUrl}
              className={styles.storyMedia}
              autoPlay
              muted
              playsInline
              controls={false}
            />
          ) : (
            <img
              src={currentStory.mediaUrl}
              alt="Story"
              className={styles.storyMedia}
            />
          )}
          
          {currentStory.caption && (
            <div className={styles.caption}>{currentStory.caption}</div>
          )}
        </div>

        {/* Touch/Click areas for navigation */}
        <div className={styles.touchArea} onClick={handlePrevious} />
        <div className={styles.touchArea} onClick={handleNext} />
      </div>
    </div>
  );
};

export default StoryModal;
