'use client';

/**
 * Taste Profile Page
 *
 * The magic page where you build music stacks from your taste profile!
 *
 * How it works:
 * 1. Add artist/track combinations (like the search page)
 * 2. Add genres you like
 * 3. Click "Create Stacks" to generate a combined playlist
 * 4. System remembers what you've seen and avoids showing it again
 * 5. Previous stacks are saved with timestamps
 */

import { useState, useEffect, useRef } from 'react';
import { genreCategories, genreColors, getGenreApiId } from '../data/genres';
import {
  getSeenEpisodes,
  getReferencedTracks,
  saveStackToHistory,
  getStackHistory,
  getTasteProfileStats,
  clearAllTasteProfileData,
  markEpisodeAsSeen,
  markTracksAsReferenced,
  deleteStack
} from '../utils/tasteProfileStorage';
import { likeTrack, unlikeTrack, isTrackLiked, markTrackPlayed, isTrackPlayed } from '../utils/localStorage';

// Helper to get genre name from ID
function getGenreName(genreId) {
  for (const category of genreCategories) {
    for (const subgenre of category.subgenres) {
      const fullId = getGenreApiId(category.id, subgenre.id);
      if (fullId === genreId) {
        return subgenre.name;
      }
    }
  }
  return genreId;
}

// Lazy-loaded Spotify embed component with play tracking
// Uses Intersection Observer to only load iframe when it comes into view
function LazySpotifyEmbed({ spotifyId, onInteraction, played }) {
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef(null);
  const iframeRef = useRef(null);
  const hasInteracted = useRef(played);
  const checkingFocus = useRef(null);

  // Intersection Observer for lazy loading
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            // Once loaded, stop observing
            observer.disconnect();
          }
        });
      },
      {
        rootMargin: '100px' // Start loading 100px before it comes into view
      }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, []);

  // Focus detection for play tracking
  useEffect(() => {
    if (!isVisible || hasInteracted.current) return;

    const startChecking = () => {
      checkingFocus.current = setInterval(() => {
        const activeElement = document.activeElement;
        if (activeElement === iframeRef.current) {
          if (!hasInteracted.current && onInteraction) {
            hasInteracted.current = true;
            onInteraction();
            clearInterval(checkingFocus.current);
          }
        }
      }, 100);
    };

    startChecking();

    return () => {
      if (checkingFocus.current) {
        clearInterval(checkingFocus.current);
      }
    };
  }, [isVisible, onInteraction, played]);

  return (
    <div ref={containerRef} className="mb-2">
      {isVisible ? (
        <iframe
          ref={iframeRef}
          src={`https://open.spotify.com/embed/track/${spotifyId}?utm_source=generator&theme=0`}
          width="100%"
          height="152"
          frameBorder="0"
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          loading="lazy"
          className="rounded"
        ></iframe>
      ) : (
        <div className="w-full h-[152px] bg-zinc-800 rounded flex items-center justify-center">
          <svg
            className="w-8 h-8 text-gray-600 animate-pulse"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
          </svg>
        </div>
      )}
    </div>
  );
}

export default function TasteProfilePage() {
  // Taste profile inputs
  const [tracks, setTracks] = useState([{ artist: '', title: '' }]);
  const [selectedGenres, setSelectedGenres] = useState([]);

  // Genre search/browse
  const [genreSearchQuery, setGenreSearchQuery] = useState('');
  const [genreBrowseMode, setGenreBrowseMode] = useState('search');
  const [expandedCategory, setExpandedCategory] = useState(null);

  // Stack state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentStack, setCurrentStack] = useState(null);

  // History state
  const [stackHistory, setStackHistory] = useState([]);
  const [viewingHistoryStack, setViewingHistoryStack] = useState(null);
  const [stats, setStats] = useState({ seenEpisodes: 0, referencedTracks: 0, stacksCreated: 0 });

  // Track liked states for reactivity
  const [likedStates, setLikedStates] = useState({});

  // Track played states for reactivity
  const [playedStates, setPlayedStates] = useState(new Set());

  // Delete confirmation modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [stackToDelete, setStackToDelete] = useState(null);

  // Load history on mount
  useEffect(() => {
    setStackHistory(getStackHistory());
    setStats(getTasteProfileStats());
  }, []);

  // Add a new track input
  const addTrackInput = () => {
    setTracks([...tracks, { artist: '', title: '' }]);
  };

  // Remove a track input
  const removeTrackInput = (index) => {
    setTracks(tracks.filter((_, i) => i !== index));
  };

  // Update track input
  const updateTrack = (index, field, value) => {
    const updated = [...tracks];
    updated[index][field] = value;
    setTracks(updated);
  };

  // Toggle genre selection
  const toggleGenre = (genreId, genreName) => {
    if (selectedGenres.find(g => g.id === genreId)) {
      setSelectedGenres(selectedGenres.filter(g => g.id !== genreId));
    } else {
      setSelectedGenres([...selectedGenres, { id: genreId, name: genreName }]);
    }
  };

  // Get all genres for search
  const allGenres = genreCategories.flatMap(category =>
    category.subgenres.map(subgenre => ({
      categoryId: category.id,
      categoryName: category.name,
      subgenreId: subgenre.id,
      subgenreName: subgenre.name,
      fullApiId: getGenreApiId(category.id, subgenre.id),
      displayName: `${subgenre.name} (${category.name})`,
      color: category.color
    }))
  );

  // Filter genres based on search
  const filteredGenres = genreSearchQuery.trim() === ''
    ? []
    : allGenres.filter(genre =>
        genre.subgenreName.toLowerCase().includes(genreSearchQuery.toLowerCase()) ||
        genre.categoryName.toLowerCase().includes(genreSearchQuery.toLowerCase())
      ).slice(0, 10);

  // Create stack
  const handleCreateStack = async () => {
    // Validate input
    const validTracks = tracks.filter(t => t.artist.trim() || t.title.trim());

    if (validTracks.length === 0 && selectedGenres.length === 0) {
      setError('Please add at least one track or genre');
      return;
    }

    setLoading(true);
    setError(null);
    setCurrentStack(null);
    setViewingHistoryStack(null);

    try {
      // Get current seen episodes and referenced tracks
      const seenEpisodes = getSeenEpisodes();
      const referencedTracks = getReferencedTracks();

      // Call API to create stack
      const response = await fetch('/api/taste-profile/create-stack', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tracks: validTracks,
          genres: selectedGenres.map(g => g.id),
          seenEpisodes,
          referencedTracks
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create stack');
      }

      const data = await response.json();
      const stack = data.stack;

      // Save to history
      saveStackToHistory(stack);

      // Mark tracks as referenced
      const trackUids = stack.tracks.map(t => t.uid);
      markTracksAsReferenced(trackUids);

      // Update state
      setCurrentStack(stack);
      setStackHistory(getStackHistory());
      setStats(getTasteProfileStats());

    } catch (err) {
      console.error('Error creating stack:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // View a stack from history
  const viewHistoryStack = (stack) => {
    setCurrentStack(null);
    setViewingHistoryStack(stack);
  };

  // Mark episode as seen when clicked
  const handleEpisodeLinkClick = (episodePath) => {
    markEpisodeAsSeen(episodePath);
    setStats(getTasteProfileStats());
  };

  // Delete a stack from history
  const handleDeleteStack = (stack, e) => {
    e.stopPropagation(); // Prevent clicking the stack button
    setStackToDelete(stack);
    setDeleteModalOpen(true);
  };

  const confirmDelete = () => {
    if (stackToDelete) {
      deleteStack(stackToDelete.id);
      setStackHistory(getStackHistory());
      setStats(getTasteProfileStats());

      // If we're viewing the deleted stack, close it
      if (viewingHistoryStack?.id === stackToDelete.id) {
        setViewingHistoryStack(null);
      }
    }
    setDeleteModalOpen(false);
    setStackToDelete(null);
  };

  const cancelDelete = () => {
    setDeleteModalOpen(false);
    setStackToDelete(null);
  };

  // Handle track play
  const handleTrackPlay = (stackId, trackIndex) => {
    markTrackPlayed(stackId, trackIndex);
    setPlayedStates(prev => new Set([...prev, `${stackId}:${trackIndex}`]));
  };

  // Check if track is played
  const isPlayed = (stackId, trackIndex) => {
    const key = `${stackId}:${trackIndex}`;
    return playedStates.has(key) || isTrackPlayed(stackId, trackIndex);
  };

  const displayStack = viewingHistoryStack || currentStack;

  return (
    <main className="min-h-screen bg-black text-white p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="mb-8">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-4xl font-bold mb-2">Taste Profile</h1>
              <p className="text-gray-400">
                Build music stacks from your favorite artists and genres
              </p>
            </div>
            <div className="flex gap-2">
              <a
                href="/"
                className="text-sm text-gray-400 hover:text-white transition-colors px-4 py-2 border border-zinc-800 rounded hover:border-zinc-600"
              >
                ← Back to Search
              </a>
              <button
                onClick={() => {
                  if (confirm('Clear all taste profile data (history, seen episodes, referenced tracks)?')) {
                    clearAllTasteProfileData();
                    setStackHistory([]);
                    setStats({ seenEpisodes: 0, referencedTracks: 0, stacksCreated: 0 });
                    setCurrentStack(null);
                    setViewingHistoryStack(null);
                  }
                }}
                className="text-xs text-gray-500 hover:text-white transition-colors px-3 py-1 border border-gray-700 rounded hover:border-gray-500"
              >
                Clear All Data
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="mt-4 flex gap-4 text-sm text-gray-400">
            <div>Seen Episodes: <span className="text-white">{stats.seenEpisodes}</span></div>
            <div>Referenced Tracks: <span className="text-white">{stats.referencedTracks}</span></div>
            <div>Stacks Created: <span className="text-white">{stats.stacksCreated}</span></div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left side - Inputs */}
          <div className="lg:col-span-2 space-y-8">
            {/* Track Inputs */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">Artist / Track Combinations</h2>
                <button
                  onClick={addTrackInput}
                  className="text-sm px-3 py-1 bg-white text-black rounded hover:bg-gray-200 transition-colors"
                >
                  + Add Track
                </button>
              </div>

              <div className="space-y-3">
                {tracks.map((track, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <input
                      type="text"
                      value={track.artist}
                      onChange={(e) => updateTrack(index, 'artist', e.target.value)}
                      placeholder="Artist"
                      className="flex-1 px-4 py-2 bg-black border border-zinc-700 rounded focus:outline-none focus:ring-2 focus:ring-white"
                    />
                    <div className="text-gray-600">—</div>
                    <input
                      type="text"
                      value={track.title}
                      onChange={(e) => updateTrack(index, 'title', e.target.value)}
                      placeholder="Track"
                      className="flex-1 px-4 py-2 bg-black border border-zinc-700 rounded focus:outline-none focus:ring-2 focus:ring-white"
                    />
                    {tracks.length > 1 && (
                      <button
                        onClick={() => removeTrackInput(index)}
                        className="p-2 text-red-400 hover:text-red-300 transition-colors"
                        title="Remove"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Genre Selection */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Genres</h2>

              {/* Selected genres display */}
              {selectedGenres.length > 0 && (
                <div className="mb-4 p-3 bg-black border border-zinc-700 rounded">
                  <div className="text-sm text-gray-400 mb-2">Selected: {selectedGenres.length}</div>
                  <div className="flex flex-wrap gap-2">
                    {selectedGenres.map((genre) => (
                      <button
                        key={genre.id}
                        onClick={() => toggleGenre(genre.id, genre.name)}
                        className="px-3 py-1 bg-white text-black rounded-full text-sm hover:bg-gray-200 transition-colors"
                      >
                        {genre.name} ✕
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Genre search/browse toggle */}
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm text-gray-400">
                  {genreBrowseMode === 'search' ? 'Search genres' : 'Browse categories'}
                </div>
                <button
                  onClick={() => {
                    setGenreBrowseMode(genreBrowseMode === 'search' ? 'browse' : 'search');
                    setGenreSearchQuery('');
                    setExpandedCategory(null);
                  }}
                  className="text-sm text-gray-400 hover:text-white transition-colors"
                >
                  {genreBrowseMode === 'search' ? 'Browse instead' : 'Search instead'}
                </button>
              </div>

              {/* Type-ahead search */}
              {genreBrowseMode === 'search' && (
                <div className="relative mb-4">
                  <input
                    type="text"
                    value={genreSearchQuery}
                    onChange={(e) => setGenreSearchQuery(e.target.value)}
                    placeholder="Type a genre name..."
                    className="w-full px-4 py-2 bg-black border border-zinc-700 rounded focus:outline-none focus:ring-2 focus:ring-white"
                  />
                  {filteredGenres.length > 0 && (
                    <div className="absolute z-10 w-full mt-2 bg-black border border-zinc-700 rounded shadow-lg max-h-60 overflow-y-auto">
                      {filteredGenres.map((genre, index) => {
                        const isSelected = selectedGenres.find(g => g.id === genre.fullApiId);
                        return (
                          <button
                            key={index}
                            onClick={() => {
                              toggleGenre(genre.fullApiId, genre.subgenreName);
                              setGenreSearchQuery('');
                            }}
                            className={`w-full text-left px-4 py-2 hover:bg-zinc-800 transition-colors border-b border-zinc-800 last:border-b-0 ${
                              isSelected ? 'bg-zinc-800' : ''
                            }`}
                          >
                            <div className="font-semibold">{genre.subgenreName}</div>
                            <div className="text-sm text-gray-500">{genre.categoryName}</div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Browse mode */}
              {genreBrowseMode === 'browse' && (
                <>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {genreCategories.map((category) => {
                      const isExpanded = expandedCategory?.id === category.id;
                      const colorClass = genreColors[category.color];

                      return (
                        <button
                          key={category.id}
                          onClick={() => setExpandedCategory(isExpanded ? null : category)}
                          className={`px-3 py-1.5 rounded-full text-sm font-semibold transition-all border ${
                            isExpanded ? 'bg-white text-black' : colorClass
                          }`}
                        >
                          {category.name} {isExpanded ? '−' : '+'}
                        </button>
                      );
                    })}
                  </div>

                  {expandedCategory && (
                    <div className="p-4 bg-black border border-zinc-700 rounded">
                      <div className="flex flex-wrap gap-2">
                        {expandedCategory.subgenres.map((subgenre) => {
                          const fullId = getGenreApiId(expandedCategory.id, subgenre.id);
                          const isSelected = selectedGenres.find(g => g.id === fullId);

                          return (
                            <button
                              key={subgenre.id}
                              onClick={() => toggleGenre(fullId, subgenre.name)}
                              className={`px-3 py-1 rounded-full text-xs font-medium transition-all border ${
                                isSelected
                                  ? 'bg-white text-black'
                                  : genreColors[expandedCategory.color]
                              }`}
                            >
                              {subgenre.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Create Stack Button */}
            <button
              onClick={handleCreateStack}
              disabled={loading}
              className="w-full py-4 px-6 bg-white text-black font-bold text-lg rounded-lg hover:bg-gray-200 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Creating Stack...' : 'Create Stacks'}
            </button>

            {/* Error Display */}
            {error && (
              <div className="p-4 bg-red-900/20 border border-red-900 rounded-lg">
                <p className="text-red-400">{error}</p>
              </div>
            )}

            {/* Stack Results */}
            {displayStack && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
                <div className="p-6 border-b border-zinc-800">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h2 className="text-2xl font-bold">Stack Results</h2>
                      {viewingHistoryStack && (
                        <p className="text-sm text-gray-400 mt-1">
                          From {new Date(viewingHistoryStack.createdAt).toLocaleString()}
                        </p>
                      )}
                    </div>
                    {viewingHistoryStack && (
                      <button
                        onClick={() => setViewingHistoryStack(null)}
                        className="text-sm text-gray-400 hover:text-white"
                      >
                        ✕ Close
                      </button>
                    )}
                  </div>
                  <p className="text-gray-400 text-sm mb-4">{displayStack.summary}</p>

                  {/* Sources Display */}
                  <div className="space-y-3">
                    {/* Track Sources */}
                    {displayStack.sources.tracks.length > 0 && (
                      <div>
                        <div className="text-xs font-semibold text-gray-500 mb-2">ARTISTS / TRACKS:</div>
                        <div className="flex flex-wrap gap-2">
                          {displayStack.sources.tracks.map((track, idx) => (
                            <div
                              key={idx}
                              className="px-3 py-1.5 bg-blue-900 border border-blue-700 rounded-full text-sm"
                            >
                              {track.artist && track.title
                                ? `${track.artist} - ${track.title}`
                                : track.artist || track.title}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Genre Sources */}
                    {displayStack.sources.genres.length > 0 && (
                      <div>
                        <div className="text-xs font-semibold text-gray-500 mb-2">GENRES:</div>
                        <div className="flex flex-wrap gap-2">
                          {displayStack.sources.genres.map((genreId, idx) => (
                            <div
                              key={idx}
                              className="px-3 py-1.5 bg-purple-900 border border-purple-700 rounded-full text-sm"
                            >
                              {getGenreName(genreId)}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="divide-y divide-zinc-800">
                  {displayStack.tracks.map((track, index) => {
                    const liked = likedStates[track.uid] !== undefined ? likedStates[track.uid] : isTrackLiked(track.uid);
                    const played = isPlayed(displayStack.id, index);
                    return (
                      <div key={index} className="p-4 hover:bg-zinc-800/50 transition-colors">
                        <div className="flex items-start gap-4">
                          <div className="text-gray-500 text-sm font-mono w-8 flex-shrink-0 text-right">
                            {index + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-4 mb-2">
                              <div className="flex-1 min-w-0">
                                <h3 className="font-semibold">{track.title}</h3>
                                <p className="text-gray-400 text-sm">{track.artist}</p>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                {/* Play status indicator */}
                                <div
                                  className={`p-1.5 rounded-full ${
                                    played ? 'text-green-500' : 'text-gray-500'
                                  }`}
                                  title={played ? 'Played' : 'Not played'}
                                >
                                  <svg
                                    className="w-5 h-5"
                                    fill={played ? 'currentColor' : 'none'}
                                    stroke="currentColor"
                                    strokeWidth={2}
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                                    />
                                  </svg>
                                </div>
                                {track.spotify && (
                                  <a
                                    href={track.spotify.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-2 hover:bg-white/10 rounded-full transition-colors"
                                    title="Open in Spotify"
                                  >
                                    <svg
                                      className="w-5 h-5 text-green-500"
                                      fill="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                                    </svg>
                                  </a>
                                )}
                                <button
                                  onClick={() => {
                                    if (liked) {
                                      unlikeTrack(track.uid);
                                      setLikedStates(prev => ({ ...prev, [track.uid]: false }));
                                    } else {
                                      likeTrack({
                                        uid: track.uid,
                                        artist: track.artist,
                                        title: track.title,
                                        spotify: track.spotify
                                      });
                                      setLikedStates(prev => ({ ...prev, [track.uid]: true }));
                                    }
                                  }}
                                  className="p-2 hover:bg-white/10 rounded-full transition-colors"
                                  title={liked ? 'Unlike' : 'Like'}
                                >
                                  <svg
                                    className={`w-5 h-5 ${liked ? 'fill-red-500 text-red-500' : 'text-gray-400'}`}
                                    fill={liked ? 'currentColor' : 'none'}
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                                    />
                                  </svg>
                                </button>
                              </div>
                            </div>

                            {/* Spotify Embed - Lazy Loaded */}
                            {track.spotify && (
                              <LazySpotifyEmbed
                                spotifyId={track.spotify.id}
                                onInteraction={() => handleTrackPlay(displayStack.id, index)}
                                played={played}
                              />
                            )}

                            <div className="flex items-center gap-2 text-xs text-gray-500 flex-wrap">
                              {/* Source badge */}
                              {track.source && (
                                <>
                                  {track.source.type === 'track' ? (
                                    <span className="px-2 py-0.5 bg-blue-900/50 border border-blue-700/50 rounded text-blue-300 font-medium">
                                      {track.source.artist && track.source.title
                                        ? `${track.source.artist} - ${track.source.title}`
                                        : track.source.artist || track.source.title}
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 bg-purple-900/50 border border-purple-700/50 rounded text-purple-300 font-medium">
                                      {getGenreName(track.source.genreId)}
                                    </span>
                                  )}
                                  <span>•</span>
                                </>
                              )}
                              <a
                                href={`https://www.nts.live${track.episodePath}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={() => handleEpisodeLinkClick(track.episodePath)}
                                className="hover:text-white transition-colors"
                              >
                                {track.episodeTitle}
                              </a>
                              <span>•</span>
                              <span>{track.airDate}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Right side - History */}
          <div className="lg:col-span-1">
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 sticky top-8">
              <h2 className="text-xl font-semibold mb-4">Stack History</h2>

              {stackHistory.length === 0 ? (
                <p className="text-gray-500 text-sm">No stacks created yet</p>
              ) : (
                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                  {stackHistory.map((stack) => (
                    <div
                      key={stack.id}
                      className={`relative p-3 rounded border transition-colors ${
                        viewingHistoryStack?.id === stack.id
                          ? 'bg-white text-black border-white'
                          : 'bg-black border-zinc-700 hover:border-zinc-500'
                      }`}
                    >
                      <button
                        onClick={() => viewHistoryStack(stack)}
                        className="w-full text-left"
                      >
                        <div className={`text-xs mb-1 ${
                          viewingHistoryStack?.id === stack.id ? 'text-gray-600' : 'text-gray-500'
                        }`}>
                          {new Date(stack.createdAt).toLocaleString()}
                        </div>
                        <div className="text-sm font-medium mb-1">
                          {stack.tracks.length} tracks
                        </div>
                        <div className={`text-xs ${
                          viewingHistoryStack?.id === stack.id ? 'text-gray-700' : 'text-gray-400'
                        }`}>
                          {stack.sources.tracks.length} artists, {stack.sources.genres.length} genres
                        </div>
                      </button>
                      <button
                        onClick={(e) => handleDeleteStack(stack, e)}
                        className={`absolute top-2 right-2 p-1 rounded hover:bg-opacity-20 transition-colors ${
                          viewingHistoryStack?.id === stack.id
                            ? 'text-gray-600 hover:bg-black'
                            : 'text-gray-500 hover:bg-white'
                        }`}
                        title="Delete stack"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Custom Delete Confirmation Modal */}
        {deleteModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 max-w-md w-full shadow-2xl">
              <h3 className="text-xl font-bold mb-2">Delete Stack?</h3>
              {stackToDelete && (
                <div className="mb-4">
                  <p className="text-gray-400 text-sm mb-3">
                    This will permanently delete this stack from your history.
                  </p>
                  <div className="p-3 bg-black border border-zinc-800 rounded text-sm">
                    <div className="text-xs text-gray-500 mb-1">
                      {new Date(stackToDelete.createdAt).toLocaleString()}
                    </div>
                    <div className="font-medium mb-1">
                      {stackToDelete.tracks.length} tracks
                    </div>
                    <div className="text-xs text-gray-400">
                      {stackToDelete.sources.tracks.length} artists, {stackToDelete.sources.genres.length} genres
                    </div>
                  </div>
                </div>
              )}
              <div className="flex gap-3">
                <button
                  onClick={cancelDelete}
                  className="flex-1 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg font-medium transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
