import React, { useState } from 'react';
import styles from '../reels.module.css';

const formatTime = (dateString) => {
  const diffInSeconds = Math.floor((new Date() - new Date(dateString)) / 1000);
  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  return `${Math.floor(diffInSeconds / 86400)}d ago`;
};

const getUserAvatar = (user) => {
  if (user?.profilePicture) return user.profilePicture;
  const name = encodeURIComponent(user?.fullName || user?.username || 'User');
  return `https://ui-avatars.com/api/?name=${name}&size=40&background=0095f6&color=fff`;
};

const CommentsModal = ({ reel, currentUser, onClose, onAddComment }) => {
  const [commentText, setCommentText] = useState('');

  const handleSubmit = () => {
    if (commentText.trim()) {
      onAddComment(commentText.trim());
      setCommentText('');
    }
  };

  return (
    <div className={styles.modal} onClick={onClose}>
      <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3>Comments ({reel.comments?.length || 0})</h3>
          <button onClick={onClose}>×</button>
        </div>

        <div className={styles.commentsList}>
          {reel.comments?.length === 0 ? (
            <p className={styles.emptyComments}>No comments yet. Be the first!</p>
          ) : (
            reel.comments?.map(comment => (
              <div key={comment._id} className={styles.comment}>
                <img src={getUserAvatar(comment.user)} alt={comment.user?.username} />
                <div>
                  <div className={styles.commentHeader}>
                    <span>{comment.user?.username || 'User'}</span>
                    <span>{formatTime(comment.createdAt)}</span>
                  </div>
                  <p>{comment.text}</p>
                </div>
              </div>
            ))
          )}
        </div>

        <div className={styles.commentInput}>
          <img src={getUserAvatar(currentUser)} alt="You" />
          <input 
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Add a comment..."
            onKeyPress={(e) => e.key === 'Enter' && handleSubmit()}
            maxLength={500}
          />
          <button onClick={handleSubmit} disabled={!commentText.trim()}>
            Post
          </button>
        </div>
      </div>
    </div>
  );
};

export default CommentsModal;
