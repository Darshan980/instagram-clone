'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getExplorePosts, isTokenValid } from '../../utils/auth';
import Layout from '../components/Layout';
import styles from './explore.module.css';

export default function ExplorePage() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!isTokenValid()) {
      router.push('/login');
      return;
    }

    fetchExplorePosts();
  }, [router]);

  const fetchExplorePosts = async (pageNum = 1, append = false) => {
    try {
      if (!append) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
      setError('');

      const result = await getExplorePosts(pageNum, 20);
      
      if (result.success) {
        const newPosts = result.data.posts;
        
        if (append) {
          setPosts(prev => [...prev, ...newPosts]);
        } else {
          setPosts(newPosts);
        }
        
        setHasMore(result.data.pagination.hasNextPage);
        setPage(pageNum);
      } else {
        setError(result.error);
      }
    } catch (error) {
      setError('Failed to load explore posts');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadMore = () => {
    if (!loadingMore && hasMore) {
      fetchExplorePosts(page + 1, true);
    }
  };

  const formatEngagementCount = (likes, comments) => {
    const total = likes + comments;
    if (total >= 1000000) {
      return (total / 1000000).toFixed(1) + 'M';
    } else if (total >= 1000) {
      return (total / 1000).toFixed(1) + 'K';
    }
    return total.toString();
  };

  if (loading) {
    return (
      <Layout>
        <div className={styles.loading}>
          <div className={styles.loadingSpinner}></div>
          <span>Loading explore posts...</span>
        </div>
      </Layout>
    );
  }

  if (error && posts.length === 0) {
    return (
      <Layout>
        <div className={styles.error}>
          <span className={styles.errorIcon}>⚠️</span>
          {error}
          <button onClick={() => fetchExplorePosts()} className={styles.retryButton}>
            Try Again
          </button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className={styles.exploreContainer}>
        {/* Explore Content */}
        <div className={styles.exploreSection}>
          <div className={styles.exploreHeader}>
            <h1>Explore</h1>
            <p>Discover trending posts and popular content</p>
          </div>

          {posts.length === 0 ? (
            <div className={styles.noPosts}>
              <div className={styles.noPostsIcon}>🔍</div>
              <h3>No posts to explore yet</h3>
              <p>Check back later for trending content!</p>
            </div>
          ) : (
            <>
              <div className={styles.postsGrid}>
                {posts.map((post, index) => (
                  <div key={post._id} className={styles.postItem}>
                    <div className={styles.postImageContainer}>
                      <img
                        src={post.imageUrl}
                        alt={post.caption || 'Post'}
                        className={styles.postImage}
                        loading={index < 6 ? 'eager' : 'lazy'}
                      />
                      <div className={styles.postOverlay}>
                        <div className={styles.postStats}>
                          <div className={styles.postStat}>
                            <span className={styles.statIcon}>❤️</span>
                            <span className={styles.statCount}>
                              {formatEngagementCount(post.likesCount || 0, 0)}
                            </span>
                          </div>
                          <div className={styles.postStat}>
                            <span className={styles.statIcon}>💬</span>
                            <span className={styles.statCount}>
                              {formatEngagementCount(post.commentsCount || 0, 0)}
                            </span>
                          </div>
                        </div>
                        <div className={styles.postUser}>
                          <img
                            src={post.user.profilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(post.user.fullName)}&size=24&background=0095f6&color=fff`}
                            alt={post.user.fullName}
                            className={styles.userAvatar}
                          />
                          <span className={styles.username}>@{post.user.username}</span>
                        </div>
                      </div>
                    </div>
                    {post.caption && (
                      <div className={styles.postCaption}>
                        {post.caption.length > 60 
                          ? `${post.caption.substring(0, 60)}...` 
                          : post.caption
                        }
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Load More Button */}
              {hasMore && (
                <div className={styles.loadMoreContainer}>
                  <button
                    onClick={loadMore}
                    disabled={loadingMore}
                    className={styles.loadMoreButton}
                  >
                    {loadingMore ? (
                      <>
                        <div className={styles.loadingSpinner}></div>
                        Loading more...
                      </>
                    ) : (
                      'Load More Posts'
                    )}
                  </button>
                </div>
              )}

              {!hasMore && posts.length > 0 && (
                <div className={styles.endMessage}>
                  <p>You've seen all the trending posts! 🎉</p>
                  <Link href="/dashboard" className={styles.backToFeedButton}>
                    Back to Home
                  </Link>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}