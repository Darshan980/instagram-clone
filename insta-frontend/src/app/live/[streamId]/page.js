'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import styles from './stream.module.css';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:10000/api';

export default function LiveStreamPage() {
  const router = useRouter();
  const params = useParams();
  const streamId = params.streamId;
  
  const [stream, setStream] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [sendingComment, setSendingComment] = useState(false);
  const [hasLiked, setHasLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [isStreaming, setIsStreaming] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const commentsEndRef = useRef(null);

  useEffect(() => {
    if (streamId) {
      fetchStream();
      joinStream();
      
      // Poll for updates every 5 seconds
      const interval = setInterval(() => {
        fetchStream();
      }, 5000);

      return () => {
        clearInterval(interval);
        leaveStream();
        stopCamera();
      };
    }
  }, [streamId]);

  useEffect(() => {
    if (stream && stream.isOwner && stream.status === 'live') {
      startCamera();
    }
  }, [stream]);

  useEffect(() => {
    scrollToBottom();
  }, [comments]);

  const scrollToBottom = () => {
    commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchStream = async () => {
    try {
      const token = localStorage.getItem('instagram_token');
      if (!token) {
        router.push('/login');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/live/${streamId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (data.success) {
        setStream(data.data.stream);
        setComments(data.data.stream.comments || []);
        setHasLiked(data.data.stream.hasLiked);
        setLikeCount(data.data.stream.likeCount);
      } else {
        setError(data.error || 'Failed to load stream');
      }
    } catch (err) {
      console.error('Error fetching stream:', err);
      setError('Failed to load live stream');
    } finally {
      setLoading(false);
    }
  };

  const joinStream = async () => {
    try {
      const token = localStorage.getItem('instagram_token');
      await fetch(`${API_BASE_URL}/live/${streamId}/join`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
    } catch (err) {
      console.error('Error joining stream:', err);
    }
  };

  const leaveStream = async () => {
    try {
      const token = localStorage.getItem('instagram_token');
      await fetch(`${API_BASE_URL}/live/${streamId}/leave`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
    } catch (err) {
      console.error('Error leaving stream:', err);
    }
  };

  const startCamera = async () => {
    try {
      setCameraError('');
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        },
        audio: true
      });

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        streamRef.current = mediaStream;
        setIsStreaming(true);
      }
    } catch (err) {
      console.error('Error accessing camera:', err);
      if (err.name === 'NotAllowedError') {
        setCameraError('Camera access denied. Please allow camera permissions.');
      } else if (err.name === 'NotFoundError') {
        setCameraError('No camera found on this device.');
      } else {
        setCameraError('Failed to access camera. Please check your device settings.');
      }
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
      setIsStreaming(false);
    }
  };

  const handleLike = async () => {
    try {
      const token = localStorage.getItem('instagram_token');
      const response = await fetch(`${API_BASE_URL}/live/${streamId}/like`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      if (data.success) {
        setHasLiked(data.data.hasLiked);
        setLikeCount(data.data.likeCount);
      }
    } catch (err) {
      console.error('Error liking stream:', err);
    }
  };

  const handleSendComment = async (e) => {
    e.preventDefault();
    
    if (!newComment.trim() || sendingComment) return;

    setSendingComment(true);

    try {
      const token = localStorage.getItem('instagram_token');
      const response = await fetch(`${API_BASE_URL}/live/${streamId}/comment`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ text: newComment.trim() })
      });

      const data = await response.json();
      if (data.success) {
        setComments(prev => [...prev, data.data.comment]);
        setNewComment('');
      }
    } catch (err) {
      console.error('Error sending comment:', err);
    } finally {
      setSendingComment(false);
    }
  };

  const handleEndStream = async () => {
    if (!confirm('Are you sure you want to end this live stream?')) return;

    try {
      const token = localStorage.getItem('instagram_token');
      const response = await fetch(`${API_BASE_URL}/live/${streamId}/end`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      if (data.success) {
        alert('Stream ended successfully!');
        router.push('/live');
      }
    } catch (err) {
      console.error('Error ending stream:', err);
      alert('Failed to end stream');
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <p>Loading stream...</p>
        </div>
      </div>
    );
  }

  if (error || !stream) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <h2>Stream Not Available</h2>
          <p>{error || 'This stream could not be found'}</p>
          <button onClick={() => router.push('/live')} className={styles.backButton}>
            Back to Live Streams
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.streamContainer}>
        {/* Video Player Area */}
        <div className={styles.videoArea}>
          {stream.isOwner && stream.status === 'live' ? (
            <>
              {isStreaming ? (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={styles.liveVideo}
                />
              ) : (
                <div className={styles.videoPlaceholder}>
                  <div className={styles.placeholderContent}>
                    <img 
                      src={stream.user.profilePicture || '/default-avatar.png'}
                      alt={stream.user.username}
                      className={styles.streamerAvatar}
                      onError={(e) => { e.target.src = '/default-avatar.png'; }}
                    />
                    <div className={styles.liveBadge}>
                      <span className={styles.liveDot}>●</span>
                      LIVE
                    </div>
                    {cameraError ? (
                      <>
                        <p className={styles.errorText}>⚠️ {cameraError}</p>
                        <button onClick={startCamera} className={styles.retryButton}>
                          Try Again
                        </button>
                      </>
                    ) : (
                      <>
                        <p className={styles.placeholderText}>
                          📹 Starting camera...
                        </p>
                        <div className={styles.loadingSpinner}></div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className={styles.videoPlaceholder}>
              <div className={styles.placeholderContent}>
                <img 
                  src={stream.user.profilePicture || '/default-avatar.png'}
                  alt={stream.user.username}
                  className={styles.streamerAvatar}
                  onError={(e) => { e.target.src = '/default-avatar.png'; }}
                />
                <div className={styles.liveBadge}>
                  <span className={styles.liveDot}>●</span>
                  LIVE
                </div>
                <p className={styles.placeholderText}>
                  📹 Watching {stream.user.username}&apos;s live stream
                </p>
                <p className={styles.placeholderSubtext}>
                  (Viewer mode - Camera streaming from broadcaster)
                </p>
              </div>
            </div>
          )}

          {/* Stream Info Overlay */}
          <div className={styles.streamOverlay}>
            <div className={styles.overlayTop}>
              <button onClick={() => router.back()} className={styles.closeButton}>
                ✕
              </button>
              <div className={styles.viewerCount}>
                👁️ {stream.currentViewerCount} watching
              </div>
            </div>

            <div className={styles.overlayBottom}>
              <div className={styles.streamerInfo}>
                <img 
                  src={stream.user.profilePicture || '/default-avatar.png'}
                  alt={stream.user.username}
                  className={styles.streamerThumb}
                  onError={(e) => { e.target.src = '/default-avatar.png'; }}
                />
                <div>
                  <h3>{stream.user.fullName}</h3>
                  <p>@{stream.user.username}</p>
                </div>
              </div>

              <div className={styles.streamActions}>
                <button 
                  onClick={handleLike} 
                  className={`${styles.actionButton} ${hasLiked ? styles.liked : ''}`}
                >
                  {hasLiked ? '❤️' : '🤍'} {likeCount}
                </button>
                
                {stream.isOwner && (
                  <button onClick={handleEndStream} className={styles.endButton}>
                    End Stream
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Chat/Comments Sidebar */}
        <div className={styles.chatSidebar}>
          <div className={styles.chatHeader}>
            <h3>💬 Live Chat</h3>
            <span className={styles.commentCount}>{comments.length}</span>
          </div>

          <div className={styles.streamDetails}>
            <h2>{stream.title}</h2>
            {stream.description && (
              <p className={styles.description}>{stream.description}</p>
            )}
            <div className={styles.stats}>
              <span>👁️ {stream.totalViews} views</span>
              <span>❤️ {likeCount} likes</span>
            </div>
          </div>

          <div className={styles.commentsArea}>
            {comments.length === 0 ? (
              <div className={styles.noComments}>
                <p>No comments yet</p>
                <p>Be the first to comment!</p>
              </div>
            ) : (
              <div className={styles.commentsList}>
                {comments.map((comment, index) => (
                  <div key={index} className={styles.comment}>
                    <img 
                      src={comment.user.profilePicture || '/default-avatar.png'}
                      alt={comment.user.username}
                      className={styles.commentAvatar}
                      onError={(e) => { e.target.src = '/default-avatar.png'; }}
                    />
                    <div className={styles.commentContent}>
                      <div className={styles.commentHeader}>
                        <span className={styles.commentUser}>
                          {comment.user.username}
                        </span>
                        <span className={styles.commentTime}>
                          {new Date(comment.createdAt).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className={styles.commentText}>{comment.text}</p>
                    </div>
                  </div>
                ))}
                <div ref={commentsEndRef} />
              </div>
            )}
          </div>

          {stream.allowComments && (
            <form onSubmit={handleSendComment} className={styles.commentForm}>
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add a comment..."
                maxLength={500}
                disabled={sendingComment}
                className={styles.commentInput}
              />
              <button 
                type="submit" 
                disabled={!newComment.trim() || sendingComment}
                className={styles.sendButton}
              >
                {sendingComment ? '...' : '➤'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
