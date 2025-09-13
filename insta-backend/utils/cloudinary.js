const cloudinary = require('cloudinary').v2;
const sharp = require('sharp');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Check if Cloudinary is properly configured
 * @returns {boolean} True if all required config values are present
 */
const isCloudinaryConfigured = () => {
  return !!(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
};

/**
 * Create a placeholder image URL for development
 * @param {number} width - Image width (default: 400)
 * @param {number} height - Image height (default: 400)
 * @returns {string} Placeholder image URL
 */
const createPlaceholderImageUrl = (width = 400, height = 400) => {
  return `https://via.placeholder.com/${width}x${height}/cccccc/ffffff?text=Image+Placeholder`;
};

/**
 * Create a placeholder URL for different content types
 * @param {string} type - Content type ('image', 'video', etc.)
 * @param {string} message - Custom message for placeholder
 * @param {number} width - Width (default: 400)
 * @param {number} height - Height (default: 400)
 * @returns {string} Placeholder URL
 */
const createPlaceholderUrl = (type = 'image', message = 'Placeholder', width = 400, height = 400) => {
  const encodedMessage = encodeURIComponent(message);
  return `https://via.placeholder.com/${width}x${height}/cccccc/ffffff?text=${encodedMessage}`;
};

/**
 * Check if file is a video based on mimetype
 * @param {string} mimetype - File mimetype
 * @returns {boolean} True if file is a video
 */
const isVideoFile = (mimetype) => {
  return mimetype && mimetype.startsWith('video/');
};

/**
 * Optimize image buffer before upload
 * @param {Buffer} buffer - Image buffer
 * @param {Object} options - Optimization options
 * @returns {Promise<Buffer>} Optimized image buffer
 */
const optimizeImage = async (buffer, options = {}) => {
  const {
    width = 1080,
    height = 1080,
    quality = 85,
    format = 'jpeg'
  } = options;

  try {
    return await sharp(buffer)
      .resize(width, height, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({ quality })
      .toBuffer();
  } catch (error) {
    console.error('Image optimization error:', error);
    return buffer; // Return original buffer if optimization fails
  }
};

/**
 * Upload file (image or video) to Cloudinary
 * @param {Buffer} buffer - File buffer
 * @param {string} folder - Cloudinary folder path
 * @param {Object} options - Upload options
 * @returns {Promise<Object>} Cloudinary upload result
 */
const uploadToCloudinary = async (buffer, folder = 'instagram-clone', options = {}) => {
  if (!isCloudinaryConfigured()) {
    throw new Error('Cloudinary is not properly configured');
  }

  const {
    width = 1080,
    height = 1080,
    quality = 85,
    resourceType = 'auto', // Let Cloudinary detect the type
    transformation = [],
    mimetype = null
  } = options;

  try {
    // Check if it's a video file
    const isVideo = mimetype && isVideoFile(mimetype);
    
    let processedBuffer = buffer;
    
    // Only optimize if it's an image
    if (!isVideo && resourceType === 'image') {
      processedBuffer = await optimizeImage(buffer, { width, height, quality });
    }

    return new Promise((resolve, reject) => {
      const uploadOptions = {
        folder,
        resource_type: resourceType,
        quality: 'auto:good',
        fetch_format: 'auto'
      };

      // Add transformations only for images
      if (!isVideo && resourceType === 'image') {
        uploadOptions.transformation = [
          {
            width,
            height,
            crop: 'limit',
            quality: 'auto:good'
          },
          ...transformation
        ];
      } else if (isVideo || resourceType === 'video') {
        // Video-specific options
        uploadOptions.transformation = [
          {
            quality: 'auto:good',
            fetch_format: 'auto'
          },
          ...transformation
        ];
      }

      const uploadStream = cloudinary.uploader.upload_stream(
        uploadOptions,
        (error, result) => {
          if (error) {
            console.error('Cloudinary upload error:', error);
            reject(error);
          } else {
            resolve(result);
          }
        }
      );

      uploadStream.end(processedBuffer);
    });
  } catch (error) {
    console.error('Upload to Cloudinary error:', error);
    throw error;
  }
};

/**
 * Delete image from Cloudinary
 * @param {string} publicId - Cloudinary public ID
 * @param {string} resourceType - Resource type (image, video, etc.)
 * @returns {Promise<Object>} Cloudinary deletion result
 */
const deleteFromCloudinary = async (publicId, resourceType = 'image') => {
  if (!isCloudinaryConfigured()) {
    throw new Error('Cloudinary is not properly configured');
  }

  try {
    return await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType
    });
  } catch (error) {
    console.error('Delete from Cloudinary error:', error);
    throw error;
  }
};

/**
 * Get Cloudinary image URL with transformations
 * @param {string} publicId - Cloudinary public ID
 * @param {Object} transformations - Image transformations
 * @returns {string} Transformed image URL
 */
const getTransformedImageUrl = (publicId, transformations = {}) => {
  if (!isCloudinaryConfigured() || !publicId) {
    return createPlaceholderImageUrl();
  }

  const {
    width = 400,
    height = 400,
    crop = 'fill',
    quality = 'auto:good',
    format = 'auto'
  } = transformations;

  return cloudinary.url(publicId, {
    width,
    height,
    crop,
    quality,
    fetch_format: format
  });
};

/**
 * Upload multiple files to Cloudinary
 * @param {Array<{buffer: Buffer, mimetype?: string}>} files - Array of file objects
 * @param {string} folder - Cloudinary folder path
 * @param {Object} options - Upload options
 * @returns {Promise<Array<Object>>} Array of Cloudinary upload results
 */
const uploadMultipleToCloudinary = async (files, folder = 'instagram-clone', options = {}) => {
  try {
    const uploadPromises = files.map(file => 
      uploadToCloudinary(file.buffer, folder, { 
        ...options, 
        mimetype: file.mimetype 
      })
    );

    return await Promise.all(uploadPromises);
  } catch (error) {
    console.error('Multiple upload to Cloudinary error:', error);
    throw error;
  }
};

/**
 * Generate video thumbnail from video buffer
 * @param {Buffer} videoBuffer - Video buffer
 * @returns {Promise<Buffer>} Thumbnail image buffer
 */
const generateVideoThumbnail = async (videoBuffer) => {
  try {
    // This would require ffmpeg integration
    // For now, return a placeholder
    console.log('Video thumbnail generation not implemented');
    return null;
  } catch (error) {
    console.error('Video thumbnail generation error:', error);
    return null;
  }
};

/**
 * Upload video to Cloudinary (dedicated video upload function)
 * @param {Buffer} buffer - Video buffer
 * @param {string} folder - Cloudinary folder path
 * @param {Object} options - Upload options
 * @returns {Promise<Object>} Cloudinary upload result
 */
const uploadVideoToCloudinary = async (buffer, folder = 'instagram-clone/videos', options = {}) => {
  if (!isCloudinaryConfigured()) {
    throw new Error('Cloudinary is not properly configured');
  }

  const {
    quality = 'auto:good',
    transformation = []
  } = options;

  try {
    return new Promise((resolve, reject) => {
      const uploadOptions = {
        folder,
        resource_type: 'video',
        quality,
        transformation: [
          {
            quality: 'auto:good',
            fetch_format: 'auto'
          },
          ...transformation
        ]
      };

      const uploadStream = cloudinary.uploader.upload_stream(
        uploadOptions,
        (error, result) => {
          if (error) {
            console.error('Cloudinary video upload error:', error);
            reject(error);
          } else {
            resolve(result);
          }
        }
      );

      uploadStream.end(buffer);
    });
  } catch (error) {
    console.error('Upload video to Cloudinary error:', error);
    throw error;
  }
};

module.exports = {
  cloudinary,
  isCloudinaryConfigured,
  createPlaceholderImageUrl,
  createPlaceholderUrl,
  isVideoFile,
  optimizeImage,
  uploadToCloudinary,
  deleteFromCloudinary,
  getTransformedImageUrl,
  uploadMultipleToCloudinary,
  generateVideoThumbnail,
  uploadVideoToCloudinary
};