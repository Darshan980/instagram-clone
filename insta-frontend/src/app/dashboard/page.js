// dashboard/page.js (Main Component - Simplified)
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '../components/layout/Sidebar';
import CreateSidebar from '../components/layout/CreateSidebar';
import Feed from './components/Feed';
import { useDashboard } from './hooks/useDashboard';
import StoryViewer from '../../components/StoryViewer';
import PostModal from '../components/PostModal';
import { isTokenValid } from '../../utils/auth';
import useDashboard from './hooks/useDashboard';
import styles from './dashboard.module.css';

export default function Dashboard() {
  const router = useRouter();
  const [showCreateSidebar, setShowCreateSidebar] = useState(false);
  const [showStoryViewer, setShowStoryViewer] = useState(false);
  const [selectedStories, setSelectedStories] = useState([]);
  const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
  const [isPostModalOpen, setIsPostModalOpen] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState(null);

  const {
    user,
    posts,
    loading,
    postsLoading,
    error,
    suggestions,
    suggestionsLoading,
    suggestionsError,
    followingStates,
    showAllSuggestions,
    setShowAllSuggestions,
    handleLogout,
    handleLike,
    handleAddComment,
    handleFollow,
    handleDismiss,
    loadSuggestions,
    loadMorePosts,
    hasMore,
    loadingMore,
    commentTexts,
    handleCommentChange,
    commentLoading,
    likeLoading,
    setPosts
  } = useDashboard();

  useEffect(() => {
    if (!isTokenValid()) {
      router.push('/login');
    }
  }, [router]);

  const handleStoryClick = (storyGroup) => {
    setSelectedStories(storyGroup.stories);
    setCurrentStoryIndex(0);
    setShowStoryViewer(true);
  };

  const handlePostImageClick = (postId, e) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedPostId(postId);
    setIsPostModalOpen(true);
  };

  const handleModalPostUpdate = (updatedPostData) => {
    setPosts(prevPosts => 
      prevPosts.map(post => 
        post._id === updatedPostData.postId 
          ? { ...post, ...updatedPostData }
          : post
      )
    );
  };

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner}></div>
        <p>Loading your feed...</p>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className={styles.container}>
      <Sidebar
        user={user}
        onLogout={handleLogout}
        onCreateClick={() => setShowCreateSidebar(true)}
        showCreateActive={showCreateSidebar}
      />

      {showCreateSidebar && (
        <CreateSidebar
          onClose={() => setShowCreateSidebar(false)}
          onOptionClick={(path) => {
            router.push(path);
            setShowCreateSidebar(false);
          }}
        />
      )}

      <Feed
        posts={posts}
        postsLoading={postsLoading}
        error={error}
        user={user}
        onStoryClick={handleStoryClick}
        onPostImageClick={handlePostImageClick}
        onLike={handleLike}
        onAddComment={handleAddComment}
        commentTexts={commentTexts}
        onCommentChange={handleCommentChange}
        commentLoading={commentLoading}
        likeLoading={likeLoading}
        hasMore={hasMore}
        loadingMore={loadingMore}
        onLoadMore={loadMorePosts}
      />

      <RightSidebar
        user={user}
        suggestions={suggestions}
        suggestionsLoading={suggestionsLoading}
        suggestionsError={suggestionsError}
        followingStates={followingStates}
        showAllSuggestions={showAllSuggestions}
        onToggleShowAll={() => setShowAllSuggestions(!showAllSuggestions)}
        onRefresh={() => loadSuggestions(true)}
        onFollow={handleFollow}
        onDismiss={handleDismiss}
      />

      {showStoryViewer && (
        <StoryViewer
          stories={selectedStories}
          currentIndex={currentStoryIndex}
          onClose={() => setShowStoryViewer(false)}
          onNext={setCurrentStoryIndex}
          onPrevious={setCurrentStoryIndex}
        />
      )}

      <PostModal
        postId={selectedPostId}
        isOpen={isPostModalOpen}
        onClose={() => setIsPostModalOpen(false)}
        onUpdate={handleModalPostUpdate}
      />
    </div>
  );
}
