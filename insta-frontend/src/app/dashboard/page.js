// dashboard/page.js
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '../components/layout/Sidebar';
import CreateSidebar from '../components/layout/CreateSidebar';
import RightSidebar from '../components/layout/RightSidebar';
import Feed from './components/Feed';
import { useDashboard } from './hooks/useDashboard';
import StoryViewer from '../../components/StoryViewer';
import PostModal from '../components/PostModal';
import { isTokenValid, getPost, getPostComments, toggleLikePost, addComment } from '../../utils/auth';
import styles from './dashboard.module.css'; // Original CSS file

export default function Dashboard() {
  // ... all your hooks and state ...

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

      <main className={styles.dashboardMain}>
        <div className={styles.mainContent}>
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
            visiblePosts={visiblePosts}
          />
        </div>
      </main>

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

      {/* Modals */}
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
        api={api}
      />
    </div>
  );
}
