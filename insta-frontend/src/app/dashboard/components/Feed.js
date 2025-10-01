// dashboard/components/Feed.js
import Link from 'next/link';
import StoriesBar from '../../../components/StoriesBar';
import PostCard from './PostCard';
import styles from '../dashboard.module.css';

export default function Feed({
  posts, postsLoading, error, user, onStoryClick, onPostImageClick,
  onLike, onAddComment, commentTexts, onCommentChange,
  commentLoading, likeLoading, hasMore, loadingMore, onLoadMore
}) {
  if (postsLoading) {
    return (
      <main className={styles.main}>
        <div className={styles.feedLoading}>
          <div className={styles.loadingSpinner}></div>
          <span>Loading posts...</span>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.main}>
      <div className={styles.mainContent}>
        <div className={styles.storiesSection}>
          <StoriesBar onStoryClick={onStoryClick} />
        </div>

        {error && (
          <div className={styles.error}>
            <span>⚠️</span>
            {error}
          </div>
        )}

        <div className={styles.feedContainer}>
          {posts.length === 0 ? (
            <div className={styles.emptyFeed}>
              <div className={styles.emptyIcon}>📷</div>
              <h3>No posts yet</h3>
              <p>Start following people or create your first post!</p>
              <Link href="/create" className={styles.createFirstPost}>
                Create Your First Post
              </Link>
            </div>
          ) : (
            <div className={styles.postsContainer}>
              {posts.map((post, index) => (
                post?._id && (
                  <PostCard
                    key={post._id}
                    post={post}
                    index={index}
                    user={user}
                    onImageClick={onPostImageClick}
                    onLike={onLike}
                    onAddComment={onAddComment}
                    commentText={commentTexts[post._id] || ''}
                    onCommentChange={onCommentChange}
                    isCommentLoading={commentLoading[post._id]}
                    isLikeLoading={likeLoading[post._id]}
                  />
                )
              ))}

              {hasMore && (
                <div className={styles.loadMoreContainer}>
                  <button
                    onClick={onLoadMore}
                    disabled={loadingMore}
                    className={styles.loadMoreButton}
                  >
                    {loadingMore ? (
                      <>
                        <span className={`${styles.loadingSpinner} ${styles.small}`}></span>
                        <span>Loading...</span>
                      </>
                    ) : (
                      <>
                        <span>Load More Posts</span>
                        <span className={styles.loadMoreIcon}>↓</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
