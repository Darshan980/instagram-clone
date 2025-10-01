// dashboard/components/RightSidebar.js
import Link from 'next/link';
import { RefreshCw, UserPlus, X, Users, Search } from 'lucide-react';
import { getProfileImageSrc, formatFollowerCount } from '../utils/helpers';
import styles from '../dashboard.module.css';

export default function RightSidebar({
  user, suggestions, suggestionsLoading, suggestionsError,
  followingStates, showAllSuggestions, onToggleShowAll,
  onRefresh, onFollow, onDismiss
}) {
  const displaySuggestions = showAllSuggestions ? suggestions : suggestions.slice(0, 5);

  return (
    <aside className={styles.rightSidebar}>
      <div className={styles.rightSidebarContent}>
        {/* Current User */}
        <div className={styles.currentUserInfo}>
          <div className={styles.userCard}>
            <div className={styles.userAvatar}>
              {user?.profilePicture ? (
                <img src={user.profilePicture} alt={user.username} />
              ) : (
                <div className={styles.defaultUserAvatar}>
                  {user?.username?.charAt(0).toUpperCase() || 'U'}
                </div>
              )}
            </div>
            <div className={styles.userCardInfo}>
              <span className={styles.currentUsername}>{user?.username}</span>
              <span className={styles.currentUserFullName}>{user?.fullName || user?.name}</span>
            </div>
            <Link href={`/profile/${user?.username}`} className={styles.switchLink}>
              Switch
            </Link>
          </div>
        </div>

        {/* Suggestions */}
        <div className={styles.followSuggestionsSection}>
          <div className={styles.suggestionsHeader}>
            <span className={styles.suggestionsTitle}>Suggestions For You</span>
            {suggestions.length > 5 && (
              <button onClick={onToggleShowAll} className={styles.seeAllButton}>
                {showAllSuggestions ? 'Show Less' : 'See All'}
              </button>
            )}
            <button
              onClick={onRefresh}
              disabled={suggestionsLoading}
              className={styles.refreshSuggestionsButton}
            >
              <RefreshCw className={suggestionsLoading ? styles.spinning : ''} size={14} />
            </button>
          </div>

          {suggestionsLoading && suggestions.length === 0 ? (
            <div className={styles.suggestionsLoading}>
              {[...Array(3)].map((_, i) => (
                <div key={i} className={styles.suggestionItemSkeleton}>
                  <div className={styles.skeletonAvatar}></div>
                  <div className={styles.skeletonInfo}>
                    <div className={styles.skeletonUsername}></div>
                    <div className={styles.skeletonSubtext}></div>
                  </div>
                </div>
              ))}
            </div>
          ) : suggestionsError ? (
            <div className={styles.suggestionsError}>
              <Users size={20} />
              <p>Failed to load suggestions</p>
              <button onClick={onRefresh} className={styles.retryButton}>
                Try again
              </button>
            </div>
          ) : displaySuggestions.length === 0 ? (
            <div className={styles.noSuggestions}>
              <Search size={24} />
              <p>No suggestions available</p>
            </div>
          ) : (
            <div className={styles.suggestionsList}>
              {displaySuggestions.map((suggestion) => {
                const isFollowing = followingStates[suggestion._id];
                const isPending = isFollowing === 'pending';

                return (
                  <div key={suggestion._id} className={styles.suggestionItem}>
                    <div className={styles.suggestionAvatar}>
                      <img src={getProfileImageSrc(suggestion)} alt={suggestion.username} />
                      {suggestion.daysSinceJoined <= 30 && (
                        <div className={styles.newBadge}>!</div>
                      )}
                    </div>
                    
                    <div className={styles.suggestionInfo}>
                      <span className={styles.suggestionUsername}>{suggestion.username}</span>
                      <span className={styles.suggestionFullName}>{suggestion.fullName}</span>
                      <span className={styles.suggestionSubtext}>
                        {formatFollowerCount(suggestion.followersCount || 0)} followers
                      </span>
                    </div>
                    
                    <div className={styles.suggestionActions}>
                      {!isFollowing && (
                        <button
                          onClick={() => onFollow(suggestion._id)}
                          disabled={isPending}
                          className={styles.followButton}
                        >
                          <UserPlus size={12} />
                          <span>{isPending ? 'Following...' : 'Follow'}</span>
                        </button>
                      )}
                      {isFollowing === true && (
                        <div className={styles.followingButton}>Following</div>
                      )}
                      <button
                        onClick={() => onDismiss(suggestion._id)}
                        className={styles.dismissButton}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={styles.sidebarFooter}>
          <div className={styles.footerLinks}>
            <Link href="/about">About</Link>
            <Link href="/help">Help</Link>
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
          </div>
          <div className={styles.copyright}>© 2024 InstaApp clone</div>
        </div>
      </div>
    </aside>
  );
}
