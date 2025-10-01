// dashboard/utils/helpers.js (Helper Functions)

export const formatTimeAgo = (dateString) => {
  try {
    const now = new Date();
    const postDate = new Date(dateString);
    const diffInSeconds = Math.floor((now - postDate) / 1000);

    if (diffInSeconds < 60) return 'just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d`;
    return `${Math.floor(diffInSeconds / 604800)}w`;
  } catch {
    return 'recently';
  }
};

export const isLikedByCurrentUser = (post, user) => {
  if (!user || !post?.likes || !Array.isArray(post.likes)) return false;
  
  if (typeof post.isLikedByUser === 'boolean') return post.isLikedByUser;
  
  const currentUserId = user._id || user.id;
  if (!currentUserId) return false;
  
  return post.likes.some(like => {
    const likeUserId = typeof like === 'object' ? (like._id || like.user || like.userId) : like;
    return likeUserId?.toString() === currentUserId?.toString();
  });
};

export const formatFollowerCount = (count) => {
  if (!count || count === 0) return '0';
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
  return count.toString();
};

export const getProfileImageSrc = (user) => {
  if (user.profilePicture && user.profilePicture.startsWith('http')) {
    return user.profilePicture;
  }
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(user.fullName || user.username)}&background=e5e7eb&color=6b7280&size=96`;
};
