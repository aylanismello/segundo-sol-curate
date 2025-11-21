'use client';

/**
 * Home Tab Component (Taste Profile)
 *
 * Build music stacks from your taste profile
 */

import { useState } from 'react';
import { genreCategories, genreColors, getGenreApiId } from '../data/genres';

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

export default function HomeTab({
  homeTracks,
  setHomeTracks,
  selectedGenres,
  setSelectedGenres,
  currentStack,
  setCurrentStack,
  stackHistory,
  setStackHistory,
  viewingHistoryStack,
  setViewingHistoryStack,
  stats,
  setStats,
  loading,
  setLoading,
  error,
  setError,
  playedStates,
  setPlayedStates,
  likedStates,
  setLikedStates,
  deleteModalOpen,
  setDeleteModalOpen,
  stackToDelete,
  setStackToDelete,
  LazySpotifyEmbed,
  handleTrackPlay,
  isPlayed,
  handleEpisodeLinkClick,
  handleDeleteStack,
  confirmDelete,
  cancelDelete,
  handleCreateStack,
}) {
  const [genreSearchQuery, setGenreSearchQuery] = useState('');
  const [genreBrowseMode, setGenreBrowseMode] = useState('search');
  const [expandedCategory, setExpandedCategory] = useState(null);

  const addTrackInput = () => {
    setHomeTracks([...homeTracks, { artist: '', title: '' }]);
  };

  const removeTrackInput = (index) => {
    setHomeTracks(homeTracks.filter((_, i) => i !== index));
  };

  const updateTrack = (index, field, value) => {
    const updated = [...homeTracks];
    updated[index][field] = value;
    setHomeTracks(updated);
  };

  const toggleGenre = (genreId, genreName) => {
    if (selectedGenres.find(g => g.id === genreId)) {
      setSelectedGenres(selectedGenres.filter(g => g.id !== genreId));
    } else {
      setSelectedGenres([...selectedGenres, { id: genreId, name: genreName }]);
    }
  };

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

  const filteredGenres = genreSearchQuery.trim() === ''
    ? []
    : allGenres.filter(genre =>
        genre.subgenreName.toLowerCase().includes(genreSearchQuery.toLowerCase()) ||
        genre.categoryName.toLowerCase().includes(genreSearchQuery.toLowerCase())
      ).slice(0, 10);

  const displayStack = viewingHistoryStack || currentStack;

  return (
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
            {homeTracks.map((track, index) => (
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
                {homeTracks.length > 1 && (
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

        {/* Stack Results - Will be shown below */}
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
                    onClick={() => setViewingHistoryStack(stack)}
                    className="w-full text-left"
                  >
                    <div className={`text-xs mb-1 ${
                      viewingHistoryStack?.id === stack.id ? 'text-gray-600' : 'text-gray-500'
                    }`}>
                      {new Date(stack.createdAt).toLocaleString()}
                    </div>
                    <div className="text-sm font-semibold mb-1">
                      {stack.name || `${stack.tracks.length} tracks`}
                    </div>
                    <div className={`text-xs ${
                      viewingHistoryStack?.id === stack.id ? 'text-gray-700' : 'text-gray-400'
                    }`}>
                      {stack.tracks.length} tracks
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
  );
}
