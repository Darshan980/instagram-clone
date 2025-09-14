'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isTokenValid, getCurrentUserProfile } from '../../utils/auth';
import styles from './create-story.module.css';

export default function CreateStory() {
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [mediaPreview, setMediaPreview] = useState(null);
  const [mediaType, setMediaType] = useState('image');
  const [caption, setCaption] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const router = useRouter();

  useEffect(() => {
    if (!isTokenValid()) {
      router.push('/login');
      return;
    }
    
    fetchCurrentUser();
  }, [router]);

  const fetchCurrentUser = async () => {
    try {
      const result = await getCurrentUserProfile();
      if (result.success) {
        setCurrentUser(result.data.user);
      }
    } catch (error) {
      console.error('Error fetching current user:', error);
    }
  };

  const handleMediaChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/');
      
      if (!isImage && !isVideo) {
        setError('Please select an image or video file');
        return;
      }

      // Validate file size (15MB for images, 100MB for videos)
      const maxSize = isImage ? 15 * 1024 * 1024 : 100 * 1024 * 1024;
      if (file.size > maxSize) {
        setError(`${isImage ? 'Image' : 'Video'} size must be less than ${isImage ? '15MB' : '100MB'}`);
        return;
      }

      setSelectedMedia(file);
      setMediaType(isImage ? 'image' : 'video');
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setMediaPreview(e.target.result);
      };
      reader.readAsDataURL(file);
      
      if (error) setError('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!selectedMedia) {
      setError('Please select an image or video');
      setLoading(false);
      return;
    }

    try {
      // Create FormData for file upload
      const formData = new FormData();
      formData.append('media', selectedMedia);
      formData.append('mediaType', mediaType);
      formData.append('caption', caption);

      const token = localStorage.getItem('instagram_token');
      
      const response = await fetch('https://instagram-clone-0t5v.onrender.com/api/stories', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      const result = await response.json();

      if (response.ok) {
        // Redirect to feed after successful story creation
        router.push('/feed');
      } else {
        setError(result.message || 'Failed to create story');
      }
    } catch (error) {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const removeMedia = () => {
    setSelectedMedia(null);
    setMediaPreview(null);
    setMediaType('image');
    // Reset file input
    const fileInput = document.getElementById('media-input');
    if (fileInput) {
      fileInput.value = '';
    }
  };

  if (!currentUser) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading...</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button 
          onClick={() => router.back()} 
          className={styles.backButton}
        >
          ← Back
        </button>
        <h1 className={styles.title}>Create Story</h1>
      </div>

      <div className={styles.createForm}>
        <form onSubmit={handleSubmit}>
          {error && (
            <div className={styles.error}>
              {error}
            </div>
          )}

          {/* User Info */}
          <div className={styles.userInfo}>
            <div className={styles.avatar}>
              {currentUser.profilePicture ? (
                <img src={currentUser.profilePicture} alt={currentUser.username} />
              ) : (
                <div className={styles.defaultAvatar}>
                  {currentUser.username.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <span className={styles.username}>{currentUser.username}</span>
          </div>

          {/* Media Upload Section */}
          <div className={styles.mediaSection}>
            {!mediaPreview ? (
              <div className={styles.mediaUpload}>
                <input
                  type="file"
                  id="media-input"
                  accept="image/*,video/*"
                  onChange={handleMediaChange}
                  className={styles.fileInput}
                />
                <label htmlFor="media-input" className={styles.uploadLabel}>
                  <div className={styles.uploadIcon}>📷</div>
                  <p>Click to select photo or video</p>
                  <p className={styles.uploadHint}>
                    Photos: JPG, PNG up to 15MB<br />
                    Videos: MP4, MOV up to 100MB
                  </p>
                </label>
              </div>
            ) : (
              <div className={styles.mediaPreview}>
                {mediaType === 'video' ? (
                  <video
                    src={mediaPreview}
                    controls
                    className={styles.previewMedia}
                  />
                ) : (
                  <img
                    src={mediaPreview}
                    alt="Story preview"
                    className={styles.previewMedia}
                  />
                )}
                <button
                  type="button"
                  onClick={removeMedia}
                  className={styles.removeMediaButton}
                >
                  ✕
                </button>
              </div>
            )}
          </div>

          {/* Caption Section */}
          <div className={styles.inputGroup}>
            <label htmlFor="caption" className={styles.label}>
              Add text (Optional)
            </label>
            <textarea
              id="caption"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Add text to your story..."
              className={styles.textarea}
              rows={3}
              maxLength={500}
            />
            <div className={styles.charCount}>
              {caption.length}/500
            </div>
          </div>

          {/* Story Info */}
          <div className={styles.storyInfo}>
            <p className={styles.infoText}>
              Your story will be visible for 24 hours
            </p>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || !selectedMedia}
            className={styles.submitButton}
          >
            {loading ? 'Creating Story...' : 'Share to Story'}
          </button>
        </form>
      </div>
    </div>
  );
}
