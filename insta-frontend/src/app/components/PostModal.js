import React, { useState, useEffect } from 'react';
import { X, Heart, MessageCircle, Send, MoreHorizontal, User } from 'lucide-react';
import styles from './PostModal.module.css';

const PostModal = ({ postId, isOpen, onClose, api, onPostUpdate, initialPost }) => {
  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentsUpdateTrigger, setCommentsUpdateTrigger] = useState(0);
  const [loading, setLoading] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasInitialized, setHasInitialized] = useState(false);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  useEffect(() => {
    if (isOpen && postId) {
      // Reset state when opening modal
      setError('');
      setHasInitialized(false);
      
      // Use initial post data if available, otherwise fetch
      if (initialPost && initialPost._id === postId) {
        setPost(initialPost);
        setIsLiked(initialPost.isLiked || false);
        setLikesCount(initialPost.likesCount || 0);
        setHasInitialized(true);
        fetchComments();
      } else {
        fetchPostData();
      }
    } else if (!isOpen) {
      // Reset state when closing modal
      setPost(null);
      setComments([]);
      setNewComment('');
      setError('');
      setHasInitialized(false);
      setLoading(false);
      setCommentsLoading(false);
      setIsSubmittingComment(false);
    }
  }, [isOpen, postId]);

  const fetchPostData = async () => {
    if (hasInitialized) return; // Don't fetch if we already have data
    
    setLoading(true);
    setError('');
    
    try {
      // Fetch post data
      const postResult = await api.getPost(postId);
      
      if (postResult.success) {
        const postData = postResult.data?.post || postResult.post;
        setPost(postData);
        setIsLiked(postData.isLiked || false);
        setLikesCount(postData.likesCount || 0);
        setHasInitialized(true);
        
        // Fetch comments
        fetchComments();
      } else {
        setError(postResult.error || 'Failed to load post');
      }
    } catch (error) {
      console.error('Error fetching post data:', error);
      setError('Failed to load post');
    } finally {
      setLoading(false);
    }
  };

  const fetchComments = async () => {
    setCommentsLoading(true);
    try {
      const commentsResult = await api.getPostComments(postId, 1, 50);
      
      if (commentsResult.success) {
        const commentsData = commentsResult.comments || commentsResult.data?.comments || [];
        // Filter out comments with missing user data and add safety checks
        const validComments = commentsData.filter(comment => 
          comment && 
          comment._id && 
          typeof comment._id === 'string' &&
          !comment._id.startsWith('temp_') // Exclude any temp comments
        );
        setComments(validComments);
      }
    } catch (error) {
      console.error('Error fetching comments:', error);
    } finally {
      setCommentsLoading(false);
    }
  };

  const handleLike = async () => {
    // Store current values for potential revert
    const currentIsLiked = isLiked;
    const currentLikesCount = likesCount;
    
    // Calculate new values
    const newIsLiked = !currentIsLiked;
    const newLikesCount = newIsLiked ? currentLikesCount + 1 : Math.max(0, currentLikesCount - 1);
    
    // Optimistic update
    setIsLiked(newIsLiked);
    setLikesCount(newLikesCount);

    try {
      const result = await api.toggleLikePost(postId);
      
      if (result.success) {
        // Use server response if available, otherwise keep optimistic update
        const serverIsLiked = result.data?.isLiked !== undefined ? result.data.isLiked : newIsLiked;
        const serverLikesCount = result.data?.likesCount !== undefined ? result.data.likesCount : newLikesCount;
        
        setIsLiked(serverIsLiked);
        setLikesCount(serverLikesCount);
        
        // Update post object
        setPost(prev => prev ? {
          ...prev,
          isLiked: serverIsLiked,
          likesCount: serverLikesCount
        } : prev);
        
        // Notify parent component about the update
        if (onPostUpdate) {
          onPostUpdate(postId, {
            isLiked: serverIsLiked,
            likesCount: serverLikesCount
          });
        }
      } else {
        // Revert on failure
        setIsLiked(currentIsLiked);
        setLikesCount(currentLikesCount);
        console.error('Failed to toggle like:', result.error);
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      // Revert on error
      setIsLiked(currentIsLiked);
      setLikesCount(currentLikesCount);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || isSubmittingComment) return;

    const commentText = newComment.trim();
    setIsSubmittingComment(true);
    
    try {
      console.log('Adding comment:', commentText);
      const result = await api.addComment(postId, commentText);
      console.log('Full comment result:', result);
      
      if (result.success) {
        // Try multiple possible locations for the comment data
        const newCommentData = result.data?.comment || result.comment || result.data || result;
        console.log('Extracted comment data:', newCommentData);
        
        // If we still don't have proper comment data, create one manually
        let formattedComment;
        
        if (newCommentData && newCommentData._id) {
          // Use server data if available
          formattedComment = {
            _id: newCommentData._id,
            text: newCommentData.text || commentText,
            user: newCommentData.user || {
              username: 'You',
              profilePicture: ''
            },
            createdAt: newCommentData.createdAt || new Date().toISOString(),
            ...newCommentData
          };
        } else if (result.success) {
          // Create a temporary comment if server response is successful but missing data
          console.log('Creating fallback comment due to missing server data');
          formattedComment = {
            _id: `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, // Unique temp ID
            text: commentText,
            user: {
              username: 'You',
              profilePicture: ''
            },
            createdAt: new Date().toISOString()
          };
        }
        
        if (formattedComment) {
          console.log('Final formatted comment:', formattedComment);
          
          // Force state update by creating a new array
          setComments(prevComments => {
            const newComments = [formattedComment, ...prevComments];
            console.log('Updated comments array:', newComments);
            console.log('New comments length:', newComments.length);
            return newComments;
          });
          
          // Force component re-render
          setCommentsUpdateTrigger(prev => prev + 1);
          
          // Clear input only after successful addition
          setNewComment('');
          
          // Update post comments count
          setPost(prev => {
            if (!prev) return prev;
            const updatedPost = {
              ...prev,
              commentsCount: (prev.commentsCount || 0) + 1
            };
            console.log('Updated post:', updatedPost);
            return updatedPost;
          });
          
          // Notify parent component about the update
          if (onPostUpdate) {
            onPostUpdate(postId, {
              commentsCount: (post?.commentsCount || 0) + 1
            });
          }
          
          console.log('Comment addition completed successfully');
        } else {
          console.error('Could not create comment from server response');
          // Don't clear the input so user can try again
        }
      } else {
        console.error('Server returned failure:', result.error);
        // Keep comment text on failure so user can try again
      }
    } catch (error) {
      console.error('Error adding comment:', error);
      // Keep comment text on error so user can try again
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAddComment();
    }
  };

  const formatTimeAgo = (dateString) => {
    if (!dateString) return 'unknown';
    
    try {
      const now = new Date();
      const date = new Date(dateString);
      const diffInSeconds = Math.floor((now - date) / 1000);

      if (diffInSeconds < 60) return 'now';
      if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`;
      if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`;
      if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d`;
      return new Date(date).toLocaleDateString();
    } catch (error) {
      return 'unknown';
    }
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const getImageUrl = (post) => {
    return post?.imageUrl || post?.media?.[0]?.url || null;
  };

  const getUserInfo = (user) => {
    if (!user) {
      return {
        username: 'Unknown User',
        fullName: 'Unknown User',
        profilePicture: ''
      };
    }
    return {
      username: user.username || 'Unknown User',
      fullName: user.fullName || user.username || 'Unknown User',
      profilePicture: user.profilePicture || ''
    };
  };

  const renderAvatar = (user, size = 'small') => {
    const userInfo = getUserInfo(user);
    const avatarClass = size === 'large' ? styles.avatarLarge : styles.avatar;
    const fallbackClass = size === 'large' ? styles.avatarFallbackLarge : styles.avatarFallback;
    
    return (
      <>
        {userInfo.profilePicture ? (
          <img
            src={userInfo.profilePicture}
            alt={userInfo.username}
            className={avatarClass}
            onError={(e) => {
              e.target.style.display = 'none';
              e.target.nextSibling.style.display = 'flex';
            }}
          />
        ) : null}
        <div 
          className={fallbackClass}
          style={userInfo.profilePicture ? { display: 'none' } : {}}
        >
          <User size={size === 'large' ? 20 : 16} className={styles.avatarIcon} />
        </div>
      </>
    );
  };

  if (!isOpen) return null;

  return (
    <div 
      className={styles.modal}
      onClick={handleBackdropClick}
    >
      <div className={styles.modalContent}>
        {/* Close button */}
        <button
          onClick={onClose}
          className={styles.closeButton}
        >
          <X size={20} />
        </button>

        {loading ? (
          <div className={styles.loading}>
            <div className={styles.loadingSpinner}></div>
          </div>
        ) : error ? (
          <div className={styles.error}>
            <div className={styles.errorText}>{error}</div>
            <button 
              onClick={fetchPostData}
              className={styles.retryButton}
            >
              Try Again
            </button>
          </div>
        ) : post ? (
          <>
            {/* Left side - Post image */}
            <div className={styles.imageSection}>
              {getImageUrl(post) ? (
                <img
                  src={getImageUrl(post)}
                  alt="Post"
                  className={styles.postImage}
                />
              ) : (
                <div className={styles.noImageContainer}>
                  <User size={64} className={styles.noImageIcon} />
                  <p className={styles.noImageText}>No image available</p>
                  <p className={styles.noImageSubtext}>
                    This post was created without an image
                  </p>
                </div>
              )}
            </div>

            {/* Right side - Comments and interactions */}
            <div className={styles.sidebar}>
              {/* Post header */}
              <div className={styles.postHeader}>
                <div className={styles.userInfo}>
                  {renderAvatar(post.user, 'large')}
                  <div className={styles.userDetails}>
                    <h3 className={styles.username}>{getUserInfo(post.user).username}</h3>
                    <div className={styles.timestamp}>{formatTimeAgo(post.createdAt)}</div>
                  </div>
                </div>
                <button className={styles.moreButton}>
                  <MoreHorizontal size={20} />
                </button>
              </div>

              {/* Post caption */}
              {post.caption && (
                <div className={styles.captionSection}>
                  <div className={styles.captionContent}>
                    {renderAvatar(post.user, 'small')}
                    <div className={styles.captionText}>
                      <span className={styles.captionUsername}>{getUserInfo(post.user).username}</span>
                      <span className={styles.captionMessage}>{post.caption}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Comments section */}
              <div className={styles.commentsSection} key={`comments-${comments.length}-${commentsUpdateTrigger}`}>
                {commentsLoading ? (
                  <div className={styles.commentsLoading}>
                    <div className={styles.loadingSpinner}></div>
                  </div>
                ) : comments.length === 0 ? (
                  <div className={styles.emptyComments}>
                    <MessageCircle size={48} className={styles.emptyIcon} />
                    <p>No comments yet</p>
                    <p className={styles.emptySubtext}>Be the first to comment!</p>
                  </div>
                ) : (
                  <div className={styles.commentsList}>
                    {comments.map((comment, index) => {
                      // Add extra safety checks
                      if (!comment || !comment._id || typeof comment._id !== 'string') {
                        console.warn('Invalid comment at index', index, comment);
                        return null;
                      }
                      
                      const commentUser = getUserInfo(comment.user);
                      
                      return (
                        <div key={`${comment._id}-${index}`} className={styles.comment}>
                          {renderAvatar(comment.user, 'small')}
                          <div className={styles.commentBody}>
                            <div className={styles.commentHeader}>
                              <span className={styles.commentUsername}>{commentUser.username}</span>
                              <span className={styles.commentTime}>{formatTimeAgo(comment.createdAt)}</span>
                            </div>
                            <p className={styles.commentText}>{comment.text || 'Comment text not available'}</p>
                          </div>
                        </div>
                      );
                    }).filter(Boolean)} {/* Remove any null returns */}
                  </div>
                )}
              </div>

              {/* Like and interaction section */}
              <div className={styles.interactionSection}>
                <div className={styles.actionButtons}>
                  <div className={styles.actionGroup}>
                    <button
                      onClick={handleLike}
                      className={`${styles.actionButton} ${isLiked ? styles.liked : ''}`}
                    >
                      <Heart size={24} fill={isLiked ? 'currentColor' : 'none'} />
                    </button>
                    <button className={styles.actionButton}>
                      <MessageCircle size={24} />
                    </button>
                  </div>
                </div>
                
                <div className={styles.likesCount}>
                  {likesCount || 0} {likesCount === 1 ? 'like' : 'likes'}
                </div>

                {/* Add comment input */}
                <div className={styles.commentForm}>
                  <input
                    type="text"
                    placeholder="Add a comment..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    onKeyPress={handleKeyPress}
                    className={styles.commentInput}
                    maxLength={500}
                    disabled={isSubmittingComment}
                  />
                  <button
                    onClick={handleAddComment}
                    disabled={!newComment.trim() || isSubmittingComment}
                    className={styles.submitButton}
                  >
                    {isSubmittingComment ? 'Posting...' : 'Post'}
                  </button>
                </div>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
};

export default PostModal;