/**
 * localStorage utilities for tracking user interactions
 *
 * Stores:
 * - Clicked episodes (which episode tiles have been clicked)
 * - Viewed tracklists (which tracklists have been loaded)
 * - Played tracks (which Spotify links have been clicked)
 */

const STORAGE_KEYS = {
  VIEWED_TRACKLISTS: 'nts_viewed_tracklists',
  PLAYED_TRACKS: 'nts_played_tracks',
  LIKED_EPISODES: 'nts_liked_episodes',
  LIKED_TRACKS: 'nts_liked_tracks'
};

// Helper to safely parse JSON from localStorage
function getStorageItem(key) {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : new Set();
  } catch (error) {
    console.error(`Error reading ${key} from localStorage:`, error);
    return new Set();
  }
}

// Helper to safely save to localStorage
function setStorageItem(key, value) {
  try {
    // Convert Set to Array for JSON serialization
    const arrayValue = Array.from(value);
    localStorage.setItem(key, JSON.stringify(arrayValue));
  } catch (error) {
    console.error(`Error writing ${key} to localStorage:`, error);
  }
}

/**
 * Mark an episode's tracklist as viewed
 */
export function markTracklistViewed(episodePath) {
  const viewed = new Set(getStorageItem(STORAGE_KEYS.VIEWED_TRACKLISTS));
  viewed.add(episodePath);
  setStorageItem(STORAGE_KEYS.VIEWED_TRACKLISTS, viewed);
}

/**
 * Check if a tracklist has been viewed
 */
export function isTracklistViewed(episodePath) {
  const viewed = new Set(getStorageItem(STORAGE_KEYS.VIEWED_TRACKLISTS));
  return viewed.has(episodePath);
}

/**
 * Mark a track as played (Spotify link clicked)
 */
export function markTrackPlayed(episodePath, trackIndex) {
  const key = `${episodePath}:${trackIndex}`;
  const played = new Set(getStorageItem(STORAGE_KEYS.PLAYED_TRACKS));
  played.add(key);
  setStorageItem(STORAGE_KEYS.PLAYED_TRACKS, played);
}

/**
 * Check if a track has been played
 */
export function isTrackPlayed(episodePath, trackIndex) {
  const key = `${episodePath}:${trackIndex}`;
  const played = new Set(getStorageItem(STORAGE_KEYS.PLAYED_TRACKS));
  return played.has(key);
}

/**
 * Clear all tracking data
 */
export function clearAllTracking() {
  Object.values(STORAGE_KEYS).forEach(key => {
    localStorage.removeItem(key);
  });
}

/**
 * Get stats about tracked data
 */
export function getTrackingStats() {
  return {
    viewedTracklists: getStorageItem(STORAGE_KEYS.VIEWED_TRACKLISTS).size,
    playedTracks: getStorageItem(STORAGE_KEYS.PLAYED_TRACKS).size,
    likedEpisodes: getLikedEpisodes().length
  };
}

/**
 * Like an episode (save its metadata)
 */
export function likeEpisode(episode) {
  try {
    const liked = localStorage.getItem(STORAGE_KEYS.LIKED_EPISODES);
    const episodes = liked ? JSON.parse(liked) : [];

    // Don't add duplicates
    if (!episodes.find(ep => ep.episodePath === episode.episodePath)) {
      episodes.unshift(episode); // Add to front
      localStorage.setItem(STORAGE_KEYS.LIKED_EPISODES, JSON.stringify(episodes));
    }
  } catch (error) {
    console.error('Error liking episode:', error);
  }
}

/**
 * Unlike an episode
 */
export function unlikeEpisode(episodePath) {
  try {
    const liked = localStorage.getItem(STORAGE_KEYS.LIKED_EPISODES);
    const episodes = liked ? JSON.parse(liked) : [];
    const filtered = episodes.filter(ep => ep.episodePath !== episodePath);
    localStorage.setItem(STORAGE_KEYS.LIKED_EPISODES, JSON.stringify(filtered));
  } catch (error) {
    console.error('Error unliking episode:', error);
  }
}

/**
 * Check if an episode is liked
 */
export function isEpisodeLiked(episodePath) {
  try {
    const liked = localStorage.getItem(STORAGE_KEYS.LIKED_EPISODES);
    const episodes = liked ? JSON.parse(liked) : [];
    return episodes.some(ep => ep.episodePath === episodePath);
  } catch (error) {
    console.error('Error checking liked episode:', error);
    return false;
  }
}

/**
 * Get all liked episodes
 */
export function getLikedEpisodes() {
  try {
    const liked = localStorage.getItem(STORAGE_KEYS.LIKED_EPISODES);
    return liked ? JSON.parse(liked) : [];
  } catch (error) {
    console.error('Error getting liked episodes:', error);
    return [];
  }
}

/**
 * Like a track (save its Spotify data)
 */
export function likeTrack(track) {
  try {
    const liked = localStorage.getItem(STORAGE_KEYS.LIKED_TRACKS);
    const tracks = liked ? JSON.parse(liked) : [];

    // Don't add duplicates (check by Spotify ID)
    if (!tracks.find(t => t.spotify?.id === track.spotify?.id)) {
      tracks.unshift({
        title: track.title,
        artist: track.artist,
        spotify: track.spotify
      });
      localStorage.setItem(STORAGE_KEYS.LIKED_TRACKS, JSON.stringify(tracks));
    }
  } catch (error) {
    console.error('Error liking track:', error);
  }
}

/**
 * Unlike a track
 */
export function unlikeTrack(spotifyId) {
  try {
    const liked = localStorage.getItem(STORAGE_KEYS.LIKED_TRACKS);
    const tracks = liked ? JSON.parse(liked) : [];
    const filtered = tracks.filter(t => t.spotify?.id !== spotifyId);
    localStorage.setItem(STORAGE_KEYS.LIKED_TRACKS, JSON.stringify(filtered));
  } catch (error) {
    console.error('Error unliking track:', error);
  }
}

/**
 * Check if a track is liked
 */
export function isTrackLiked(spotifyId) {
  try {
    const liked = localStorage.getItem(STORAGE_KEYS.LIKED_TRACKS);
    const tracks = liked ? JSON.parse(liked) : [];
    return tracks.some(t => t.spotify?.id === spotifyId);
  } catch (error) {
    console.error('Error checking liked track:', error);
    return false;
  }
}

/**
 * Get all liked tracks
 */
export function getLikedTracks() {
  try {
    const liked = localStorage.getItem(STORAGE_KEYS.LIKED_TRACKS);
    return liked ? JSON.parse(liked) : [];
  } catch (error) {
    console.error('Error getting liked tracks:', error);
    return [];
  }
}
