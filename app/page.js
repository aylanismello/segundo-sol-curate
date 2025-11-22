'use client';

/**
 * Home Page Component
 *
 * The 'use client' directive at the top tells Next.js this is a CLIENT COMPONENT.
 * This means it runs in the browser and can use hooks like useState, useEffect.
 *
 * Without 'use client', components are SERVER COMPONENTS (rendered on the server only).
 * Think of it like:
 * - Server Components = like Rails views (rendered server-side)
 * - Client Components = like React SPA (rendered client-side, interactive)
 *
 * We need 'use client' here because we're using useState and handling form submissions.
 */

import { useState, useEffect, useRef } from 'react';
import TracklistDisplay from './components/TracklistDisplay';
import HomeTab from './components/HomeTab';
import { genreCategories, genreColors, getGenreApiId } from './data/genres';
import { markTracklistViewed, isTracklistViewed, clearAllTracking, getTrackingStats, likeEpisode, unlikeEpisode, isEpisodeLiked, getLikedEpisodes, getLikedTracks, likeTrack, unlikeTrack, isTrackLiked, markTrackPlayed, isTrackPlayed, getViewed1001TLs } from './utils/localStorage';
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
} from './utils/tasteProfileStorage';

// Helper to get genre name from ID
function getGenreNameFromId(genreId) {
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
function LazySpotifyEmbed({ spotifyId, onInteraction, played }) {
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef(null);
  const iframeRef = useRef(null);
  const hasInteracted = useRef(played);
  const checkingFocus = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.disconnect();
          }
        });
      },
      { rootMargin: '100px' }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

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
          <svg className="w-8 h-8 text-gray-600 animate-pulse" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
          </svg>
        </div>
      )}
    </div>
  );
}

export default function Home() {
  // React hooks for state management
  // If you're used to React, this is familiar!
  // In Rails, you'd handle this with form submissions and page reloads
  // Stack source: currently only 'nts', but will support 'soundcloud', 'bandcamp', etc.
  const [stackSource, setStackSource] = useState('nts');
  // Search mode: 'home', 'track', 'genre', 'liked', or 'likedTracks'
  const [searchMode, setSearchMode] = useState('home');
  const [likedEpisodes, setLikedEpisodes] = useState([]);
  const [likedTracks, setLikedTracksState] = useState([]);
  const [likedStates, setLikedStates] = useState({});

  // Track search state
  const [artist, setArtist] = useState('');
  const [title, setTitle] = useState('');

  // Genre search state
  const [genreSearchQuery, setGenreSearchQuery] = useState('');
  const [genreBrowseMode, setGenreBrowseMode] = useState('search'); // 'search' or 'browse'
  const [expandedCategory, setExpandedCategory] = useState(null);
  const [selectedGenre, setSelectedGenre] = useState(null);

  // Shared state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [episodes, setEpisodes] = useState(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [selectedEpisode, setSelectedEpisode] = useState(null);
  const [tracklist, setTracklist] = useState(null);
  const [loadingTracklist, setLoadingTracklist] = useState(false);

  // Home/Taste Profile state
  const [homeTracks, setHomeTracks] = useState([{ artist: '', title: '' }]);
  const [selectedGenres, setSelectedGenres] = useState([]);
  const [currentStack, setCurrentStack] = useState(null);
  const [stackHistory, setStackHistory] = useState([]);
  const [viewingHistoryStack, setViewingHistoryStack] = useState(null);
  const [stats, setStats] = useState({ seenEpisodes: 0, referencedTracks: 0, stacksCreated: 0 });
  const [playedStates, setPlayedStates] = useState(new Set());
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [stackToDelete, setStackToDelete] = useState(null);
  const [collapsedEpisodes, setCollapsedEpisodes] = useState(new Set());
  const [hidePlayed, setHidePlayed] = useState(false);
  const [hidePlayedSnapshot, setHidePlayedSnapshot] = useState(new Set());

  // 1001TL search results
  const [tracklistResults, setTracklistResults] = useState(null);
  const [selectedTracklist, setSelectedTracklist] = useState(null);
  const [tracklistTracks, setTracklistTracks] = useState(null);
  const [loadingTracks, setLoadingTracks] = useState(false);

  // Pagination settings
  const episodesPerPage = 9;
  const currentEpisodes = episodes ? episodes.slice(currentPage * episodesPerPage, (currentPage + 1) * episodesPerPage) : [];
  const totalPages = episodes ? Math.ceil(episodes.length / episodesPerPage) : 0;

  // Load liked episodes, tracks, and stack history on mount
  useEffect(() => {
    setLikedEpisodes(getLikedEpisodes());
    setLikedTracksState(getLikedTracks());
    setStackHistory(getStackHistory());
    setStats(getTasteProfileStats());
  }, []);

  // Reset hide played when switching stacks
  useEffect(() => {
    setHidePlayed(false);
    setHidePlayedSnapshot(new Set());
  }, [currentStack?.id, viewingHistoryStack?.id]);

  // Toggle like status
  const toggleLike = (episode) => {
    if (isEpisodeLiked(episode.episodePath)) {
      unlikeEpisode(episode.episodePath);
      setLikedStates(prev => ({ ...prev, [episode.episodePath]: false }));
      setLikedEpisodes(getLikedEpisodes());
    } else {
      likeEpisode(episode);
      setLikedStates(prev => ({ ...prev, [episode.episodePath]: true }));
      setLikedEpisodes(getLikedEpisodes());
    }
  };

  const isLiked = (episodePath) => {
    if (episodePath in likedStates) {
      return likedStates[episodePath];
    }
    return isEpisodeLiked(episodePath);
  };

  /**
   * Handle form submission
   *
   * Now this just searches for episodes and displays them.
   * The tracklist fetching happens when you CLICK an episode!
   */
  const handleSubmit = async (e) => {
    e.preventDefault(); // Prevent default form submission (no page reload!)

    // Require at least one field to be filled
    if (!artist.trim() && !title.trim()) {
      setError('Please enter either an artist or track name');
      return;
    }

    // Reset state
    setLoading(true);
    setError(null);
    setEpisodes(null);
    setCurrentPage(0);
    setSelectedEpisode(null);
    setTracklist(null);

    try {
      // Search NTS for the track - now returns 10 episodes!
      const ntsResponse = await fetch(
        `/api/nts?artist=${encodeURIComponent(artist)}&title=${encodeURIComponent(title)}`
      );

      if (!ntsResponse.ok) {
        const errorData = await ntsResponse.json();
        throw new Error(errorData.error || 'Failed to search NTS');
      }

      const ntsData = await ntsResponse.json();
      setEpisodes(ntsData.episodes);

    } catch (err) {
      console.error('Error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle genre selection
   *
   * When you click a genre, fetch episodes for that genre!
   * Can be called with either (categoryId, subgenre) or (genreApiId)
   */
  const handleGenreClick = async (categoryIdOrApiId, subgenre = null) => {
    // If called with two args, it's from browse mode (category + subgenre)
    // If called with one arg, it's from type-ahead mode (full API ID)
    const genreApiId = subgenre
      ? getGenreApiId(categoryIdOrApiId, subgenre.id)
      : categoryIdOrApiId;

    setSelectedGenre(subgenre || { name: genreApiId });
    setLoading(true);
    setError(null);
    setEpisodes(null);
    setCurrentPage(0);
    setSelectedEpisode(null);
    setTracklist(null);

    try {
      console.log(`Searching for genre: ${genreApiId}`);

      // Search NTS for episodes by genre
      const genreResponse = await fetch(
        `/api/genre?id=${encodeURIComponent(genreApiId)}`
      );

      if (!genreResponse.ok) {
        const errorData = await genreResponse.json();
        throw new Error(errorData.error || 'Failed to search by genre');
      }

      const genreData = await genreResponse.json();
      setEpisodes(genreData.episodes);

    } catch (err) {
      console.error('Error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Get all genres flattened for type-ahead search
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

  // Filter genres based on search query
  const filteredGenres = genreSearchQuery.trim() === ''
    ? []
    : allGenres.filter(genre =>
        genre.subgenreName.toLowerCase().includes(genreSearchQuery.toLowerCase()) ||
        genre.categoryName.toLowerCase().includes(genreSearchQuery.toLowerCase())
      ).slice(0, 10); // Show max 10 results

  /**
   * Handle episode click
   *
   * When you click an episode, THIS is when we fetch the tracklist!
   * Only fetch once per episode (saves API calls and is faster).
   */
  const handleEpisodeClick = async (episode) => {
    setSelectedEpisode(episode);
    setLoadingTracklist(true);
    setError(null);

    // Mark this tracklist as viewed
    markTracklistViewed(episode.episodePath);

    try {
      // Fetch the tracklist with Spotify links for THIS specific episode
      const tracklistResponse = await fetch(
        `/api/tracklist?path=${encodeURIComponent(episode.episodePath)}`
      );

      if (!tracklistResponse.ok) {
        const errorData = await tracklistResponse.json();
        throw new Error(errorData.error || 'Failed to fetch tracklist');
      }

      const tracklistData = await tracklistResponse.json();
      setTracklist(tracklistData);

    } catch (err) {
      console.error('Error:', err);
      setError(err.message);
    } finally {
      setLoadingTracklist(false);
    }
  };

  return (
    <main className="min-h-screen bg-black text-white p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <header className="mb-8">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-4xl font-bold mb-2">Segundo Sol Stacks</h1>
              <p className="text-gray-400">
                Your DJ pool - curated music stacks from multiple sources
              </p>
            </div>
            <button
              onClick={() => {
                if (confirm('Clear all viewing history?')) {
                  clearAllTracking();
                  window.location.reload();
                }
              }}
              className="text-xs text-gray-500 hover:text-white transition-colors px-3 py-1 border border-gray-700 rounded hover:border-gray-500"
            >
              Clear History
            </button>
          </div>

          {/* Stack Source Selector */}
          <div className="mt-6 p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-semibold text-gray-400">Stack Source</label>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setStackSource('nts')}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg border-2 transition-all ${
                  stackSource === 'nts'
                    ? 'bg-white text-black border-white'
                    : 'bg-zinc-800 text-white border-zinc-700 hover:border-zinc-600'
                }`}
              >
                <svg className="w-6 h-6" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 26 26" fill="currentColor">
                  <path d="M22.7 6.9L22.3 9h-1.5l.5-2c.1-.6.1-1.1-.6-1.1s-1 .5-1.1 1.1l-.4 1.7c-.1.5-.1 1 0 1.5l1.4 4.1c.2.6.3 1.3.1 2l-.6 2.6c-.4 1.5-1.5 2.4-2.9 2.4-1.6 0-2.3-.7-1.9-2.4l.5-2.2h1.5l-.5 2.1c-.2.8 0 1.2.7 1.2.6 0 1-.5 1.2-1.2l.5-2.3c.1-.5.1-1.1-.1-1.6l-1.3-3.8c-.2-.7-.3-1.2-.2-2.1l.4-2c.4-1.6 1.4-2.4 2.9-2.4 1.7 0 2.2.8 1.8 2.3zM11.2 21.1L14.6 6H13l.3-1.3h4.8L17.8 6h-1.7l-3.4 15.1h-1.5zm-4.5 0L8.1 6.6 4.8 21.1H3.5L7.2 4.8h2.2L8 18.7l3.2-14h1.3L8.8 21.1H6.7zM0 26h26V0H0v26z"></path>
                </svg>
                <span className="font-semibold">NTS Radio</span>
              </button>
              <button
                onClick={() => setStackSource('1001tl')}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg border-2 transition-all ${
                  stackSource === '1001tl'
                    ? 'bg-white text-black border-white'
                    : 'bg-zinc-800 text-white border-zinc-700 hover:border-zinc-600'
                }`}
              >
                <span className="font-semibold">1001 Tracklists</span>
              </button>
              <button
                disabled
                className="flex items-center gap-3 px-4 py-3 rounded-lg border-2 bg-zinc-800 text-gray-600 border-zinc-700 cursor-not-allowed opacity-50"
                title="Coming soon"
              >
                <span className="font-semibold">Bandcamp</span>
                <span className="text-xs bg-zinc-700 px-2 py-1 rounded">Soon</span>
              </button>
            </div>
          </div>
        </header>

        {/* Search Mode Toggle */}
        <div className="mb-8 flex gap-2">
          <button
            onClick={() => {
              setSearchMode('home');
              setEpisodes(null);
              setSelectedGenre(null);
              setSelectedEpisode(null);
              setTracklist(null);
            }}
            className={`px-6 py-3 rounded-lg font-semibold transition-all ${
              searchMode === 'home'
                ? 'bg-white text-black'
                : 'bg-zinc-900 text-white border border-zinc-800 hover:border-zinc-600'
            }`}
          >
            Home
          </button>
          <button
            onClick={() => {
              setSearchMode('track');
              setEpisodes(null);
              setSelectedGenre(null);
              setSelectedEpisode(null);
              setTracklist(null);
            }}
            className={`px-6 py-3 rounded-lg font-semibold transition-all ${
              searchMode === 'track'
                ? 'bg-white text-black'
                : 'bg-zinc-900 text-white border border-zinc-800 hover:border-zinc-600'
            }`}
          >
            Search by Track
          </button>
          <button
            onClick={() => {
              setSearchMode('genre');
              setEpisodes(null);
              setSelectedEpisode(null);
              setTracklist(null);
            }}
            className={`px-6 py-3 rounded-lg font-semibold transition-all ${
              searchMode === 'genre'
                ? 'bg-white text-black'
                : 'bg-zinc-900 text-white border border-zinc-800 hover:border-zinc-600'
            }`}
          >
            Browse by Genre
          </button>
          <button
            onClick={() => {
              setSearchMode('liked');
              setEpisodes(null);
              setSelectedEpisode(null);
              setTracklist(null);
            }}
            className={`px-6 py-3 rounded-lg font-semibold transition-all ${
              searchMode === 'liked'
                ? 'bg-white text-black'
                : 'bg-zinc-900 text-white border border-zinc-800 hover:border-zinc-600'
            }`}
          >
            Liked Episodes {likedEpisodes.length > 0 && `(${likedEpisodes.length})`}
          </button>
          <button
            onClick={() => {
              setSearchMode('likedTracks');
              setEpisodes(null);
              setSelectedEpisode(null);
              setTracklist(null);
            }}
            className={`px-6 py-3 rounded-lg font-semibold transition-all ${
              searchMode === 'likedTracks'
                ? 'bg-white text-black'
                : 'bg-zinc-900 text-white border border-zinc-800 hover:border-zinc-600'
            }`}
          >
            Liked Tracks {likedTracks.length > 0 && `(${likedTracks.length})`}
          </button>
        </div>

        {/* Home Tab */}
        {searchMode === 'home' && (
          <div className="mb-12">
            <p className="text-gray-400 mb-6">
              {stackSource === '1001tl'
                ? 'Search for DJ sets and live performances by artist. Get the latest tracklists with Spotify previews.'
                : 'Build custom music stacks from your favorite artists and genres. The system will find the latest episodes and combine tracks for you.'}
            </p>
            {stackSource === '1001tl' ? (
              <div className="mb-8">
                <div className="mb-4">
                  <label className="block text-sm font-semibold mb-2">Artist Name</label>
                  <input
                    type="text"
                    value={homeTracks[0]?.artist || ''}
                    onChange={(e) => setHomeTracks([{ artist: e.target.value, title: '' }])}
                    placeholder="e.g., Bonobo, Four Tet, Peggy Gou"
                    className="w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-white text-lg"
                  />
                  <p className="text-sm text-gray-500 mt-2">
                    Search for DJ sets, live performances, and festival appearances
                  </p>
                </div>
                <button
                  onClick={async () => {
                    const artist = homeTracks[0]?.artist?.trim();
                    if (!artist) {
                      setError('Please enter an artist name');
                      return;
                    }
                    setLoading(true);
                    setError(null);
                    setTracklistResults(null);
                    try {
                      const response = await fetch(`/api/1001tracklists/search?artist=${encodeURIComponent(artist)}`);
                      if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.error || 'Failed to search');
                      }
                      const data = await response.json();
                      setTracklistResults(data);
                    } catch (err) {
                      console.error('Error searching 1001TL:', err);
                      setError(err.message);
                    } finally {
                      setLoading(false);
                    }
                  }}
                  disabled={loading}
                  className="w-full py-3 px-6 bg-white text-black font-semibold rounded-lg hover:bg-gray-200 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? 'Searching...' : 'Find DJ Sets'}
                </button>
              </div>
            ) : (
              <HomeTab
              homeTracks={homeTracks}
              setHomeTracks={setHomeTracks}
              selectedGenres={selectedGenres}
              setSelectedGenres={setSelectedGenres}
              currentStack={currentStack}
              setCurrentStack={setCurrentStack}
              stackHistory={stackHistory}
              setStackHistory={setStackHistory}
              viewingHistoryStack={viewingHistoryStack}
              setViewingHistoryStack={setViewingHistoryStack}
              stats={stats}
              setStats={setStats}
              loading={loading}
              setLoading={setLoading}
              error={error}
              setError={setError}
              playedStates={playedStates}
              setPlayedStates={setPlayedStates}
              likedStates={likedStates}
              setLikedStates={setLikedStates}
              deleteModalOpen={deleteModalOpen}
              setDeleteModalOpen={setDeleteModalOpen}
              stackToDelete={stackToDelete}
              setStackToDelete={setStackToDelete}
              LazySpotifyEmbed={LazySpotifyEmbed}
              handleTrackPlay={(stackId, trackIndex) => {
                markTrackPlayed(stackId, trackIndex);
                setPlayedStates(prev => new Set([...prev, `${stackId}:${trackIndex}`]));
              }}
              isPlayed={(stackId, trackIndex) => {
                const key = `${stackId}:${trackIndex}`;
                return playedStates.has(key) || isTrackPlayed(stackId, trackIndex);
              }}
              handleEpisodeLinkClick={(episodePath) => {
                markEpisodeAsSeen(episodePath);
                setStats(getTasteProfileStats());
              }}
              handleDeleteStack={(stack, e) => {
                e.stopPropagation();
                setStackToDelete(stack);
                setDeleteModalOpen(true);
              }}
              confirmDelete={() => {
                if (stackToDelete) {
                  deleteStack(stackToDelete.id);
                  setStackHistory(getStackHistory());
                  setStats(getTasteProfileStats());
                  if (viewingHistoryStack?.id === stackToDelete.id) {
                    setViewingHistoryStack(null);
                  }
                }
                setDeleteModalOpen(false);
                setStackToDelete(null);
              }}
              cancelDelete={() => {
                setDeleteModalOpen(false);
                setStackToDelete(null);
              }}
              handleCreateStack={async () => {
                const validTracks = homeTracks.filter(t => t.artist.trim() || t.title.trim());
                if (validTracks.length === 0 && selectedGenres.length === 0) {
                  setError('Please add at least one track or genre');
                  return;
                }
                setLoading(true);
                setError(null);
                setCurrentStack(null);
                setViewingHistoryStack(null);
                try {
                  const seenEpisodes = getSeenEpisodes();
                  const referencedTracks = getReferencedTracks();
                  const response = await fetch('/api/taste-profile/create-stack', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      tracks: validTracks,
                      genres: selectedGenres.map(g => ({ id: g.id, name: g.name })),
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
                  saveStackToHistory(stack);
                  const trackUids = stack.tracks.map(t => t.uid);
                  markTracksAsReferenced(trackUids);
                  setCurrentStack(stack);
                  setStackHistory(getStackHistory());
                  setStats(getTasteProfileStats());
                } catch (err) {
                  console.error('Error creating stack:', err);
                  setError(err.message);
                } finally {
                  setLoading(false);
                }
              }}
            />
            )}

            {/* 1001TL Tracklist Results */}
            {tracklistResults && (
              <div className="mt-8 bg-zinc-900 border border-zinc-800 rounded-lg p-6">
                <h3 className="text-xl font-bold mb-4">
                  Found {tracklistResults.count} tracklist{tracklistResults.count !== 1 ? 's' : ''} for {tracklistResults.artist}
                </h3>
                <div className="space-y-2">
                  {tracklistResults.tracklists.slice(0, 1).map((tracklist, index) => (
                    <button
                      key={index}
                      onClick={async () => {
                        setSelectedTracklist(tracklist);
                        setLoadingTracks(true);
                        setError(null);
                        try {
                          const response = await fetch(`/api/1001tracklists/tracklist?url=${encodeURIComponent(tracklist.url)}`);
                          if (!response.ok) {
                            const errorData = await response.json();
                            throw new Error(errorData.error || 'Failed to fetch tracks');
                          }
                          const data = await response.json();
                          setTracklistTracks(data);
                        } catch (err) {
                          console.error('Error fetching tracks:', err);
                          setError(err.message);
                        } finally {
                          setLoadingTracks(false);
                        }
                      }}
                      className={`w-full text-left p-4 rounded transition-colors border-2 ${
                        selectedTracklist === tracklist
                          ? 'bg-white text-black border-white'
                          : 'bg-zinc-800 border-zinc-700 hover:border-zinc-600'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <p className={`font-semibold ${
                            selectedTracklist === tracklist ? 'text-black' : 'text-white'
                          }`}>
                            {tracklist.title}
                          </p>
                        </div>
                        <svg
                          className={`w-5 h-5 flex-shrink-0 ${
                            selectedTracklist === tracklist ? 'text-black' : 'text-gray-400'
                          }`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                          />
                        </svg>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Loading Tracks */}
            {loadingTracks && (
              <div className="mt-8 p-6 bg-zinc-900 border border-zinc-800 rounded-lg">
                <p className="text-gray-400">Loading tracks...</p>
              </div>
            )}

            {/* Tracklist Tracks Display */}
            {tracklistTracks && !loadingTracks && (
              <div className="mt-8 bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
                <div className="p-6 border-b border-zinc-800">
                  <h2 className="text-2xl font-bold mb-2">{tracklistTracks.title}</h2>
                  <p className="text-gray-400 text-sm">
                    {tracklistTracks.trackCount} track{tracklistTracks.trackCount !== 1 ? 's' : ''}
                  </p>
                  <a
                    href={tracklistTracks.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-400 hover:text-blue-300 transition-colors inline-flex items-center gap-2 mt-2"
                  >
                    View on 1001tracklists
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>
                <div className="divide-y divide-zinc-800">
                  {tracklistTracks.tracks.map((track, index) => (
                    <div
                      key={index}
                      className="p-4 hover:bg-zinc-800/50 transition-colors"
                    >
                      <div className="flex items-start gap-4">
                        <div className="text-gray-500 text-sm font-mono w-8 text-right flex-shrink-0">
                          {track.trackNumber}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold">{track.title}</h3>
                          <p className="text-gray-400 text-sm">{track.artist}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Track Search Form */}
        {searchMode === 'track' && (
          <form onSubmit={handleSubmit} className="mb-12">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1">
                <input
                  type="text"
                  id="artist"
                  value={artist}
                  onChange={(e) => setArtist(e.target.value)}
                  placeholder="Artist"
                  className="w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-white text-lg"
                />
              </div>
              <div className="text-2xl font-bold text-gray-600">—</div>
              <div className="flex-1">
                <input
                  type="text"
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Track"
                  className="w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-white text-lg"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-6 bg-white text-black font-semibold rounded-lg hover:bg-gray-200 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Searching...' : 'Find Episode'}
            </button>
          </form>
        )}

        {/* Genre Search/Browse */}
        {searchMode === 'genre' && (
          <div className="mb-12">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">
                {genreBrowseMode === 'search' ? 'Search Genres' : 'Browse by Genre'}
              </h2>
              <button
                onClick={() => {
                  setGenreBrowseMode(genreBrowseMode === 'search' ? 'browse' : 'search');
                  setGenreSearchQuery('');
                  setExpandedCategory(null);
                }}
                className="text-sm text-gray-400 hover:text-white transition-colors"
              >
                {genreBrowseMode === 'search' ? 'Browse categories instead' : 'Search instead'}
              </button>
            </div>

            {/* Type-ahead search mode */}
            {genreBrowseMode === 'search' && (
              <div className="relative">
                <input
                  type="text"
                  value={genreSearchQuery}
                  onChange={(e) => setGenreSearchQuery(e.target.value)}
                  placeholder="Type a genre name (e.g., Bossa Nova, Techno, Jazz...)"
                  className="w-full px-4 py-3 pr-10 bg-zinc-900 border border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-white text-lg"
                />
                {genreSearchQuery && (
                  <button
                    onClick={() => setGenreSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                    aria-label="Clear search"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                )}
                {filteredGenres.length > 0 && (
                  <div className="absolute z-10 w-full mt-2 bg-zinc-900 border border-zinc-800 rounded-lg shadow-lg max-h-80 overflow-y-auto">
                    {filteredGenres.map((genre, index) => {
                      const colorClass = genreColors[genre.color] || genreColors.other;
                      return (
                        <button
                          key={index}
                          onClick={() => {
                            handleGenreClick(genre.fullApiId);
                            setGenreSearchQuery('');
                          }}
                          disabled={loading}
                          className={`w-full text-left px-4 py-3 hover:bg-zinc-800 transition-colors border-b border-zinc-800 last:border-b-0 disabled:cursor-not-allowed`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-semibold">{genre.subgenreName}</div>
                              <div className="text-sm text-gray-500">{genre.categoryName}</div>
                            </div>
                            <div className={`px-3 py-1 rounded-full text-xs ${colorClass}`}>
                              {genre.categoryName}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Browse mode - category chips */}
            {genreBrowseMode === 'browse' && (
              <>
                {/* Top-level categories */}
                <div className="flex flex-wrap gap-2 mb-4">
              {genreCategories.map((category) => {
                const isExpanded = expandedCategory?.id === category.id;
                const colorClass = genreColors[category.color] || genreColors.other;

                return (
                  <button
                    key={category.id}
                    onClick={() => setExpandedCategory(isExpanded ? null : category)}
                    className={`
                      px-4 py-2 rounded-full font-semibold text-sm transition-all
                      whitespace-nowrap border
                      ${isExpanded
                        ? 'bg-white text-black shadow-lg ring-2 ring-white'
                        : colorClass
                      }
                    `}
                  >
                    {category.name}
                    <span className="ml-2">{isExpanded ? '−' : '+'}</span>
                  </button>
                );
              })}
            </div>

            {/* Sub-genres (shown when category is expanded) */}
            {expandedCategory && (
              <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
                <div className="flex flex-wrap gap-2">
                  {expandedCategory.subgenres.map((subgenre) => {
                    const isSelected = selectedGenre?.id === subgenre.id;
                    const colorClass = genreColors[expandedCategory.color] || genreColors.other;

                    return (
                      <button
                        key={subgenre.id}
                        onClick={() => handleGenreClick(expandedCategory.id, subgenre)}
                        disabled={loading}
                        className={`
                          px-3 py-1.5 rounded-full font-medium text-xs transition-all
                          disabled:cursor-not-allowed whitespace-nowrap border
                          ${isSelected
                            ? 'bg-white text-black shadow-lg'
                            : colorClass
                          }
                        `}
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
        )}

        {/* Liked Episodes View */}
        {searchMode === 'liked' && (
          <div className="mb-12">
            {likedEpisodes.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <p className="text-xl mb-2">No liked episodes yet</p>
                <p className="text-sm">Click the heart icon on episodes to save them here</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {likedEpisodes.map((episode, index) => {
                  const liked = isLiked(episode.episodePath);
                  return (
                    <div
                      key={index}
                      className="p-4 border rounded-lg transition-all relative bg-zinc-900 border-zinc-800"
                    >
                      <div className="text-xs font-mono mb-2 text-gray-500">
                        Aired: {episode.airDate}
                      </div>
                      <a
                        href={`https://www.nts.live${episode.episodePath}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-sm mb-3 line-clamp-2 block text-white hover:text-blue-400 transition-colors flex items-start gap-2 group"
                      >
                        <span className="flex-1">{episode.episodeTitle}</span>
                        <svg
                          className="w-4 h-4 flex-shrink-0 opacity-50 group-hover:opacity-100 transition-opacity"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                      <div className="flex items-start justify-between gap-2">
                        {episode.track && (
                          <div className="text-xs flex-1 text-gray-400">
                            <p className="line-clamp-1">
                              <span className="font-medium">Track:</span> {episode.track.title} - {episode.track.artist}
                            </p>
                          </div>
                        )}
                        {episode.genres && episode.genres.length > 0 && (
                          <div className="text-xs flex-1 text-gray-400">
                            <p className="line-clamp-1">
                              <span className="font-medium">Genres:</span> {episode.genres.slice(0, 3).map(g => g.name).join(', ')}
                            </p>
                          </div>
                        )}
                        <button
                          onClick={() => handleEpisodeClick(episode)}
                          className="flex-shrink-0 p-1.5 rounded hover:bg-white hover:bg-opacity-20 transition-colors"
                          title="Load tracklist"
                        >
                          <svg
                            className="w-5 h-5 text-white"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                            />
                          </svg>
                        </button>
                      </div>
                      {/* Like button */}
                      <button
                        onClick={() => toggleLike(episode)}
                        className="absolute top-2 right-2 p-1.5 rounded-full hover:bg-white/10 transition-colors"
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
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Liked Tracks View */}
        {searchMode === 'likedTracks' && (
          <div className="mb-12">
            {likedTracks.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <p className="text-xl mb-2">No liked tracks yet</p>
                <p className="text-sm">Click the heart icon on tracks to save them here</p>
              </div>
            ) : (
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
                <div className="p-6 border-b border-zinc-800">
                  <h2 className="text-2xl font-bold">Liked Tracks</h2>
                  <p className="text-gray-400 text-sm mt-1">
                    {likedTracks.length} track{likedTracks.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="divide-y divide-zinc-800">
                  {likedTracks.map((track, index) => {
                    const spotifyId = track.spotify?.id;
                    const played = spotifyId && (playedStates.has(`likedTracks:${index}`) || isTrackPlayed('likedTracks', index));
                    return (
                      <div
                        key={index}
                        className="p-4 hover:bg-zinc-800/50 transition-colors"
                      >
                        <div className="flex items-start gap-4">
                          <div className="text-gray-500 text-sm font-mono w-8 text-right flex-shrink-0">
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
                                    if (!spotifyId) return;
                                    unlikeTrack(spotifyId);
                                    setLikedTracksState(getLikedTracks());
                                    setLikedStates(prev => ({ ...prev, [spotifyId]: false }));
                                  }}
                                  className="p-2 hover:bg-white/10 rounded-full transition-colors"
                                  title="Unlike"
                                >
                                  <svg
                                    className="w-5 h-5 fill-red-500 text-red-500"
                                    fill="currentColor"
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

                            {/* Spotify Embed */}
                            {track.spotify && (
                              <LazySpotifyEmbed
                                spotifyId={track.spotify.id}
                                onInteraction={() => {
                                  markTrackPlayed('likedTracks', index);
                                  setPlayedStates(prev => new Set([...prev, `likedTracks:${index}`]));
                                }}
                                played={played}
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="mb-8 p-4 bg-red-900/20 border border-red-900 rounded-lg">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* Episodes Grid */}
        {episodes && searchMode !== 'liked' && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold">
                Found {episodes.length} episode{episodes.length !== 1 ? 's' : ''}
              </h2>
              {totalPages > 1 && (
                <div className="text-sm text-gray-400">
                  Page {currentPage + 1} of {totalPages}
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
              {currentEpisodes.map((episode, index) => {
                const isViewed = isTracklistViewed(episode.episodePath);
                const liked = isLiked(episode.episodePath);
                return (
                <div
                  key={index}
                  className={`p-4 border rounded-lg transition-all relative ${
                    selectedEpisode === episode
                      ? 'bg-white text-black border-white shadow-lg'
                      : isViewed
                      ? 'bg-zinc-900 border-zinc-800 opacity-60'
                      : 'bg-zinc-900 border-zinc-800'
                  }`}
                >
                  <div className={`text-xs font-mono mb-2 ${
                    selectedEpisode === episode ? 'text-gray-600' : 'text-gray-500'
                  }`}>
                    Aired: {episode.airDate}
                    {episode.location && ` · ${episode.location}`}
                  </div>
                  <a
                    href={`https://www.nts.live${episode.episodePath}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`font-semibold text-sm mb-2 line-clamp-2 flex items-start gap-2 group transition-colors ${
                      selectedEpisode === episode
                        ? 'text-black hover:text-blue-600'
                        : 'text-white hover:text-blue-400'
                    }`}
                  >
                    <span className="flex-1">{episode.episodeTitle}</span>
                    <svg
                      className="w-4 h-4 flex-shrink-0 opacity-50 group-hover:opacity-100 transition-opacity"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>

                  {/* Genres as clickable pills */}
                  {episode.genres && episode.genres.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {episode.genres.slice(0, 3).map((genre, idx) => (
                        <button
                          key={idx}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSearchMode('genre');
                            handleGenreClick(genre.id);
                            setSelectedEpisode(null);
                            setTracklist(null);
                          }}
                          className={`text-xs px-2 py-0.5 rounded-full transition-colors ${
                            selectedEpisode === episode
                              ? 'bg-gray-200 text-black hover:bg-gray-300'
                              : 'bg-zinc-800 text-gray-300 hover:bg-zinc-700'
                          }`}
                          title="Browse this genre"
                        >
                          {genre.name}
                        </button>
                      ))}
                    </div>
                  )}

                  {episode.track && (
                    <div className={`text-xs mb-2 ${
                      selectedEpisode === episode ? 'text-gray-700' : 'text-gray-400'
                    }`}>
                      <p className="line-clamp-1">
                        <span className="font-medium">Track:</span> {episode.track.title} - {episode.track.artist}
                      </p>
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => handleEpisodeClick(episode)}
                      className={`flex-shrink-0 p-1.5 rounded hover:bg-opacity-20 transition-colors ${
                        selectedEpisode === episode
                          ? 'hover:bg-black'
                          : 'hover:bg-white'
                      }`}
                      title="Load tracklist"
                    >
                      <svg
                        className={`w-5 h-5 ${
                          selectedEpisode === episode ? 'text-black' : 'text-white'
                        }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                        />
                      </svg>
                    </button>
                  </div>
                  {isViewed && (
                    <div className="absolute top-2 right-10 bg-green-600 text-white text-xs px-2 py-1 rounded-full">
                      ✓
                    </div>
                  )}
                  {/* Like button */}
                  <button
                    onClick={() => toggleLike(episode)}
                    className="absolute top-2 right-2 p-1.5 rounded-full hover:bg-white/10 transition-colors"
                    title={liked ? 'Unlike' : 'Like'}
                  >
                    <svg
                      className={`w-5 h-5 ${liked ? 'fill-red-500 text-red-500' : selectedEpisode === episode ? 'text-gray-600' : 'text-gray-400'}`}
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
                );
              })}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-4">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
                  disabled={currentPage === 0}
                  className="p-2 rounded-lg border border-zinc-800 hover:border-zinc-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  aria-label="Previous page"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                </button>

                <div className="text-sm text-gray-400">
                  {currentPage + 1} / {totalPages}
                </div>

                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages - 1, prev + 1))}
                  disabled={currentPage === totalPages - 1}
                  className="p-2 rounded-lg border border-zinc-800 hover:border-zinc-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  aria-label="Next page"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Loading Tracklist */}
        {loadingTracklist && (
          <div className="mb-8 p-6 bg-zinc-900 border border-zinc-800 rounded-lg">
            <p className="text-gray-400">Loading tracklist...</p>
          </div>
        )}

        {/* Tracklist Display */}
        {tracklist && !loadingTracklist && selectedEpisode && (
          <TracklistDisplay tracklist={tracklist} episodePath={selectedEpisode.episodePath} />
        )}

        {/* Home Tab - Stack Results Display */}
        {searchMode === 'home' && (currentStack || viewingHistoryStack) && (() => {
          const displayStack = viewingHistoryStack || currentStack;

          // Group tracks by episode or tracklist
          const episodeGroups = {};
          displayStack.tracks.forEach((track, index) => {
            const episodeKey = displayStack.source === '1001tl'
              ? track.tracklistUrl
              : track.episodePath;

            if (!episodeGroups[episodeKey]) {
              episodeGroups[episodeKey] = displayStack.source === '1001tl'
                ? {
                    episodePath: track.tracklistUrl,
                    episodeTitle: track.tracklistTitle,
                    airDate: track.tracklistDate,
                    venue: track.tracklistVenue,
                    tracks: []
                  }
                : {
                    episodePath: track.episodePath,
                    episodeTitle: track.episodeTitle,
                    airDate: track.airDate,
                    tracks: []
                  };
            }
            episodeGroups[episodeKey].tracks.push({ ...track, originalIndex: index });
          });

          const episodes = Object.values(episodeGroups);

          return (
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden mt-8">
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

                {/* Hide Played Toggle */}
                <div className="mb-4">
                  <button
                    onClick={() => {
                      if (!hidePlayed) {
                        // Turning ON: Take a snapshot of currently played tracks
                        const snapshot = new Set();
                        displayStack.tracks.forEach((track, index) => {
                          const key = `${displayStack.id}:${index}`;
                          if (playedStates.has(key) || isTrackPlayed(displayStack.id, index)) {
                            snapshot.add(key);
                          }
                        });
                        setHidePlayedSnapshot(snapshot);
                        setHidePlayed(true);
                      } else {
                        // Turning OFF: Clear snapshot
                        setHidePlayed(false);
                        setHidePlayedSnapshot(new Set());
                      }
                    }}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      hidePlayed
                        ? 'bg-green-900/30 border border-green-700/50 text-green-400'
                        : 'bg-zinc-800 border border-zinc-700 text-gray-400 hover:text-white'
                    }`}
                  >
                    {hidePlayed ? '✓ Hiding Played Tracks' : 'Hide Played Tracks'}
                  </button>
                </div>

                {/* Sources Display */}
                <div className="space-y-3">
                  {displayStack.source === '1001tl' ? (
                    <div>
                      <div className="text-xs font-semibold text-gray-500 mb-2">ARTIST:</div>
                      <div className="px-3 py-1.5 bg-blue-900 border border-blue-700 rounded-full text-sm inline-block">
                        {displayStack.sources.artist}
                      </div>
                      {displayStack.sources.tracklists && displayStack.sources.tracklists.length > 0 && (
                        <div className="mt-3">
                          <div className="text-xs font-semibold text-gray-500 mb-2">FROM TRACKLISTS:</div>
                          <div className="space-y-2">
                            {displayStack.sources.tracklists.map((tl, idx) => (
                              <a
                                key={idx}
                                href={tl.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-sm hover:border-zinc-600 transition-colors"
                              >
                                <div className="font-medium">{tl.title}</div>
                                <div className="text-xs text-gray-500 mt-1">
                                  {tl.date} • {tl.venue} • {tl.trackCount} tracks
                                </div>
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      {displayStack.sources.tracks && displayStack.sources.tracks.length > 0 && (
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

                      {displayStack.sources.genres && displayStack.sources.genres.length > 0 && (
                        <div>
                          <div className="text-xs font-semibold text-gray-500 mb-2">GENRES:</div>
                          <div className="flex flex-wrap gap-2">
                            {displayStack.sources.genres.map((genre, idx) => (
                              <div
                                key={idx}
                                className="px-3 py-1.5 bg-purple-900 border border-purple-700 rounded-full text-sm"
                              >
                                {typeof genre === 'string' ? genre : getGenreNameFromId(genre)}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Episode Groups */}
              <div className="divide-y divide-zinc-800">
                {episodes.map((episode) => {
                  const isCollapsed = collapsedEpisodes.has(episode.episodePath);
                  // Filter tracks based on hidePlayed setting (using snapshot)
                  const episodeTracks = hidePlayed
                    ? episode.tracks.filter(track => {
                        const index = track.originalIndex;
                        const key = `${displayStack.id}:${index}`;
                        return !hidePlayedSnapshot.has(key);
                      })
                    : episode.tracks;

                  // Skip episode if all tracks are filtered out
                  if (episodeTracks.length === 0) return null;

                  const playedCount = episode.tracks.filter(track => {
                    const index = track.originalIndex;
                    return playedStates.has(`${displayStack.id}:${index}`) || isTrackPlayed(displayStack.id, index);
                  }).length;

                  return (
                    <div key={episode.episodePath} className="bg-zinc-900">
                      {/* Episode Header */}
                      <button
                        onClick={() => {
                          setCollapsedEpisodes(prev => {
                            const next = new Set(prev);
                            if (next.has(episode.episodePath)) {
                              next.delete(episode.episodePath);
                            } else {
                              next.add(episode.episodePath);
                            }
                            return next;
                          });
                        }}
                        className="w-full px-4 py-3 flex items-center justify-between hover:bg-zinc-800/50 transition-colors border-b border-zinc-800"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <svg
                            className={`w-5 h-5 text-gray-400 flex-shrink-0 transition-transform ${
                              isCollapsed ? '' : 'rotate-90'
                            }`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                          <div className="flex-1 min-w-0 text-left">
                            <p className="text-xs text-gray-500 mb-1">Aired: {episode.airDate}</p>
                            <a
                              href={displayStack.source === '1001tl' ? episode.episodePath : `https://www.nts.live${episode.episodePath}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (displayStack.source !== '1001tl') {
                                  markEpisodeAsSeen(episode.episodePath);
                                  setStats(getTasteProfileStats());
                                }
                              }}
                              className="font-semibold hover:text-blue-400 transition-colors flex items-start gap-2 mb-1 group"
                            >
                              <span className="flex-1">{episode.episodeTitle}</span>
                              <svg
                                className="w-4 h-4 flex-shrink-0 opacity-50 group-hover:opacity-100 transition-opacity"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                            </a>
                            {episode.venue && (
                              <p className="text-xs text-gray-500">
                                {episode.venue}
                              </p>
                            )}
                            {/* Show a featured track from this episode */}
                            {episode.tracks.length > 0 && episode.tracks[0].source && displayStack.source !== '1001tl' && (
                              <p className="text-xs text-gray-500">
                                {episode.tracks[0].source.type === 'track' ? (
                                  <>Track: {episode.tracks[0].source.artist && episode.tracks[0].source.title ? `${episode.tracks[0].source.artist} - ${episode.tracks[0].source.title}` : episode.tracks[0].source.artist || episode.tracks[0].source.title}</>
                                ) : (
                                  <>Genre: {getGenreNameFromId(episode.tracks[0].source.genreId)}</>
                                )}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <span className="text-sm text-gray-400">
                            {episodeTracks.length} {episodeTracks.length === 1 ? 'track' : 'tracks'}
                          </span>
                          {playedCount > 0 && (
                            <span className="px-2 py-0.5 bg-green-900/30 border border-green-700/50 rounded text-xs text-green-400 font-medium">
                              {playedCount} played
                            </span>
                          )}
                        </div>
                      </button>

                      {/* Episode Tracks */}
                      {!isCollapsed && (
                        <div className="divide-y divide-zinc-800">
                          {episodeTracks.map((track) => {
                            const index = track.originalIndex;
                            const spotifyId = track.spotify?.id;
                            const liked = spotifyId && likedStates[spotifyId] !== undefined ? likedStates[spotifyId] : isTrackLiked(spotifyId);
                            const played = playedStates.has(`${displayStack.id}:${index}`) || isTrackPlayed(displayStack.id, index);

                            return (
                              <div
                                key={index}
                                className={`p-4 transition-colors ${
                                  played ? 'bg-green-900/5' : 'hover:bg-zinc-800/50'
                                }`}
                              >
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
                                        {played && (
                                          <span className="px-2 py-1 bg-green-900/30 border border-green-700/50 rounded text-xs text-green-400 font-medium">
                                            PLAYED
                                          </span>
                                        )}
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
                                            if (!spotifyId) return;
                                            if (liked) {
                                              unlikeTrack(spotifyId);
                                              setLikedStates(prev => ({ ...prev, [spotifyId]: false }));
                                            } else {
                                              likeTrack({
                                                artist: track.artist,
                                                title: track.title,
                                                spotify: track.spotify
                                              });
                                              setLikedStates(prev => ({ ...prev, [spotifyId]: true }));
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

                                    {track.spotify && (
                                      <LazySpotifyEmbed
                                        spotifyId={track.spotify.id}
                                        onInteraction={() => {
                                          markTrackPlayed(displayStack.id, index);
                                          setPlayedStates(prev => new Set([...prev, `${displayStack.id}:${index}`]));
                                        }}
                                        played={played}
                                      />
                                    )}

                                    <div className="flex items-center gap-2 text-xs text-gray-500 flex-wrap">
                                      {track.source && (
                                        <>
                                          {track.source.type === '1001tl' ? (
                                            <span className="px-2 py-0.5 bg-orange-900/50 border border-orange-700/50 rounded text-orange-300 font-medium">
                                              1001 Tracklists
                                            </span>
                                          ) : track.source.type === 'track' ? (
                                            <span className="px-2 py-0.5 bg-blue-900/50 border border-blue-700/50 rounded text-blue-300 font-medium">
                                              {track.source.artist && track.source.title
                                                ? `${track.source.artist} - ${track.source.title}`
                                                : track.source.artist || track.source.title}
                                            </span>
                                          ) : (
                                            <span className="px-2 py-0.5 bg-purple-900/50 border border-purple-700/50 rounded text-purple-300 font-medium">
                                              {getGenreNameFromId(track.source.genreId)}
                                            </span>
                                          )}
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* Delete Confirmation Modal */}
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
                  onClick={() => {
                    setDeleteModalOpen(false);
                    setStackToDelete(null);
                  }}
                  className="flex-1 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (stackToDelete) {
                      deleteStack(stackToDelete.id);
                      setStackHistory(getStackHistory());
                      setStats(getTasteProfileStats());
                      if (viewingHistoryStack?.id === stackToDelete.id) {
                        setViewingHistoryStack(null);
                      }
                    }
                    setDeleteModalOpen(false);
                    setStackToDelete(null);
                  }}
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
