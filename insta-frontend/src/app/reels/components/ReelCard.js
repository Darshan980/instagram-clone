import React from 'react';
import { Heart, MessageCircle, Share, Eye, Music } from 'lucide-react';
import styles from '../reels.module.css';

const formatCount = (count) => {
  if (count < 1000) return count.toString();
  if (count < 1000000) return (count / 1000).toFixed(1) + 'K';
  return (count / 1000000).toFixed(1) + 'M';
};

const getUserAvatar = (user, size = 40) => {
  if (user?.profilePicture) return user.profilePicture;
  const name = encodeURIComponent(user?.fullName || user?.username || 'User');
  return `https://ui-avatars.com/api/?name=${name}&size=${size}&background=0095f6&color=fff`;
};

const ReelCard = ({ reel, onLike, onComment, onShare, onView, isViewed }) => {
  const handleVideoClick = (e) => {
    const video = e.target;
    if (video.paused) {
      document.querySelectorAll('video').forEach(v => v !== video && v.pause());
      video.play();
      onView(reel._id);
    } else {
      video.pause();
    }
  };

  return (
    <div className={styles.reelCard} data-reel-id={reel._id}>
      <video 
        className={styles.video}
        src={reel.videoUrl}
        poster={reel.thumbnailUrl}
        muted
        loop
        playsInline
        preload="metadata"
        onClick={handleVideoClick}
      />

      <div className={styles.overlay}>
        <div className={styles.reelInfo}>
          <div className={styles.userInfo}>
            <img src={getUserAvatar(reel.user)} alt={reel.user?.username} />
            <span>{reel.user?.username || 'User'}</span>
          </div>

          {reel.caption && <p className={styles.caption}>{reel.caption}</p>}

          {reel.hashtags?.length > 0 && (
            <div className={styles.hashtags}>
              {reel.hashtags.map((tag, i) => (
                <span key={i}>{tag.startsWith('#') ? tag : `#${tag}`}</span>
              ))}
            </div>
          )}

          {reel.musicTrack && (
            <div className={styles.musicInfo}>
              <Music size={12} />
              <span>{reel.musicTrack.name} - {reel.musicTrack.artist}</span>
            </div>
          )}
        </div>

        <div className={styles.actions}>
          <button 
            onClick={() => onLike(reel._id)}
            className={reel.isLikedByUser ? styles.liked : ''}
          >
            <Heart size={24} fill={reel.isLikedByUser ? 'currentColor' : 'none'} />
            <span>{formatCount(reel.likesCount || 0)}</span>
          </button>

          <button onClick={() => onComment(reel._id)}>
            <MessageCircle size={24} />
            <span>{formatCount(reel.commentsCount || 0)}</span>
          </button>

          <button onClick={() => onShare(reel._id)}>
            <Share size={24} />
            <span>{formatCount(reel.shares || 0)}</span>
          </button>

          <button onClick={() => onView(reel._id)}>
            <Eye size={24} />
            <span>{formatCount(reel.viewsCount || 0)}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReelCard;
