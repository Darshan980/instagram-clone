// app/create/page.js
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isTokenValid, createPost } from '../../utils/auth';
import Layout from '../components/Layout'; // Adjust path as needed
import styles from './create.module.css';

export default function CreatePost() {
  const [formData, setFormData] = useState({
    caption: '',
    location: '',
    tags: ''
  });
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  useEffect(() => {
    if (!isTokenValid()) {
      router.push('/login');
    }
  }, [router]);

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    if (error) setError('');
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setError('Please select an image file');
        return;
      }

      // Validate file size (10MB limit)
      if (file.size > 10 * 1024 * 1024) {
        setError('Image size must be less than 10MB');
        return;
      }

      setSelectedImage(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target.result);
      };
      reader.readAsDataURL(file);
      
      if (error) setError('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!selectedImage) {
      setError('Please select an image');
      setLoading(false);
      return;
    }

    try {
      // Create FormData for file upload
      const postFormData = new FormData();
      postFormData.append('image', selectedImage);
      postFormData.append('caption', formData.caption);
      postFormData.append('location', formData.location);
      
      // Parse tags (split by comma and clean up)
      if (formData.tags) {
        const tagsArray = formData.tags
          .split(',')
          .map(tag => tag.trim())
          .filter(tag => tag.length > 0);
        postFormData.append('tags', JSON.stringify(tagsArray));
      }

      const result = await createPost(postFormData);

      if (result.success) {
        // Redirect to feed or post detail
        router.push('/feed');
      } else {
        setError(result.error);
      }
    } catch (error) {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const removeImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    // Reset file input
    const fileInput = document.getElementById('image-input');
    if (fileInput) {
      fileInput.value = '';
    }
  };

  return (
    <Layout>
      <div className={styles.container}>
        <div className={styles.header}>
          <button 
            onClick={() => router.back()} 
            className={styles.backButton}
          >
            ← Back
          </button>
          <h1 className={styles.title}>Create New Post</h1>
        </div>

        <div className={styles.createForm}>
          <form onSubmit={handleSubmit}>
            {error && (
              <div className={styles.error}>
                {error}
              </div>
            )}

            {/* Image Upload Section */}
            <div className={styles.imageSection}>
              {!imagePreview ? (
                <div className={styles.imageUpload}>
                  <input
                    type="file"
                    id="image-input"
                    accept="image/*"
                    onChange={handleImageChange}
                    className={styles.fileInput}
                  />
                  <label htmlFor="image-input" className={styles.uploadLabel}>
                    <div className={styles.uploadIcon}>📷</div>
                    <p>Click to select an image</p>
                    <p className={styles.uploadHint}>JPG, PNG, GIF up to 10MB</p>
                  </label>
                </div>
              ) : (
                <div className={styles.imagePreview}>
                  <img src={imagePreview} alt="Preview" className={styles.previewImage} />
                  <button
                    type="button"
                    onClick={removeImage}
                    className={styles.removeImageButton}
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>

            {/* Caption Section */}
            <div className={styles.inputGroup}>
              <label htmlFor="caption" className={styles.label}>
                Caption
              </label>
              <textarea
                id="caption"
                name="caption"
                value={formData.caption}
                onChange={handleInputChange}
                placeholder="Write a caption..."
                className={styles.textarea}
                rows={4}
                maxLength={2200}
              />
              <div className={styles.charCount}>
                {formData.caption.length}/2200
              </div>
            </div>

            {/* Location Section */}
            <div className={styles.inputGroup}>
              <label htmlFor="location" className={styles.label}>
                Location (Optional)
              </label>
              <input
                type="text"
                id="location"
                name="location"
                value={formData.location}
                onChange={handleInputChange}
                placeholder="Add location..."
                className={styles.input}
                maxLength={100}
              />
            </div>

            {/* Tags Section */}
            <div className={styles.inputGroup}>
              <label htmlFor="tags" className={styles.label}>
                Tags (Optional)
              </label>
              <input
                type="text"
                id="tags"
                name="tags"
                value={formData.tags}
                onChange={handleInputChange}
                placeholder="Add tags separated by commas (e.g., nature, sunset, photography)"
                className={styles.input}
              />
              <div className={styles.hint}>
                Separate tags with commas
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || !selectedImage}
              className={styles.submitButton}
            >
              {loading ? 'Creating Post...' : 'Share Post'}
            </button>
          </form>
        </div>
      </div>
    </Layout>
  );
}