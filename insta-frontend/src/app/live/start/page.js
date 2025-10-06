'use client';
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import styles from './start.module.css';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:10000/api';

export default function StartLivePage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'general',
    isPrivate: false,
    allowComments: true
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [testingCamera, setTestingCamera] = useState(false);
  const [cameraStream, setCameraStream] = useState(null);
  const videoRef = React.useRef(null);

  const categories = [
    { value: 'general', label: '📱 General' },
    { value: 'gaming', label: '🎮 Gaming' },
    { value: 'music', label: '🎵 Music' },
    { value: 'sports', label: '⚽ Sports' },
    { value: 'education', label: '📚 Education' },
    { value: 'entertainment', label: '🎬 Entertainment' },
    { value: 'other', label: '🌟 Other' }
  ];

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  useEffect(() => {
    return () => {
      // Cleanup camera on unmount
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [cameraStream]);

  const testCamera = async () => {
    setTestingCamera(true);
    setError('');
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCameraStream(stream);
      }
    } catch (err) {
      console.error('Camera test error:', err);
      if (err.name === 'NotAllowedError') {
        setError('Camera access denied. Please allow camera permissions in your browser.');
      } else if (err.name === 'NotFoundError') {
        setError('No camera found on this device.');
      } else {
        setError('Failed to access camera: ' + err.message);
      }
      setTestingCamera(false);
    }
  };

  const stopCameraTest = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    }
    setTestingCamera(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Stop camera test if running
    if (cameraStream) {
      stopCameraTest();
    }
    
    if (!formData.title.trim()) {
      setError('Please enter a title for your stream');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('instagram_token');
      if (!token) {
        router.push('/login');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/live/start`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (data.success) {
        // Redirect to the live stream page
        router.push(`/live/${data.data.stream._id}`);
      } else {
        setError(data.error || 'Failed to start stream');
      }
    } catch (err) {
      console.error('Error starting stream:', err);
      setError('Failed to start live stream. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <div className={styles.header}>
          <button onClick={() => router.back()} className={styles.backButton}>
            ← Back
          </button>
          <h1>🔴 Start Live Stream</h1>
        </div>

        {error && (
          <div className={styles.error}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formGroup}>
            <label htmlFor="title">Stream Title *</label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="What's your stream about?"
              maxLength={100}
              required
              disabled={loading}
              className={styles.input}
            />
            <span className={styles.charCount}>{formData.title.length}/100</span>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Tell viewers what to expect..."
              maxLength={500}
              rows={4}
              disabled={loading}
              className={styles.textarea}
            />
            <span className={styles.charCount}>{formData.description.length}/500</span>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="category">Category</label>
            <select
              id="category"
              name="category"
              value={formData.category}
              onChange={handleChange}
              disabled={loading}
              className={styles.select}
            >
              {categories.map(cat => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.checkboxGroup}>
            <label className={styles.checkbox}>
              <input
                type="checkbox"
                name="isPrivate"
                checked={formData.isPrivate}
                onChange={handleChange}
                disabled={loading}
              />
              <span>Private Stream (Only followers can watch)</span>
            </label>

            <label className={styles.checkbox}>
              <input
                type="checkbox"
                name="allowComments"
                checked={formData.allowComments}
                onChange={handleChange}
                disabled={loading}
              />
              <span>Allow Comments</span>
            </label>
          </div>

          <div className={styles.infoBox}>
            <h3>📌 Before you go live:</h3>
            <ul>
              <li>Make sure you have a stable internet connection</li>
              <li>Check your camera and microphone permissions</li>
              <li>Choose a well-lit location</li>
              <li>Be respectful and follow community guidelines</li>
            </ul>
            
            <div className={styles.cameraTest}>
              {!testingCamera && !cameraStream ? (
                <button
                  type="button"
                  onClick={testCamera}
                  className={styles.testCameraButton}
                  disabled={loading}
                >
                  📹 Test Camera
                </button>
              ) : (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className={styles.testVideo}
                  />
                  <button
                    type="button"
                    onClick={stopCameraTest}
                    className={styles.stopTestButton}
                  >
                    Stop Test
                  </button>
                </>
              )}
            </div>
          </div>

          <div className={styles.actions}>
            <button
              type="button"
              onClick={() => router.back()}
              className={styles.cancelButton}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={styles.submitButton}
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className={styles.spinner}></span>
                  Starting...
                </>
              ) : (
                <>
                  🔴 Go Live
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
