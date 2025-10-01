'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getExplorePosts, isTokenValid } from '../../utils/auth';
import Layout from '../components/Layout';
import styles from './explore.module.css';

export default function ExplorePage() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (!isTokenValid()) {
      router.push('/login');
      return;
    }
    fetchPosts();
  }, [router]);

  const fetchPosts = async (pageNum = 1, append = false) => {
    setLoading(true);
    setError('');

    try {
      const result = await getExplorePosts(pageNum, 20);
      if (result.success) {
        const newPosts = result.data.posts;
        setPosts(prev => append ? [...prev, ...newPosts] : newPosts);
        setHasMore(result.data.pagination.hasNextPage);
        setPage(pageNum);
      } else {
        setError(result.error);
      }
    } catch {
      setError('Failed to load posts');
    } finally {
      setLoading(false);
    }
  };

  const formatCount = (likes, comments) => {
    const n = likes + comments;
    return n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1000 ? (n / 1000).toFixed(1) + 'K' : n;
  };

  if (error && posts.length === 0) {
    return (
      <Layout>
        <div className={styles.error}>
          <span className={styles.errorIcon}>⚠️</span>
          {error}
          <button onClick={() => fetchPosts()} className={styles.retryButton}>Try Again</button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className={styles.exploreContainer}>
        <div className={styles.exploreHeader}>
          <h1>Explore</h1>
          <p>Discover trending posts and popular content</p>
        </div>

        {posts.length === 0 && !loading ? (
          <div className={styles.noPosts}>
            <div className={styles.noPostsIcon}>🔍</div>
            <h3>No posts to explore yet</h3>
            <p>Check back later for trending content!</p>
          </div>
        ) : (
          <>
            <div className={styles.postsGrid}>
              {posts.map((post, i) => (
                <div key={post._id} className={styles.postItem}>
                  <div className={styles.postImageContainer}>
                    <img
                      src={post.imageUrl}
                      alt={post.caption || 'Post'}
                      className={styles.postImage}
                      loading={i < 6 ? 'eager' : 'lazy'}
                    />
                    <div className={styles.postOverlay}>
                      <div className={styles.postStats}>
                        <div className={styles.postStat}>
                          <span className={styles.statIcon}>❤️</span>
                          <span>{formatCount(post.likesCount || 0, 0)}</span>
                        </div>
                        <div className={styles.postStat}>
                          <span className={styles.statIcon}>💬</span>
                          <span>{formatCount(post.commentsCount || 0, 0)}</span>
                        </div>
                      </div>
                      <div className={styles.postUser}>
                        <img
                          src={post.user.profilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(post.user.fullName)}&size=24&background=0095f6&color=fff`}
                          alt={post.user.fullName}
                          className={styles.userAvatar}
                        />
                        <span>@{post.user.username}</span>
                      </div>
                    </div>
                  </div>
                  {post.caption && (
                    <div className={styles.postCaption}>
                      {post.caption.length > 60 ? `${post.caption.substring(0, 60)}...` : post.caption}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {hasMore ? (
              <div className={styles.loadMoreContainer}>
                <button onClick={() => fetchPosts(page + 1, true)} disabled={loading} className={styles.loadMoreButton}>
                  {loading ? (
                    <>
                      <div className={styles.loadingSpinner}></div>
                      Loading...
                    </>
                  ) : 'Load More'}
                </button>
              </div>
            ) : posts.length > 0 && (
              <div className={styles.endMessage}>
                <p>You&apos;ve seen all the trending posts! 🎉</p>
                <Link href="/dashboard" className={styles.backButton}>Back to Home</Link>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
