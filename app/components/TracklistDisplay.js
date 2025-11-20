/**
 * TracklistDisplay Component
 *
 * This component displays the full NTS tracklist with Spotify embeds.
 *
 * Key Next.js concept:
 * - This is a SERVER COMPONENT by default (no 'use client' directive)
 * - Server components can't use hooks or browser APIs
 * - But this component doesn't need them! It just receives props and renders
 *
 * In React terms, this is a "presentational component" - it just displays data.
 */

import SpotifyEmbed from './SpotifyEmbed';

export default function TracklistDisplay({ tracklist }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
      {/* Playlist Header */}
      <div className="p-6 border-b border-zinc-800">
        <h2 className="text-2xl font-bold">
          Tracklist
        </h2>
        <p className="text-gray-400 text-sm mt-1">
          {tracklist.trackCount} tracks
        </p>
      </div>

      {/* Track List - Spotify playlist style */}
      <div className="divide-y divide-zinc-800">
        {tracklist.tracks.map((track, index) => (
          <div
            key={track.uid || index}
            className="hover:bg-zinc-800/50 transition-colors"
          >
            {/* Track Info Row */}
            <div className="p-4 flex items-center gap-4">
              <div className="text-gray-500 text-sm font-mono w-8 text-right flex-shrink-0">
                {index + 1}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold truncate">{track.title}</h3>
                <p className="text-gray-400 text-sm truncate">{track.artist}</p>
              </div>
              {track.spotify ? (
                <a
                  href={track.spotify.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-shrink-0 p-2 hover:bg-white/10 rounded-full transition-colors"
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
              ) : (
                <div className="flex-shrink-0 text-xs text-gray-600 italic">
                  Not on Spotify
                </div>
              )}
            </div>

            {/* Spotify Embed - Hidden by default, can be toggled */}
            {track.spotify && (
              <div className="px-4 pb-4">
                <SpotifyEmbed trackId={track.spotify.id} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
