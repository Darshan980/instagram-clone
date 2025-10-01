// dashboard/components/PostCard.js
import { formatTimeAgo, isLikedByCurrentUser } from '../utils/helpers';
import styles from '../dashboard.module.css';

export default function PostCard({
  post, index, user, onImageClick, onLike, onAddComment,
  commentText, onCommentChange, isCommentLoading, isLikeLoading
}) {
  const isLiked = isLikedByCurrentUser(post, user);

  return (
    <article 
      className={styles.post}
      data-post-id={post._id}
      style={{ animationDelay: `${index * 0.1}s` }}
    >
      {/* Header */}
      <div className={styles.postHeader}>
        <div className={styles.userInfo}>
          <div className={styles.avatar}>
            {post.user?.profilePicture ? (
              <img src={post.user.profilePicture} alt={post.user.username} />
            ) : (
              <div className={styles.defaultAvatar}>
                {post.user?.username?.charAt(0).toUpperCase() || 'U'}
              </div>
            )}
          </div>
          <div className={styles.userDetails}>
            <span className={styles.username}>{post.user?.username || 'Unknown'}</span>
            {post.location && <span className={styles.location}>{post.location}</span>}
          </div>
        </div>
        <div className={styles.postTime}>{formatTimeAgo(post.createdAt)}</div>
      </div>

      {/* Image */}
      {post.imageUrl && (
        <div className={styles.postImage}>
          <img 
            src={post.imageUrl} 
            alt="Post" 
            onClick={(e) => onImageClick(post._id, e)}
            style={{ cursor: 'pointer' }}
          />
        </div>
      )}

      {/* Actions */}
      <div className={styles.postActions}>
        <div className={styles.actionButtons}>
          <button 
            onClick={() => onLike(post._id)}
            disabled={isLikeLoading}
            className={`${styles.actionButton} ${isLiked ? styles.liked : styles.notLiked}`}
          >
            <svg 
              className={styles.heartIcon}
              viewBox="0 0 24 24"
              fill={isLiked ? "#ed4956" : "none"}
              stroke={isLiked ? "#ed4956" : "#262626"}
              strokeWidth="2"
            >
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
          </button>
          <button onClick={() => document.querySelector(`input[data-post-id="${post._id}"]`)?.focus()} className={styles.actionButton}>
            <svg className={styles.commentIcon} viewBox="0 0 24 24">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Stats */}
      {post.likes?.length > 0 && (
        <div className={styles.postStats}>
          <div className={styles.likesCount}>
            <span>{post.likes.length}</span> {post.likes.length === 1 ? 'like' : 'likes'}
          </div>
        </div>
      )}

      {/* Caption */}
      {post.caption && (
        <div className={styles.postCaption}>
          <span className={styles.username}>{post.user?.username}</span>
          <span className={styles.captionText}>{post.caption}</span>
        </div>
      )}

      {/* Tags */}
      {post.tags?.length > 0 && (
        <div className={styles.postTags}>
          {post.tags.map((tag, i) => (
            <span key={i} className={styles.tag}>#{tag}</span>
          ))}
        </div>
      )}

      {/* Comments */}
      <div className={styles.commentsSection}>
        {post.comments?.length > 0 && (
          <div className={styles.comments}>
            {post.comments.slice(-2).map((comment, i) => (
              <div key={comment._id || i} className={styles.comment}>
                <span className={styles.commentUsername}>{comment.user?.username}</span>
                <span className={styles.commentText}>{comment.text}</span>
              </div>
            ))}
            {post.comments.length > 2 && (
              <button className={styles.viewAllComments} onClick={(e) => onImageClick(post._id, e)}>
                View all {post.comments.length} comments
              </button>
            )}
          </div>
        )}

        {/* Add Comment */}
        <div className={styles.addComment}>
          <input
            type="text"
            placeholder="Add a comment..."
            value={commentText}
            data-post-id={post._id}
            onChange={(e) => onCommentChange(post._id, e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && onAddComment(post._id)}
            maxLength={500}
          />
          <button
            onClick={() => onAddComment(post._id)}
            disabled={!commentText || isCommentLoading}
            className={styles.postCommentButton}
          >
            {isCommentLoading ? '...' : 'Post'}
          </button>
        </div>
      </div>
    </article>
  );
}
