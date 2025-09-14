'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { searchUsers, isTokenValid } from '../../utils/auth';
import Layout from '../components/Layout';
import styles from './search.module.css';

export default function SearchPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [searchMeta, setSearchMeta] = useState({});
  const router = useRouter();

  useEffect(() => {
    if (!isTokenValid()) {
      router.push('/login');
      return;
    }
  }, [router]);

  // FIXED: Enhanced debounced search function with corrected data extraction
  const debouncedSearch = useCallback(
    debounce(async (query) => {
      if (!query || query.trim().length < 2) {
        setSearchResults([]);
        setHasSearched(false);
        setError('');
        setSearchMeta({});
        return;
      }

      setLoading(true);
      setError('');
      
      try {
        console.log('Frontend: Starting search for:', query.trim());
        const result = await searchUsers(query.trim(), { limit: 15 });
        
        console.log('Frontend: Complete search result:', JSON.stringify(result, null, 2));

        if (result && result.success) {
          // FIXED: Handle the nested response structure properly
          let users = [];
          let metadata = {};

          // The API returns: { success: true, data: { success: true, data: { users: [...] } } }
          // We need to extract from the inner data object
          const responseData = result.data?.data || result.data || {};
          
          users = responseData.users || [];
          metadata = {
            pagination: responseData.pagination || {},
            searchType: responseData.searchType || 'search',
            query: responseData.query || query
          };

          // Ensure users is always an array
          if (!Array.isArray(users)) {
            console.warn('Frontend: Users is not an array, converting:', users);
            users = users ? [users] : [];
          }
          
          console.log('Frontend: Final extracted users:', users);
          console.log('Frontend: Users count:', users.length);
          
          setSearchResults(users);
          setSearchMeta(metadata);
          setHasSearched(true);
          
        } else {
          // Handle API errors gracefully
          const errorMessage = result?.error || result?.data?.error || 'Failed to search users';
          console.error('Frontend: Search error:', errorMessage);
          setError(errorMessage);
          setSearchResults([]);
          setSearchMeta({});
          setHasSearched(true);
        }
      } catch (searchError) {
        console.error('Frontend: Search exception:', searchError);
        setError('Failed to search users. Please try again.');
        setSearchResults([]);
        setSearchMeta({});
        setHasSearched(true);
      } finally {
        setLoading(false);
      }
    }, 300),
    []
  );

  useEffect(() => {
    debouncedSearch(searchQuery);
  }, [searchQuery, debouncedSearch]);

  const handleSearchChange = (e) => {
    const value = e.target.value;
    console.log('Frontend: Search input changed to:', value);
    setSearchQuery(value);
    
    // Clear results immediately if input is too short
    if (value.trim().length < 2) {
      setSearchResults([]);
      setHasSearched(false);
      setError('');
      setSearchMeta({});
    }
  };

  const clearSearch = () => {
    console.log('Frontend: Clearing search');
    setSearchQuery('');
    setSearchResults([]);
    setHasSearched(false);
    setError('');
    setSearchMeta({});
  };

  // Safe array length check
  const resultsCount = Array.isArray(searchResults) ? searchResults.length : 0;

  return (
    <Layout>
      <div className={styles.searchContainer}>
        {/* Search Section */}
        <div className={styles.searchSection}>
          <div className={styles.searchInputContainer}>
            <div className={styles.searchIcon}>🔍</div>
            <input
              type="text"
              placeholder="Search for users..."
              value={searchQuery}
              onChange={handleSearchChange}
              className={styles.searchInput}
              autoFocus
            />
            {searchQuery && (
              <button onClick={clearSearch} className={styles.clearButton}>
                ✕
              </button>
            )}
          </div>
          
          {/* Debug info - remove in production */}
          {process.env.NODE_ENV === 'development' && (
            <div style={{ 
              fontSize: '12px', 
              color: '#666', 
              marginTop: '10px',
              padding: '8px',
              backgroundColor: '#f5f5f5',
              borderRadius: '4px'
            }}>
              Debug: Query={`"${searchQuery}"`} | Results={resultsCount} | HasSearched={hasSearched.toString()} | Loading={loading.toString()} | SearchType={searchMeta.searchType || 'none'}
            </div>
          )}
        </div>

        {/* Search Results */}
        <div className={styles.resultsContainer}>
          {loading && (
            <div className={styles.loading}>
              <div className={styles.loadingSpinner}></div>
              <span>Searching...</span>
            </div>
          )}

          {error && (
            <div className={styles.error}>
              <span className={styles.errorIcon}>⚠️</span>
              {error}
            </div>
          )}

          {!loading && !error && resultsCount > 0 && (
            <div className={styles.results}>
              <div className={styles.resultsHeader}>
                <h3>
                  {searchMeta.searchType === 'suggestions' ? 'Suggested Users' : 'Search Results'} ({resultsCount})
                </h3>
                {searchMeta.searchType === 'suggestions' && (
                  <p style={{ fontSize: '14px', color: '#666', margin: '5px 0 0 0' }}>
                    {`Showing suggestions for "${searchQuery}"`}
                  </p>
                )}
              </div>
              <div className={styles.usersList}>
                {searchResults.map((user) => {
                  // Add safety check for each user object
                  if (!user || !user._id) {
                    console.warn('Frontend: Invalid user object:', user);
                    return null;
                  }
                  
                  return (
                    <Link 
                      key={user._id} 
                      href={`/profile/${user.username}`}
                      className={styles.userItem}
                    >
                      <div className={styles.userAvatar}>
                        <img
                          src={user.profilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.fullName || user.username)}&size=50&background=0095f6&color=fff`}
                          alt={user.fullName || user.username}
                          className={styles.avatarImage}
                          onError={(e) => {
                            e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.username || 'User')}&size=50&background=0095f6&color=fff`;
                          }}
                        />
                      </div>
                      <div className={styles.userInfo}>
                        <div className={styles.username}>@{user.username || 'unknown'}</div>
                        <div className={styles.fullName}>{user.fullName || ''}</div>
                        {user.bio && (
                          <div className={styles.bio}>
                            {user.bio.substring(0, 50)}{user.bio.length > 50 ? '...' : ''}
                          </div>
                        )}
                        {user.suggestionReason && (
                          <div style={{ fontSize: '12px', color: '#999', marginTop: '2px' }}>
                            {user.suggestionReason}
                          </div>
                        )}
                      </div>
                      <div className={styles.followStatus}>
                        {user.isFollowing ? (
                          <span className={styles.followingBadge}>Following</span>
                        ) : (
                          <span className={styles.arrow}>→</span>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {!loading && !error && hasSearched && resultsCount === 0 && searchQuery.trim().length >= 2 && (
            <div className={styles.noResults}>
              <div className={styles.noResultsIcon}>🔍</div>
              <h3>No users found</h3>
              <p>Try searching for a different username or name.</p>
              <div className={styles.searchSuggestions}>
                <h4>Search Tips:</h4>
                <ul>
                  <li>Check your spelling</li>
                  <li>Try different keywords</li>
                  <li>Search for partial names</li>
                  <li>Try single letters for suggestions</li>
                </ul>
              </div>
            </div>
          )}

          {!hasSearched && !loading && (
            <div className={styles.searchPrompt}>
              <div className={styles.searchPromptIcon}>👥</div>
              <h3>Search for People</h3>
              <p>Find friends and discover new accounts by searching for usernames or names.</p>
              <div className={styles.searchTips}>
                <h4>Search Tips:</h4>
                <ul>
                  <li>Type at least 2 characters to start searching</li>
                  <li>Search by username or full name</li>
                  <li>Results update as you type</li>
                  <li>Single letters show user suggestions</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

// Debounce utility function
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}
