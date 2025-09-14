// YourStoriesComponent.js - Complete frontend component
import React, { useState, useEffect } from 'react';
import StoryViewer from './StoryViewer';

// Transform function to flatten grouped stories from backend
const transformStoriesData = (apiResponse) => {
  const flattenedStories = [];
  
  if (apiResponse.stories) {
    apiResponse.stories.forEach(item => {
      // Backend returns grouped structure: { user: {...}, stories: [...] }
      if (item.user && item.stories && Array.isArray(item.stories)) {
        // Transform each story in the group
        item.stories.forEach(story => {
          flattenedStories.push({
            ...story,
            userId: item.user, // Assign user object to userId
            hasViewed: item.hasViewed || false
          });
        });
      } else {
        // Handle other structures (flat stories)
        flattenedStories.push(item);
      }
    });
  }
  
  // Sort by creation date (newest first)
  return flattenedStories.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
};

// Helper function to safely get user data
const getUserDisplayData = (story) => {
  const user = story.userId || {};
  return {
    username: user.username || 'Unknown User',
    fullName: user.fullName || 'Unknown User', 
    profilePicture: user.profilePicture || null,
    _id: user._id || null
  };
};

const YourStoriesComponent = () => {
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showViewer, setShowViewer] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Fetch stories from backend
  const fetchStories = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const token = localStorage.getItem('token');
      if (!token) {
        setError('No authentication token found');
        return;
      }

      console.log('🔄 Fetching stories from backend...');
      
      const response = await fetch('http://localhost:10000/api/stories', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('📥 Raw backend response:', data);
      
      // Transform grouped data to flat structure
      const transformedStories = transformStoriesData(data);
      console.log('✅ Transformed stories:', transformedStories);
      
      // Debug user data
      if (transformedStories.length > 0) {
        console.log('👤 First story user data:', {
          userId: transformedStories[0].userId,
          username: transformedStories[0].userId?.username,
          profilePicture: transformedStories[0].userId?.profilePicture
        });
      }
      
      setStories(transformedStories);
      
    } catch (err) {
      console.error('❌ Error fetching stories:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Load stories on component mount
  useEffect(() => {
    fetchStories();
  }, []);

  // Handle story click
  const handleStoryClick = (index) => {
    console.log('🎬 Opening story viewer at index:', index);
    setCurrentIndex(index);
    setShowViewer(true);
  };

  // Loading state
  if (loading) {
    return (
      <div className="stories-loading" style={{ padding: '20px', textAlign: 'center' }}>
        <div>Loading stories...</div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="stories-error" style={{ padding: '20px', textAlign: 'center' }}>
        <div>Error loading stories: {error}</div>
        <button onClick={fetchStories} style={{ marginTop: '10px' }}>
          Retry
        </button>
      </div>
    );
  }

  // No stories state
  if (stories.length === 0) {
    return (
      <div className="no-stories" style={{ padding: '20px', textAlign: 'center' }}>
        <div>No stories available</div>
        <button onClick={fetchStories} style={{ marginTop: '10px' }}>
          Refresh
        </button>
      </div>
    );
  }

  return (
    <div className="stories-container">
      {/* Stories Grid */}
      <div className="stories-grid" style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', 
        gap: '10px',
        padding: '20px'
      }}>
        {stories.map((story, index) => {
          const userDisplay = getUserDisplayData(story);
          
          return (
            <div 
              key={story._id} 
              className="story-item"
              onClick={() => handleStoryClick(index)}
              style={{ 
                cursor: 'pointer',
                border: '1px solid #ccc',
                borderRadius: '8px',
                padding: '10px',
                textAlign: 'center'
              }}
            >
              {/* Story Thumbnail */}
              <div className="story-thumbnail" style={{ marginBottom: '10px' }}>
                <img 
                  src={story.mediaUrl}
                  alt={story.caption || 'Story'}
                  style={{ 
                    width: '100%', 
                    height: '120px', 
                    objectFit: 'cover',
                    borderRadius: '8px'
                  }}
                />
              </div>
              
              {/* User Info */}
              <div className="story-user-info" style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px',
                justifyContent: 'center'
              }}>
                <img 
                  src={
                    userDisplay.profilePicture || 
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(
                      userDisplay.fullName
                    )}&size=30&background=0095f6&color=fff`
                  }
                  alt={userDisplay.username}
                  style={{
                    width: '30px',
                    height: '30px', 
                    borderRadius: '50%',
                    objectFit: 'cover'
                  }}
                />
                <span style={{ fontSize: '14px', fontWeight: '500' }}>
                  {userDisplay.username}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Story Viewer Modal */}
      {showViewer && (
        <StoryViewer
          stories={stories}
          currentIndex={currentIndex}
          onClose={() => {
            console.log('🔒 Closing story viewer');
            setShowViewer(false);
          }}
          onNext={(index) => {
            console.log('⏭️ Next story:', index);
            setCurrentIndex(index);
          }}
          onPrevious={(index) => {
            console.log('⏮️ Previous story:', index);
            setCurrentIndex(index);
          }}
        />
      )}

      {/* Debug Info (remove in production) */}
      <div style={{ 
        marginTop: '20px', 
        padding: '15px', 
        background: '#f8f9fa',
        borderRadius: '8px',
        fontSize: '14px'
      }}>
        <h4>Debug Info:</h4>
        <p><strong>Total stories:</strong> {stories.length}</p>
        <p><strong>Current index:</strong> {currentIndex}</p>
        <p><strong>Viewer open:</strong> {showViewer ? 'Yes' : 'No'}</p>
        {stories[currentIndex] && (
          <>
            <p><strong>Current story ID:</strong> {stories[currentIndex]._id}</p>
            <p><strong>Current story user:</strong> {stories[currentIndex].userId?.username || 'N/A'}</p>
            <p><strong>Profile picture:</strong> {stories[currentIndex].userId?.profilePicture ? 'Yes' : 'No'}</p>
          </>
        )}
      </div>
    </div>
  );
};

export default YourStoriesComponent;
