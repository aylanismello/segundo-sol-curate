/**
 * Taste Profile LocalStorage Utilities
 *
 * Manages three key pieces of state:
 * 1. Seen Episodes - Episode paths that the user has clicked on
 * 2. Referenced Tracks - Track UIDs that have appeared in stack results
 * 3. Stack History - Previous taste profile runs with timestamps
 *
 * All data is stored in localStorage (browser-level persistence)
 */

const KEYS = {
  SEEN_EPISODES: 'tasteProfile_seenEpisodes',
  REFERENCED_TRACKS: 'tasteProfile_referencedTracks',
  STACK_HISTORY: 'tasteProfile_stackHistory'
};

// ==================== Seen Episodes ====================

/**
 * Mark an episode as seen (when user clicks on it)
 * @param {string} episodePath - The NTS episode path (e.g., "/shows/bonobo/episodes/...")
 */
export function markEpisodeAsSeen(episodePath) {
  const seen = getSeenEpisodes();
  if (!seen.includes(episodePath)) {
    seen.push(episodePath);
    localStorage.setItem(KEYS.SEEN_EPISODES, JSON.stringify(seen));
  }
}

/**
 * Get all seen episode paths
 * @returns {string[]} Array of episode paths
 */
export function getSeenEpisodes() {
  if (typeof window === 'undefined') return []; // SSR safety
  const data = localStorage.getItem(KEYS.SEEN_EPISODES);
  return data ? JSON.parse(data) : [];
}

/**
 * Check if an episode has been seen
 * @param {string} episodePath - The episode path to check
 * @returns {boolean}
 */
export function isEpisodeSeen(episodePath) {
  return getSeenEpisodes().includes(episodePath);
}

/**
 * Clear all seen episodes (nuclear option)
 */
export function clearSeenEpisodes() {
  localStorage.removeItem(KEYS.SEEN_EPISODES);
}

// ==================== Referenced Tracks ====================

/**
 * Mark tracks as referenced (when they appear in a stack)
 * @param {string[]} trackUids - Array of track UIDs from NTS
 */
export function markTracksAsReferenced(trackUids) {
  const referenced = getReferencedTracks();
  const updated = [...new Set([...referenced, ...trackUids])]; // Deduplicate
  localStorage.setItem(KEYS.REFERENCED_TRACKS, JSON.stringify(updated));
}

/**
 * Get all referenced track UIDs
 * @returns {string[]} Array of track UIDs
 */
export function getReferencedTracks() {
  if (typeof window === 'undefined') return []; // SSR safety
  const data = localStorage.getItem(KEYS.REFERENCED_TRACKS);
  return data ? JSON.parse(data) : [];
}

/**
 * Check if a track has been referenced
 * @param {string} trackUid - The track UID to check
 * @returns {boolean}
 */
export function isTrackReferenced(trackUid) {
  return getReferencedTracks().includes(trackUid);
}

/**
 * Clear all referenced tracks
 */
export function clearReferencedTracks() {
  localStorage.removeItem(KEYS.REFERENCED_TRACKS);
}

// ==================== Stack History ====================

/**
 * Generate a descriptive name for a stack based on its sources
 * @param {Object} sources - The sources object with tracks and genres
 * @returns {string} A descriptive name for the stack
 */
export function generateStackName(sources) {
  const artistNames = [];
  const genreNames = [];

  // Get artist names from track sources
  if (sources.tracks && sources.tracks.length > 0) {
    for (const track of sources.tracks) {
      if (track.artist) {
        artistNames.push(track.artist);
      }
    }
  }

  // Get genre names (passed in as already resolved names)
  if (sources.genres && sources.genres.length > 0) {
    genreNames.push(...sources.genres);
  }

  // Generate name based on what we have
  if (artistNames.length > 0 && genreNames.length > 0) {
    // Both artists and genres
    const firstArtist = artistNames[0];
    const firstGenre = genreNames[0];
    if (artistNames.length === 1 && genreNames.length === 1) {
      return `${firstArtist} + ${firstGenre}`;
    } else if (artistNames.length > 1 && genreNames.length === 1) {
      return `${firstArtist} & More + ${firstGenre}`;
    } else if (artistNames.length === 1 && genreNames.length > 1) {
      return `${firstArtist} + ${firstGenre} Mix`;
    } else {
      return `${firstArtist} + ${firstGenre} & More`;
    }
  } else if (artistNames.length > 0) {
    // Only artists
    if (artistNames.length === 1) {
      return `${artistNames[0]} Mix`;
    } else if (artistNames.length === 2) {
      return `${artistNames[0]} + ${artistNames[1]}`;
    } else {
      return `${artistNames[0]} & ${artistNames.length - 1} More`;
    }
  } else if (genreNames.length > 0) {
    // Only genres
    if (genreNames.length === 1) {
      return `${genreNames[0]} Stack`;
    } else if (genreNames.length === 2) {
      return `${genreNames[0]} + ${genreNames[1]}`;
    } else {
      return `${genreNames[0]} Mix`;
    }
  } else {
    // Fallback
    return 'Music Stack';
  }
}

/**
 * Save a stack to history
 * @param {Object} stack - The complete stack object
 * @param {string} stack.id - Unique ID (timestamp)
 * @param {string} stack.createdAt - ISO timestamp
 * @param {Object} stack.sources - Source metadata (tracks, genres)
 * @param {Array} stack.tracks - All tracks in the stack
 * @param {Array} stack.episodesUsed - Episodes that were pulled
 * @param {string} stack.summary - Human-readable summary
 * @param {string} stack.name - Descriptive name for the stack
 */
export function saveStackToHistory(stack) {
  const history = getStackHistory();
  history.unshift(stack); // Add to beginning (newest first)

  // Keep only the last 50 stacks to avoid bloating localStorage
  const trimmed = history.slice(0, 50);

  localStorage.setItem(KEYS.STACK_HISTORY, JSON.stringify(trimmed));
}

/**
 * Get all stack history
 * @returns {Array} Array of stack objects, newest first
 */
export function getStackHistory() {
  if (typeof window === 'undefined') return []; // SSR safety
  const data = localStorage.getItem(KEYS.STACK_HISTORY);
  return data ? JSON.parse(data) : [];
}

/**
 * Get a specific stack by ID
 * @param {string} stackId - The stack ID (timestamp)
 * @returns {Object|null} The stack object or null if not found
 */
export function getStackById(stackId) {
  const history = getStackHistory();
  return history.find(stack => stack.id === stackId) || null;
}

/**
 * Delete a stack from history and clean up its referenced tracks
 * @param {string} stackId - The stack ID to delete
 */
export function deleteStack(stackId) {
  const history = getStackHistory();

  // Find the stack to delete
  const stackToDelete = history.find(stack => stack.id === stackId);

  if (stackToDelete) {
    // Get all track UIDs from the stack being deleted
    const deletedTrackUids = stackToDelete.tracks.map(t => t.uid);

    // Get remaining stacks
    const remainingStacks = history.filter(stack => stack.id !== stackId);

    // Get all track UIDs from remaining stacks
    const remainingTrackUids = new Set();
    for (const stack of remainingStacks) {
      for (const track of stack.tracks) {
        remainingTrackUids.add(track.uid);
      }
    }

    // Get currently referenced tracks
    const currentReferenced = getReferencedTracks();

    // Only keep tracks that either:
    // 1. Weren't in the deleted stack, OR
    // 2. Still appear in other remaining stacks
    const updatedReferenced = currentReferenced.filter(uid => {
      const wasInDeletedStack = deletedTrackUids.includes(uid);
      const stillInOtherStacks = remainingTrackUids.has(uid);

      // Keep if it wasn't in deleted stack, or if it's still in other stacks
      return !wasInDeletedStack || stillInOtherStacks;
    });

    // Update referenced tracks
    localStorage.setItem(KEYS.REFERENCED_TRACKS, JSON.stringify(updatedReferenced));
  }

  // Remove the stack from history
  const filtered = history.filter(stack => stack.id !== stackId);
  localStorage.setItem(KEYS.STACK_HISTORY, JSON.stringify(filtered));
}

/**
 * Clear all stack history
 */
export function clearStackHistory() {
  localStorage.removeItem(KEYS.STACK_HISTORY);
}

// ==================== Bulk Operations ====================

/**
 * Clear ALL taste profile data (nuclear reset)
 */
export function clearAllTasteProfileData() {
  clearSeenEpisodes();
  clearReferencedTracks();
  clearStackHistory();
}

/**
 * Get stats about the taste profile
 * @returns {Object} Statistics about seen episodes, tracks, and stacks
 */
export function getTasteProfileStats() {
  return {
    seenEpisodes: getSeenEpisodes().length,
    referencedTracks: getReferencedTracks().length,
    stacksCreated: getStackHistory().length
  };
}
