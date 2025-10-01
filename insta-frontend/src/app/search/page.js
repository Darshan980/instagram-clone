'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { searchUsers, isTokenValid } from '../../utils/auth';
import Layout from '../components/Layout';
import styles from './search.module.css';

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  useEffect(() => {
    if (!isTokenValid()) {
      router.push('/login');
    }
  }, [router]);

  const search = useCallback(async (q) => {
    if (q.length < 2) {
      setResults([]);
      setError('');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      const result = await searchUsers(q, { limit: 15 });
      const users = result?.data?.data?.users || result?.data?.users || [];
      setResults(Array.isArray(users) ? users : []);
    } catch (err) {
      setError('Search failed. Please try again.');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => search(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query, search]);

  return (
    <Layout>
      <div className={styles.searchContainer}>
        <div className={styles.searchSection}>
          <div className={styles.searchInputContainer}>
            <div className={styles.searchIcon}>🔍</div>
            <input
              type="text"
              placeholder="Search for users..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className={styles.searchInput}
              autoFocus
            />
            {query && (
              <button onClick={() => setQuery('')} className={styles.clearButton}>✕</button>
            )}
          </div>
        </div>

        <div className={styles.resultsContainer}>
          {loading && (
            <div className={styles.loading}>
              <div className={styles.loadingSpinner}></div>
              <span>Searching...</span>
            </div>
          )}

          {error && <div className={styles.error}><span className={styles.errorIcon}>⚠️</span>{error}</div>}

          {!loading && !error && results.length > 0 && (
            <div className={styles.results}>
              <div className={styles.resultsHeader}>
                <h3>Search Results ({results.length})</h3>
              </div>
              <div className={styles.usersList}>
                {results.map((user) => user?._id && (
                  <Link key={user._id} href={`/profile/${user.username}`} className={styles.userItem}>
                    <div className={styles.userAvatar}>
                      <img
                        src={user.profilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.fullName || user.username)}&size=50&background=0095f6&color=fff`}
                        alt={user.fullName || user.username}
                        className={styles.avatarImage}
                      />
                    </div>
                    <div className={styles.userInfo}>
                      <div className={styles.username}>@{user.username}</div>
                      <div className={styles.fullName}>{user.fullName}</div>
                      {user.bio && <div className={styles.bio}>{user.bio.substring(0, 50)}{user.bio.length > 50 ? '...' : ''}</div>}
                    </div>
                    <div className={styles.followStatus}>
                      {user.isFollowing ? <span className={styles.followingBadge}>Following</span> : <span className={styles.arrow}>→</span>}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {!loading && !error && query.length >= 2 && results.length === 0 && (
            <div className={styles.noResults}>
              <div className={styles.noResultsIcon}>🔍</div>
              <h3>No users found</h3>
              <p>Try a different search term.</p>
            </div>
          )}

          {!query && !loading && (
            <div className={styles.searchPrompt}>
              <div className={styles.searchPromptIcon}>👥</div>
              <h3>Search for People</h3>
              <p>Find friends by searching usernames or names.</p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
