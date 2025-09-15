'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Upload, X, ArrowLeft, Video, Music, Hash, Type } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { isTokenValid, getCurrentUserProfile } from '../../utils/auth';
import styles from './CreateReel.module.css';

const CreateReel = () => {
  const router = useRouter();
  const [videoFile, setVideoFile] = useState(null);
  const [videoPreview, setVideoPreview] = useState(null);
  const [caption, setCaption] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [musicName, setMusicName] = useState('');
  const [musicArtist, setMusicArtist] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef(null);

  // Backend API base URL - FIXED: Remove the endpoint from base URL
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://instagram-clone-0t5v.onrender.com';

  useEffect(() => {
    if (!isTokenValid()) {
      router.push('/login');
      return;
    }
    
    fetchCurrentUser();
  }, [router]);

  const fetchCurrentUser = async () => {
    try {
      setLoading(true);
      const result = await getCurrentUserProfile();
      if (result.success) {
        setCurrentUser(result.data.user);
      } else {
        throw new Error('Failed to fetch user profile');
      }
    } catch (error) {
      console.error('Error fetching current user:', error);
      setError('Failed to load user profile. Please try again.');
      setTimeout(() => {
        router.push('/login');
      }, 2000);
    } finally {
      setLoading(false);
    }
  };

  const handleVideoSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setError('');
    setSuccess('');

    // Validate file type
    if (!file.type.startsWith('video/')) {
      setError('Please select a video file.');
      return;
    }

    // Validate file size (100MB)
    if (file.size > 100 * 1024 * 1024) {
      setError('Video file must be less than 100MB.');
      return;
    }

    const videoUrl = URL.createObjectURL(file);
    const video = document.createElement('video');
    
    video.onloadedmetadata = () => {
      // Check video duration (60 seconds max)
      if (video.duration > 60) {
        setError('Video must be less than 60 seconds.');
        setVideoFile(null);
        setVideoPreview(null);
        URL.revokeObjectURL(videoUrl);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        return;
      }
      
      setVideoFile(file);
      setVideoPreview(videoUrl);
    };

    video.onerror = () => {
      setError('Invalid video file. Please select a valid video.');
      URL.revokeObjectURL(videoUrl);
    };
    
    video.src = videoUrl;
  };

  const removeVideo = () => {
    if (videoPreview) {
      URL.revokeObjectURL(videoPreview);
    }
    setVideoFile(null);
    setVideoPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!videoFile) {
      setError('Please select a video file.');
      return;
    }

    setIsUploading(true);
    setError('');
    setSuccess('');

    try {
      // Get auth token - Check for instagram_token first
      let authToken = null;
      if (typeof window !== 'undefined') {
        authToken = localStorage.getItem('instagram_token') || 
                   localStorage.getItem('instagram-token') || 
                   localStorage.getItem('auth-token') || 
                   localStorage.getItem('token') ||
                   localStorage.getItem('jwt-token');
      }
      
      if (!authToken) {
        throw new Error('Authentication required. Please log in first.');
      }

      // Prepare form data
      const formData = new FormData();
      formData.append('video', videoFile); // Match the backend expectation
      formData.append('caption', caption.trim());
      
      // Process hashtags
      if (hashtags.trim()) {
        const hashtagsArray = hashtags.split(/\s+/)
          .map(tag => tag.replace('#', '').trim())
          .filter(tag => tag.length > 0)
          .map(tag => `#${tag}`); // Ensure hashtags start with #
        formData.append('hashtags', JSON.stringify(hashtagsArray));
      }

      // Process music track
      if (musicName.trim() && musicArtist.trim()) {
        formData.append('musicTrack', JSON.stringify({
          name: musicName.trim(),
          artist: musicArtist.trim()
        }));
      }

      console.log('Creating reel with API URL:', `${API_BASE_URL}/reels`);

      // Make API call to backend - FIXED: Use correct endpoint
      const response = await fetch(`${API_BASE_URL}/reels`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`
        },
        body: formData
      });

      console.log('Response status:', response.status);

      if (!response.ok) {
        let errorMessage = 'Failed to create reel';
        
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
          
          console.error('Backend error response:', errorData);
          
          if (errorData.code === 'NO_TOKEN' || errorData.code === 'INVALID_TOKEN') {
            throw new Error('Session expired. Please log in again.');
          } else if (errorData.code === 'NO_VIDEO_FILE') {
            throw new Error('Video file is required.');
          } else if (errorData.code === 'INVALID_FILE_TYPE') {
            throw new Error('Only video files are allowed.');
          } else if (errorData.code === 'FILE_TOO_LARGE') {
            throw new Error('Video file must be less than 100MB.');
          }
        } catch (jsonError) {
          console.error('Error parsing error response:', jsonError);
          
          if (response.status === 404) {
            errorMessage = 'Backend server not found. Make sure the server is running on port 5000.';
          } else if (response.status === 401) {
            errorMessage = 'Authentication failed. Please log in again.';
          } else if (response.status >= 500) {
            errorMessage = `Server error (${response.status}): ${response.statusText}`;
          } else if (response.status === 413) {
            errorMessage = 'File too large. Please select a smaller video file.';
          }
        }
        
        throw new Error(errorMessage);
      }

      const result = await response.json();
      console.log('Reel created successfully:', result);
      
      if (result.success) {
        setSuccess(result.warning ? 
          `Reel created successfully! Note: ${result.warning}` : 
          'Reel created successfully!'
        );
        
        // Reset form and redirect after success
        setTimeout(() => {
          resetForm();
          router.push('/reels');
        }, 2000);
      } else {
        throw new Error(result.message || 'Failed to create reel');
      }

    } catch (error) {
      console.error('Error creating reel:', error);
      setError(error.message || 'Failed to create reel. Please try again.');
      
      // Redirect to login if authentication error
      if (error.message.includes('log in') || 
          error.message.includes('Session expired') ||
          error.message.includes('Authentication')) {
        setTimeout(() => {
          router.push('/login');
        }, 3000);
      }
    } finally {
      setIsUploading(false);
    }
  };

  const resetForm = () => {
    // Clean up video preview URL
    if (videoPreview) {
      URL.revokeObjectURL(videoPreview);
    }
    
    setVideoFile(null);
    setVideoPreview(null);
    setCaption('');
    setHashtags('');
    setMusicName('');
    setMusicArtist('');
    setError('');
    setSuccess('');
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleBack = () => {
    // Clean up video preview URL before leaving
    if (videoPreview) {
      URL.revokeObjectURL(videoPreview);
    }
    router.push('/reels');
  };

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      if (videoPreview) {
        URL.revokeObjectURL(videoPreview);
      }
    };
  }, [videoPreview]);

  // Loading state
  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  // Error state if user not found
  if (!currentUser) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <p>Failed to load user profile. Please try again.</p>
          <button onClick={() => router.push('/login')} className={styles.submitButton}>
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Navigation */}
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.headerLeft}>
            <button 
              onClick={handleBack}
              className={styles.backButton}
              disabled={isUploading}
            >
              <ArrowLeft size={24} />
            </button>
            <h1 className={styles.title}>Create Reel</h1>
          </div>
          <button 
            onClick={handleBack}
            className={styles.closeButton}
            disabled={isUploading}
          >
            <X size={24} />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className={styles.main}>
        <div className={styles.formContainer}>
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
            <div className={styles.userDetails}>
              <span className={styles.username}>{currentUser.username}</span>
              <span className={styles.fullName}>{currentUser.fullName}</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className={styles.form}>
            
            {/* Video Upload Section */}
            <div className={styles.section}>
              <label className={styles.label}>
                <Video size={16} />
                Video <span className={styles.required}>*</span>
              </label>
              
              {!videoPreview ? (
                <div 
                  className={styles.uploadArea}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload size={32} className={styles.uploadIcon} />
                  <p className={styles.uploadText}>Choose video file</p>
                  <p className={styles.uploadSubtext}>
                    MP4, MOV, AVI up to 60 seconds and 100MB
                  </p>
                  <input 
                    ref={fileInputRef}
                    type="file"
                    accept="video/*"
                    onChange={handleVideoSelect}
                    className={styles.hiddenInput}
                    disabled={isUploading}
                  />
                </div>
              ) : (
                <div className={styles.videoPreview}>
                  <video 
                    src={videoPreview}
                    controls
                    className={styles.video}
                    muted
                    playsInline
                  />
                  <button 
                    type="button"
                    onClick={removeVideo}
                    className={styles.removeButton}
                    disabled={isUploading}
                  >
                    <X size={16} />
                  </button>
                </div>
              )}
            </div>

            {/* Caption */}
            <div className={styles.section}>
              <label className={styles.label}>
                <Type size={16} />
                Caption
              </label>
              <textarea 
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Write a caption for your reel..."
                className={styles.textarea}
                rows={3}
                maxLength={2200}
                disabled={isUploading}
              />
              <div className={styles.charCount}>
                {caption.length}/2200
              </div>
            </div>

            {/* Hashtags */}
            <div className={styles.section}>
              <label className={styles.label}>
                <Hash size={16} />
                Hashtags
              </label>
              <input 
                type="text"
                value={hashtags}
                onChange={(e) => setHashtags(e.target.value)}
                placeholder="#funny #dance #trending (separate with spaces)"
                className={styles.input}
                disabled={isUploading}
              />
              <p className={styles.inputHint}>
                Add hashtags to help people discover your reel
              </p>
            </div>

            {/* Music Track */}
            <div className={styles.section}>
              <label className={styles.label}>
                <Music size={16} />
                Music Track (Optional)
              </label>
              <div className={styles.musicInputs}>
                <input 
                  type="text"
                  value={musicName}
                  onChange={(e) => setMusicName(e.target.value)}
                  placeholder="Song name"
                  className={styles.input}
                  disabled={isUploading}
                />
                <input 
                  type="text"
                  value={musicArtist}
                  onChange={(e) => setMusicArtist(e.target.value)}
                  placeholder="Artist name"
                  className={styles.input}
                  disabled={isUploading}
                />
              </div>
            </div>

            {/* Error/Success Messages */}
            {error && (
              <div className={styles.errorMessage}>
                <X size={16} />
                {error}
              </div>
            )}

            {success && (
              <div className={styles.successMessage}>
                <Upload size={16} />
                {success}
              </div>
            )}

            {/* Submit Buttons */}
            <div className={styles.buttonGroup}>
              <button 
                type="button"
                onClick={handleBack}
                className={styles.cancelButton}
                disabled={isUploading}
              >
                Cancel
              </button>
              <button 
                type="submit"
                disabled={!videoFile || isUploading}
                className={styles.submitButton}
              >
                {isUploading ? (
                  <>
                    <div className={styles.spinner}></div>
                    Creating Reel...
                  </>
                ) : (
                  <>
                    <Upload size={16} />
                    Share Reel
                  </>
                )}
              </button>
            </div>

            {/* Reel Info */}
            <div className={styles.reelInfo}>
              <p className={styles.infoText}>
                Your reel will be visible to your followers and may appear on the Reels tab
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CreateReel;
